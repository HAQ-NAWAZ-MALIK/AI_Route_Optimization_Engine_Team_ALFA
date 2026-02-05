/**
 * Subscription Service
 * 
 * Centralized subscription lifecycle management.
 * Designed to mirror Stripe's model so switching from local to Stripe
 * requires only swapping the payment/invoice layer.
 * 
 * Local mode: subscriptions are created immediately, invoices are auto-PAID.
 * Stripe mode: subscriptions go through Stripe checkout, invoices come from webhooks.
 */

import { prisma } from '@/lib/db/prisma';
import { PLANS, formatPrice } from './plans';
import { logAuditEvent } from '@/lib/audit/logger';
import {
    notifyPlanChanged,
    notifySubscriptionCancelled,
} from '@/lib/notifications/notification-service';

// Re-export plan types for convenience
type Plan = 'FREE' | 'TRIAL' | 'PRO' | 'ENTERPRISE';
type BillingInterval = 'MONTHLY' | 'YEARLY';

// ============================================================================
// HELPERS
// ============================================================================

function computePeriodDates(interval: BillingInterval): { start: Date; end: Date } {
    const start = new Date();
    const end = new Date();
    if (interval === 'YEARLY') {
        end.setFullYear(end.getFullYear() + 1);
    } else {
        end.setMonth(end.getMonth() + 1);
    }
    return { start, end };
}

/**
 * Get the base price for a plan+interval in cents.
 */
export function getPlanPrice(plan: Plan, interval: BillingInterval): number {
    const p = PLANS[plan];
    if (!p) return 0;
    return interval === 'YEARLY' ? p.priceYearly : p.priceMonthly;
}

/**
 * Calculate actual price after discount.
 */
export function applyDiscount(basePrice: number, discountPercent: number): number {
    if (discountPercent <= 0) return basePrice;
    const discounted = Math.round(basePrice * (1 - discountPercent / 100));
    return Math.max(0, discounted);
}

// ============================================================================
// READ
// ============================================================================

export interface SubscriptionInfo {
    id: string;
    plan: Plan;
    status: string;
    billingInterval: BillingInterval;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    discountPercent: number;
    priceAtPurchase: number;
    adminGranted: boolean;
    promoCode: { code: string; discountPercent: number } | null;
    createdAt: Date;
}

/**
 * Get user's active subscription. Falls back to a virtual FREE plan if none exists.
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo> {
    const sub = await prisma.subscription.findFirst({
        where: {
            userId,
            status: { in: ['ACTIVE', 'TRIALING'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
            promoCode: {
                select: { code: true, discountPercent: true },
            },
        },
    });

    if (sub) {
        return {
            id: sub.id,
            plan: sub.plan as Plan,
            status: sub.status,
            billingInterval: (sub as any).billingInterval as BillingInterval || 'MONTHLY',
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            discountPercent: (sub as any).discountPercent ?? 0,
            priceAtPurchase: (sub as any).priceAtPurchase ?? 0,
            adminGranted: (sub as any).adminGranted ?? false,
            promoCode: sub.promoCode ? {
                code: sub.promoCode.code,
                discountPercent: sub.promoCode.discountPercent,
            } : null,
            createdAt: sub.createdAt,
        };
    }

    // Virtual FREE subscription
    return {
        id: '',
        plan: 'FREE',
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        discountPercent: 0,
        priceAtPurchase: 0,
        adminGranted: false,
        promoCode: null,
        createdAt: new Date(),
    };
}

// ============================================================================
// PROMO CODE
// ============================================================================

export interface PromoValidation {
    valid: boolean;
    error?: string;
    discountPercent?: number;
    promoCodeId?: string;
    originalPrice?: number;
    discountedPrice?: number;
}

/**
 * Validate a promo code for a given plan and interval.
 */
export async function validatePromoCode(
    code: string,
    plan: Plan,
    interval: BillingInterval = 'MONTHLY',
): Promise<PromoValidation> {
    const promo = await prisma.promoCode.findUnique({
        where: { code: code.toUpperCase().trim() },
    });

    if (!promo) {
        return { valid: false, error: 'Promo code not found' };
    }
    if (!promo.active) {
        return { valid: false, error: 'Promo code is no longer active' };
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
        return { valid: false, error: 'Promo code has expired' };
    }
    if (promo.timesRedeemed >= promo.maxRedemptions) {
        return { valid: false, error: 'Promo code has reached maximum redemptions' };
    }
    if (!promo.applicablePlans.includes(plan)) {
        return { valid: false, error: `Promo code is not valid for the ${plan} plan` };
    }

    const basePrice = getPlanPrice(plan, interval);
    const discountedPrice = applyDiscount(basePrice, promo.discountPercent);

    return {
        valid: true,
        discountPercent: promo.discountPercent,
        promoCodeId: promo.id,
        originalPrice: basePrice,
        discountedPrice,
    };
}

