/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 * 
 * Handles all Stripe subscription and payment events
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db/prisma';
import { emailService } from '@/lib/email/email-service';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const headersList = await headers();
        const signature = headersList.get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ error: 'No signature' }, { status: 400 });
        }

        // Verify webhook signature
        let event: Stripe.Event;
        try {
            event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        console.log(`[Stripe Webhook] Received event: ${event.type}`);

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[Stripe Webhook] Error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        );
    }
}

/**
 * Handle successful checkout session
 * Creates or updates subscription in database
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { customer, subscription: stripeSubscriptionId, metadata } = session;

    if (!customer || !stripeSubscriptionId || !metadata?.userId) {
        console.error('[Webhook] Missing required data in checkout session');
        return;
    }

    // Get subscription details from Stripe
    const stripeSubscription: any = await getStripe().subscriptions.retrieve(stripeSubscriptionId as string);
    const plan = metadata.plan as 'PRO' | 'ENTERPRISE';

    // Create or update subscription in database
    await prisma.subscription.upsert({
        where: {
            stripeSubscriptionId: stripeSubscriptionId as string,
        },
        create: {
            userId: metadata.userId,
            plan,
            status: 'ACTIVE',
            stripeCustomerId: customer as string,
            stripeSubscriptionId: stripeSubscriptionId as string,
            currentPeriodStart: new Date((stripeSubscription.current_period_start ?? 0) * 1000),
            currentPeriodEnd: new Date((stripeSubscription.current_period_end ?? 0) * 1000),
        },
        update: {
            status: 'ACTIVE',
            plan,
            currentPeriodStart: new Date((stripeSubscription.current_period_start ?? 0) * 1000),
            currentPeriodEnd: new Date((stripeSubscription.current_period_end ?? 0) * 1000),
        },
    });

    // Send welcome email
    const user = await prisma.user.findUnique({
        where: { id: metadata.userId },
        select: { email: true, name: true },
    });

    if (user) {
        await emailService.sendSubscriptionWelcome(user.email, plan, user.name || undefined);
    }

    console.log(`[Webhook] Subscription activated for user ${metadata.userId}`);
}

/**
 * Handle successful payment
 * Records invoice in database
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const invoiceAny: any = invoice;
    const { customer, subscription, amount_paid, id } = invoiceAny;

    if (!customer || !subscription) return;

    // Find subscription in database
    const dbSubscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription as string },
        include: { user: true },
    });

    if (!dbSubscription) {
        console.error('[Webhook] Subscription not found for payment');
        return;
    }

    // Record invoice
    await prisma.invoice.create({
        data: {
            userId: dbSubscription.userId,
            stripeInvoiceId: id,
            amount: amount_paid,
            status: 'PAID',
            paidAt: new Date(),
        },
    });

    // Update subscription period
    const stripeSubscription: any = await getStripe().subscriptions.retrieve(subscription as string);
    await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
            currentPeriodStart: new Date((stripeSubscription.current_period_start ?? 0) * 1000),
            currentPeriodEnd: new Date((stripeSubscription.current_period_end ?? 0) * 1000),
            status: 'ACTIVE',
        },
    });

    console.log(`[Webhook] Payment recorded for subscription ${dbSubscription.id}`);
}

/**
 * Handle failed payment
 * Updates subscription status and sends email
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const invoiceAny: any = invoice;
    const { customer, subscription } = invoiceAny;

    if (!customer || !subscription) return;

    // Find subscription
    const dbSubscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription as string },
        include: { user: true },
    });

    if (!dbSubscription) return;

    // Update status to past_due
    await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: { status: 'PAST_DUE' },
    });

    // Send payment failed email
    await emailService.sendPaymentFailed(
        dbSubscription.user.email,
        dbSubscription.user.name || undefined
    );

    console.log(`[Webhook] Payment failed for subscription ${dbSubscription.id}`);
}

/**
 * Handle subscription update
 * Updates plan or status in database
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const subscriptionAny: any = subscription;
    const { id, status, items } = subscriptionAny;

    const dbSubscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: id },
    });

    if (!dbSubscription) return;

    // Map Stripe status to our status
    const dbStatus = status === 'active' ? 'ACTIVE'
        : status === 'canceled' ? 'CANCELED'
            : status === 'past_due' ? 'PAST_DUE'
                : 'ACTIVE';

    // Determine plan from price ID
    const priceId = items.data[0]?.price.id;
    let plan = dbSubscription.plan;

    // Map price IDs to plans (configure these in your .env)
    if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
        plan = 'PRO';
    } else if (priceId === process.env.STRIPE_PRICE_ID_ENTERPRISE) {
        plan = 'ENTERPRISE';
    }

    await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
            status: dbStatus,
            plan,
            currentPeriodStart: new Date((subscriptionAny.current_period_start ?? 0) * 1000),
            currentPeriodEnd: new Date((subscriptionAny.current_period_end ?? 0) * 1000),
        },
    });

    console.log(`[Webhook] Subscription updated: ${id}`);
}

/**
 * Handle subscription cancellation
 * Downgrades user to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const { id } = subscription;

    const dbSubscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: id },
    });

    if (!dbSubscription) return;

    await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: { status: 'CANCELED' },
    });

    console.log(`[Webhook] Subscription canceled: ${id}`);
}
