/**
 * Portal Cancel Subscription API
 * POST /api/portal/subscription/cancel — Cancel current subscription
 */

import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { cancelSubscription } from '@/lib/billing/subscription-service';

export async function POST() {
    try {
        const session = await requireAuth();
        const result = await cancelSubscription(session.user.id);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 },
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Subscription cancelled. You will retain access until the end of your billing period.',
        });
    } catch (error) {
        return handleApiError(error);
    }
}
