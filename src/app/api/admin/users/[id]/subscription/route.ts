/**
 * Admin User Subscription API
 * GET  /api/admin/users/[id]/subscription — User's subscription history
 * POST /api/admin/users/[id]/subscription — Admin set/upgrade user plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { adminSetPlan } from '@/lib/billing/subscription-service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// ─── GET — Subscription history ────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await requireAdmin();

        const subscriptions = await prisma.subscription.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                promoCode: { select: { code: true, discountPercent: true } },
            },
        });

        return NextResponse.json({ success: true, subscriptions });
    } catch (error) {
        return handleApiError(error);
    }
}

// ─── POST — Admin set plan ─────────────────────────────

const SetPlanSchema = z.object({
    plan: z.enum(['FREE', 'TRIAL', 'PRO', 'ENTERPRISE']),
    reason: z.string().optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await requireAdmin();

        const body = await request.json();
        const data = SetPlanSchema.parse(body);

        const result = await adminSetPlan(id, data.plan, session.user.id, data.reason);

        if (!result.success) {
            throw Errors.badRequest(result.error!);
        }

        return NextResponse.json({
            success: true,
            message: `User plan set to ${data.plan}`,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