// ============================================================================
// SUBSCRIBE
// ============================================================================

export interface SubscribeResult {
    success: boolean;
    subscription?: SubscriptionInfo;
    invoice?: { id: string; amount: number; status: string };
    error?: string;
}

/**
 * Subscribe a user to a plan (local mode — no Stripe).
 * Creates subscription + invoice in a transaction.
 */
export async function subscribe(
    userId: string,
    plan: Plan,
    interval: BillingInterval = 'MONTHLY',
    promoCode?: string,
): Promise<SubscribeResult> {
    // FREE plan doesn't need payment
    if (plan === 'FREE') {
        return { success: false, error: 'Cannot subscribe to the Free plan — it is the default' };
    }

    // Check if user already has this plan
    const existing = await getUserSubscription(userId);
    if (existing.plan === plan && existing.status === 'ACTIVE' && existing.id) {
        return { success: false, error: `You are already on the ${plan} plan` };
    }

    // Validate promo if provided
    let promoData: PromoValidation | null = null;
    if (promoCode) {
        promoData = await validatePromoCode(promoCode, plan, interval);
        if (!promoData.valid) {
            return { success: false, error: promoData.error };
        }
    }

    const basePrice = getPlanPrice(plan, interval);
    const discountPercent = promoData?.discountPercent ?? 0;
    const finalPrice = promoData ? promoData.discountedPrice! : basePrice;
    const { start, end } = computePeriodDates(interval);

    const result = await prisma.$transaction(async (tx) => {
        // Cancel any existing active subscription
        await tx.subscription.updateMany({
            where: { userId, status: 'ACTIVE' },
            data: { status: 'CANCELED' },
        });

        // Create new subscription
        const sub = await tx.subscription.create({
            data: {
                userId,
                plan,
                status: 'ACTIVE',
                billingInterval: interval,
                currentPeriodStart: start,
                currentPeriodEnd: end,
                promoCodeId: promoData?.promoCodeId || null,
                discountPercent,
                priceAtPurchase: finalPrice,
            },
        });

        // Increment promo usage
        if (promoData?.promoCodeId) {
            await tx.promoCode.update({
                where: { id: promoData.promoCodeId },
                data: { timesRedeemed: { increment: 1 } },
            });
        }

        // Create invoice (auto-PAID in local mode)
        const invoice = await tx.invoice.create({
            data: {
                userId,
                amount: finalPrice,
                status: 'PAID',
                description: `${plan} plan — ${interval.toLowerCase()}${discountPercent > 0 ? ` (${discountPercent}% off)` : ''}`,
                planSnapshot: plan,
                discountPercent,
                paidAt: new Date(),
            },
        });

        return { sub, invoice };
    });

    // Fire notification (async — don't block response)
    const previousPlan = existing.plan;
    notifyPlanChanged(userId, previousPlan, plan).catch(console.error);

    return {
        success: true,
        subscription: {
            id: result.sub.id,
            plan: result.sub.plan as Plan,
            status: result.sub.status,
            billingInterval: interval,
            currentPeriodStart: result.sub.currentPeriodStart,
            currentPeriodEnd: result.sub.currentPeriodEnd,
            cancelAtPeriodEnd: result.sub.cancelAtPeriodEnd,
            discountPercent,
            priceAtPurchase: finalPrice,
            adminGranted: false,
            promoCode: promoData ? { code: promoCode!, discountPercent } : null,
            createdAt: result.sub.createdAt,
        },
        invoice: {
            id: result.invoice.id,
            amount: result.invoice.amount,
            status: result.invoice.status,
        },
    };
}

// ============================================================================
// CANCEL
// ============================================================================

/**
 * Cancel a user's subscription. Sets cancelAtPeriodEnd so they keep access
 * until the current billing period ends.
 */
export async function cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
        return { success: false, error: 'No active subscription found' };
    }
    if (sub.plan === 'FREE') {
        return { success: false, error: 'Cannot cancel the free plan' };
    }
    if (sub.cancelAtPeriodEnd) {
        return { success: false, error: 'Subscription is already set to cancel' };
    }

    await prisma.subscription.update({
        where: { id: sub.id },
        data: {
            cancelAtPeriodEnd: true,
            status: 'CANCELED',
        },
    });

    // Notify user of cancellation (async)
    if (sub.currentPeriodEnd) {
        notifySubscriptionCancelled(userId, sub.plan, sub.currentPeriodEnd).catch(console.error);
    }

    return { success: true };
}

// ============================================================================
// ADMIN: UPGRADE / DOWNGRADE
// ============================================================================

/**
 * Admin grants or changes a user's plan for free (no payment).
 * Creates a $0 invoice and audit log.
 */
