/**
 * Create Stripe Checkout Session
 * POST /api/portal/subscription/checkout
 * 
 * Creates a Stripe checkout session for upgrading subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-12-15.clover',
});

const RequestSchema = z.object({
    plan: z.enum(['PRO', 'ENTERPRISE'], {
        message: 'Plan must be PRO or ENTERPRISE'
    }),
});

export async function POST(request: NextRequest) {
    try {
        // Get authenticated session
        const session = await requireAuth();

        // Parse and validate
        const body = await request.json();
        const validation = RequestSchema.safeParse(body);

        if (!validation.success) {
            throw Errors.badRequest('Invalid request data', validation.error.issues);
        }

        const { plan } = validation.data;

        // Get price ID from environment variables
        const priceId = plan === 'PRO'
            ? process.env.STRIPE_PRICE_ID_PRO
            : process.env.STRIPE_PRICE_ID_ENTERPRISE;

        if (!priceId) {
            throw Errors.internalError('Stripe price not configured. Please add STRIPE_PRICE_ID_PRO and STRIPE_PRICE_ID_ENTERPRISE to your .env file.');
        }

        // Create Stripe checkout session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer_email: session.user.email!,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXTAUTH_URL}/billing?success=true`,
            cancel_url: `${process.env.NEXTAUTH_URL}/billing?canceled=true`,
            metadata: {
                userId: session.user.id,
                plan,
            },
        });

        return NextResponse.json({
            success: true,
            checkoutUrl: checkoutSession.url,
        });

    } catch (error) {
        return handleApiError(error);
    }
}
