/**
 * Portal Redeem Promo Code API
 * POST /api/portal/subscription/redeem — Apply promo code to existing subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { applyPromoToSubscription, validatePromoCode, getUserSubscription } from '@/lib/billing/subscription-service';
import { z } from 'zod';

const RedeemSchema = z.object({
    code: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth();
        const body = await request.json();
        const data = RedeemSchema.parse(body);

        const result = await applyPromoToSubscription(session.user.id, data.code);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 },
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Promo code applied successfully',
            newPrice: result.newPrice,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * GET /api/portal/subscription/redeem?code=XXX — Validate promo code (preview)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth();
        const code = request.nextUrl.searchParams.get('code');

        if (!code) {
            return NextResponse.json({ success: false, error: 'Missing code parameter' }, { status: 400 });
        }

        const sub = await getUserSubscription(session.user.id);
        const validation = await validatePromoCode(code, sub.plan as any, sub.billingInterval);

        return NextResponse.json({
            success: true,
            validation,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
