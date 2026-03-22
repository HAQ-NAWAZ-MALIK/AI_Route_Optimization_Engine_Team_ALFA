/**
 * Admin API: Update API Key Rate Limits
 * POST /api/admin/keys/[id]/limits
 * 
 * Allows admins to override rate limits for specific API keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';

const UpdateRateLimitSchema = z.object({
    rateLimit: z.number().int().positive('Rate limit must be a positive number'),
    expiresAt: z.string().datetime().optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Ensure admin session
        const session = await requireAdmin();

        // Parse and validate request
        const body = await request.json();
        const validation = UpdateRateLimitSchema.safeParse(body);

        if (!validation.success) {
            throw Errors.badRequest('Invalid request data', validation.error.errors);
        }

        const { rateLimit, expiresAt } = validation.data;

        // Find API key
        const apiKey = await prisma.apiKey.findUnique({
            where: { id: params.id },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!apiKey) {
            throw Errors.notFound('API Key');
        }

        // Store old rate limit for audit
        const oldRateLimit = apiKey.rateLimit;

        // Update rate limit
        const updatedKey = await prisma.apiKey.update({
            where: { id: params.id },
            data: {
                rateLimit,
                ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
            },
            select: {
                id: true,
                name: true,
                rateLimit: true,
                expiresAt: true,
            },
        });

        // Log to audit
        await logAuditEvent('API_KEY_RATE_LIMIT_CHANGED', session.user.id, {
            apiKeyId: params.id,
            apiKeyName: apiKey.name,
            keyOwnerEmail: apiKey.user.email,
            oldRateLimit,
            newRateLimit: rateLimit,
            expiresAt,
        });

        return NextResponse.json({
            success: true,
            message: 'Rate limit updated successfully',
            key: {
                ...updatedKey,
                owner: {
                    email: apiKey.user.email,
                    name: apiKey.user.name,
                },
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