export async function adminSetPlan(
    userId: string,
    plan: Plan,
    adminId: string,
    reason?: string,
): Promise<{ success: boolean; error?: string }> {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return { success: false, error: 'User not found' };
    }

    const { start, end } = computePeriodDates('MONTHLY');

    await prisma.$transaction(async (tx) => {
        // Cancel existing active subscriptions
        await tx.subscription.updateMany({
            where: { userId, status: 'ACTIVE' },
            data: { status: 'CANCELED' },
        });

        // Create admin-granted subscription
        if (plan !== 'FREE') {
            await tx.subscription.create({
                data: {
                    userId,
                    plan,
                    status: 'ACTIVE',
                    billingInterval: 'MONTHLY',
                    currentPeriodStart: start,
                    currentPeriodEnd: end,
                    priceAtPurchase: 0,
                    adminGranted: true,
                    adminGrantedBy: adminId,
                    adminGrantReason: reason || 'Admin upgrade',
                },
            });

            // $0 invoice for audit trail
            await tx.invoice.create({
                data: {
                    userId,
                    amount: 0,
                    status: 'PAID',
                    description: `${plan} plan — admin granted${reason ? `: ${reason}` : ''}`,
                    planSnapshot: plan,
                    discountPercent: 100,
                    paidAt: new Date(),
                },
            });
        }
    });

    // Audit log
    await logAuditEvent('ADMIN_SET_USER_PLAN', adminId, {
        targetUserId: userId,
        targetEmail: user.email,
        newPlan: plan,
        reason: reason || 'Admin upgrade',
    });

    // Notify user (async)
    notifyPlanChanged(userId, 'previous', plan, true).catch(console.error);

    return { success: true };
}

// ============================================================================
// APPLY PROMO TO EXISTING SUBSCRIPTION
// ============================================================================

/**
 * Apply a promo code to a user's current active subscription.
 * Only works if no promo is already applied.
 */
export async function applyPromoToSubscription(
    userId: string,
    code: string,
): Promise<{ success: boolean; newPrice?: number; error?: string }> {
    const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
        return { success: false, error: 'No active subscription found' };
    }
    if (sub.plan === 'FREE') {
        return { success: false, error: 'Cannot apply promo to the free plan' };
    }
    if (sub.promoCodeId) {
        return { success: false, error: 'A promo code is already applied to this subscription' };
    }

    const validation = await validatePromoCode(
        code,
        sub.plan as Plan,
        ((sub as any).billingInterval as BillingInterval) || 'MONTHLY',
    );
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
            where: { id: sub.id },
            data: {
                promoCodeId: validation.promoCodeId!,
                discountPercent: validation.discountPercent!,
                priceAtPurchase: validation.discountedPrice!,
            },
        });

        await tx.promoCode.update({
            where: { id: validation.promoCodeId! },
            data: { timesRedeemed: { increment: 1 } },
        });
    });

    return { success: true, newPrice: validation.discountedPrice };
}

// ============================================================================
// BILLING STATS (Admin)
// ============================================================================

export interface BillingStats {
    totalSubscribers: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
    activePromoCodes: number;
    totalPromoRedemptions: number;
    mrr: number; // Monthly recurring revenue in cents
    recentSubscriptions: Array<{
        id: string;
        userEmail: string;
        plan: string;
        status: string;
        priceAtPurchase: number;
        adminGranted: boolean;
        createdAt: Date;
    }>;
}

export async function getBillingStats(): Promise<BillingStats> {
    const [allSubs, promoCodes, recentSubs] = await Promise.all([
        prisma.subscription.findMany({
            select: {
                plan: true,
                status: true,
                priceAtPurchase: true,
                billingInterval: true,
            },
        }),
        prisma.promoCode.findMany({
            select: { active: true, timesRedeemed: true },
        }),
        prisma.subscription.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                plan: true,
                status: true,
                priceAtPurchase: true,
                adminGranted: true,
                createdAt: true,
                user: { select: { email: true } },
            },
        }),
    ]);

    const byPlan: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let mrr = 0;

    for (const sub of allSubs) {
        byPlan[sub.plan] = (byPlan[sub.plan] || 0) + 1;
        byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;
        if (sub.status === 'ACTIVE') {
            // Normalize yearly to monthly for MRR
            const monthly = (sub as any).billingInterval === 'YEARLY'
                ? Math.round((sub as any).priceAtPurchase / 12)
                : (sub as any).priceAtPurchase;
            mrr += monthly;
        }
    }

    return {
        totalSubscribers: allSubs.length,
        byPlan,
        byStatus,
        activePromoCodes: promoCodes.filter(p => p.active).length,
        totalPromoRedemptions: promoCodes.reduce((sum, p) => sum + p.timesRedeemed, 0),
        mrr,
        recentSubscriptions: recentSubs.map(s => ({
            id: s.id,
            userEmail: s.user.email,
            plan: s.plan,
            status: s.status,
            priceAtPurchase: (s as any).priceAtPurchase ?? 0,
            adminGranted: (s as any).adminGranted ?? false,
            createdAt: s.createdAt,
        })),
    };
}
