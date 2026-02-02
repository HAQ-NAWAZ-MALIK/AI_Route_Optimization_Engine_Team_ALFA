/**
 * Subscription Plans Configuration
 * Defines tiers, limits, and pricing
 * Plan quotas can be overridden by admin via PlatformConfig
 */

import { SubscriptionPlan } from '@prisma/client';
import { getEffectivePlanLimits } from '@/lib/config/platform-config';

export interface PlanFeatures {
    requestsPerMonth: number;
    maxLocationsPerRequest: number;
    maxCabsPerRequest: number;
    algorithms: string[];
    traffic: boolean;
    alternatives: boolean;
    prioritySupport: boolean;
    sla: boolean;
    webhooks: boolean;
    priceMonthly: number; // USD cents
    priceYearly: number; // USD cents (usually ~20% discount)
}

export const PLANS: Record<SubscriptionPlan, PlanFeatures> = {
    [SubscriptionPlan.FREE]: {
        requestsPerMonth: 100,
        maxLocationsPerRequest: 10,
        maxCabsPerRequest: 2,
        algorithms: ['nearest_neighbor'],
        traffic: false,
        alternatives: false,
        prioritySupport: false,
        sla: false,
        webhooks: false,
        priceMonthly: 0,
        priceYearly: 0,
    },

    [SubscriptionPlan.TRIAL]: {
        requestsPerMonth: 1000,
        maxLocationsPerRequest: 50,
        maxCabsPerRequest: 10,
        algorithms: ['nearest_neighbor', 'christofides', 'genetic_algorithm'],
        traffic: true,
        alternatives: true,
        prioritySupport: false,
        sla: false,
        webhooks: false,
        priceMonthly: 0,
        priceYearly: 0,
    },

    [SubscriptionPlan.PRO]: {
        requestsPerMonth: 10000,
        maxLocationsPerRequest: 100,
        maxCabsPerRequest: 50,
        algorithms: ['nearest_neighbor', 'christofides', 'genetic_algorithm', 'exhaustive'],
        traffic: true,
        alternatives: true,
        prioritySupport: true,
        sla: false,
        webhooks: true,
        priceMonthly: 4900, // $49/mo
        priceYearly: 47040, // $392/yr (20% discount)
    },

    [SubscriptionPlan.ENTERPRISE]: {
        requestsPerMonth: -1, // Unlimited
        maxLocationsPerRequest: 500,
        maxCabsPerRequest: 200,
        algorithms: ['nearest_neighbor', 'christofides', 'genetic_algorithm', 'exhaustive'],
        traffic: true,
        alternatives: true,
        prioritySupport: true,
        sla: true,
        webhooks: true,
        priceMonthly: 49900, // $499/mo
        priceYearly: 479040, // $3,992/yr (20% discount)
    },
};

/**
 * Check if a plan allows a specific feature
 */
export function planHasFeature(
    plan: SubscriptionPlan,
    feature: keyof PlanFeatures
): boolean {
    return !!PLANS[plan][feature];
}

/**
 * Get usage limits for a plan (reads from DB config with hardcoded fallback)
 */
export async function getPlanLimits(plan: SubscriptionPlan) {
    try {
        const dbLimits = await getEffectivePlanLimits(plan);
        return {
            requestsPerMonth: dbLimits.requestsPerMonth,
            maxLocationsPerRequest: dbLimits.maxLocations,
            maxCabsPerRequest: dbLimits.maxCabs,
        };
    } catch {
        return {
            requestsPerMonth: PLANS[plan].requestsPerMonth,
            maxLocationsPerRequest: PLANS[plan].maxLocationsPerRequest,
            maxCabsPerRequest: PLANS[plan].maxCabsPerRequest,
        };
    }
}

/**
 * Check if usage is within plan limits (reads from DB config with hardcoded fallback)
 */
export async function isWithinPlanLimits(
    plan: SubscriptionPlan,
    currentUsage: number,
    locationsCount: number,
    cabsCount: number
): Promise<{
    allowed: boolean;
    reason?: string;
}> {
    const limits = await getPlanLimits(plan);

    // Check monthly request limit (unlimited = -1)
    if (limits.requestsPerMonth !== -1 && currentUsage >= limits.requestsPerMonth) {
        return {
            allowed: false,
            reason: `Monthly request limit (${limits.requestsPerMonth}) exceeded`,
        };
    }

    // Check locations limit
    if (locationsCount > limits.maxLocationsPerRequest) {
        return {
            allowed: false,
            reason: `Location count (${locationsCount}) exceeds plan limit (${limits.maxLocationsPerRequest})`,
        };
    }

    // Check cabs limit
    if (cabsCount > limits.maxCabsPerRequest) {
        return {
            allowed: false,
            reason: `Cab count (${cabsCount}) exceeds plan limit (${limits.maxCabsPerRequest})`,
        };
    }

    return { allowed: true };
}

/**
 * Get human-readable plan name
 */
export function getPlanDisplayName(plan: SubscriptionPlan): string {
    const names: Record<SubscriptionPlan, string> = {
        [SubscriptionPlan.FREE]: 'Free',
        [SubscriptionPlan.TRIAL]: 'Trial',
        [SubscriptionPlan.PRO]: 'Professional',
        [SubscriptionPlan.ENTERPRISE]: 'Enterprise',
    };
    return names[plan];
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}
