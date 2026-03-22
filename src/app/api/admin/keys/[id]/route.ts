/**
 * Admin API: Revoke API Key
 * DELETE /api/admin/keys/[id]
 * 
 * Allows admins to revoke any user's API key.
 * Logs the action for accountability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Ensure admin session
        const session = await requireAdmin();

        // Find API key with owner info
        const apiKey = await prisma.apiKey.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!apiKey) {
            throw Errors.notFound('API Key');
        }

        // Check if already revoked
        if (!apiKey.active) {
            throw Errors.conflict('API key is already revoked');
        }

        // Revoke the key (soft delete - keep for audit trail)
        const revokedKey = await prisma.apiKey.update({
            where: { id },
            data: {
                active: false,
                lastUsedAt: new Date(), // Mark revocation timestamp
            },
            select: {
                id: true,
                name: true,
                prefix: true,
                userId: true,
                active: true,
                lastUsedAt: true,
            },
        });

        // Log to audit
        await logAuditEvent('API_KEY_REVOKED_BY_ADMIN', session.user.id, {
            apiKeyId: id,
            apiKeyName: apiKey.name,
            keyOwnerId: apiKey.user.id,
            keyOwnerEmail: apiKey.user.email,
        });

        return NextResponse.json({
            success: true,
            message: 'API key revoked successfully',
            key: {
                ...revokedKey,
                userEmail: apiKey.user.email,
                userName: apiKey.user.name,
                revokedAt: revokedKey.lastUsedAt?.toISOString(),
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
