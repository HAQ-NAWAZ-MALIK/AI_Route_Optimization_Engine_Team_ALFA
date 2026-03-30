/**
 * Admin Promo Codes API
 * GET  /api/admin/promo-codes — List all promo codes
 * POST /api/admin/promo-codes — Create a new promo code
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';

// ─── GET — List all promo codes ────────────────────────

export async function GET() {
    try {
        const session = await requireAdmin();

        const codes = await prisma.promoCode.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { subscriptions: true } },
            },
        });

        return NextResponse.json({
            success: true,
            codes: codes.map(c => ({
                ...c,
                subscriptionCount: c._count.subscriptions,
                _count: undefined,
            })),
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// ─── POST — Create promo code ──────────────────────────

const CreateSchema = z.object({
    code: z.string().min(3).max(30).transform(v => v.toUpperCase().trim()),
    discountPercent: z.number().int().min(1).max(100),
    maxRedemptions: z.number().int().min(1).default(100),
    expiresAt: z.string().datetime().optional().nullable(),
    applicablePlans: z.array(z.enum(['PRO', 'ENTERPRISE'])).default(['PRO', 'ENTERPRISE']),
});

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdmin();
        const body = await request.json();
        const data = CreateSchema.parse(body);

        // Check for duplicate
        const existing = await prisma.promoCode.findUnique({ where: { code: data.code } });
        if (existing) {
            throw Errors.conflict('A promo code with this name already exists');
        }

        const code = await prisma.promoCode.create({
            data: {
                code: data.code,
                discountPercent: data.discountPercent,
                maxRedemptions: data.maxRedemptions,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
                applicablePlans: data.applicablePlans,
                createdBy: session.user.id,
            },
        });

        await logAuditEvent('PROMO_CODE_CREATED', session.user.id, {
            promoCodeId: code.id,
            code: code.code,
            discountPercent: code.discountPercent,
            maxRedemptions: code.maxRedemptions,
        });

        return NextResponse.json({ success: true, code }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
