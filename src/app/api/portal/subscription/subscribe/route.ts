/**
 * Portal Subscribe API
 * POST /api/portal/subscription/subscribe — Subscribe to a plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { subscribe } from '@/lib/billing/subscription-service';
import { z } from 'zod';

const SubscribeSchema = z.object({
    plan: z.enum(['TRIAL', 'PRO', 'ENTERPRISE']),
    interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
    promoCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth();
        const body = await request.json();
        const data = SubscribeSchema.parse(body);

        const result = await subscribe(
            session.user.id,
            data.plan,
            data.interval,
            data.promoCode,
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 },
            );
        }

        return NextResponse.json({
            success: true,
            subscription: result.subscription,
            invoice: result.invoice,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
