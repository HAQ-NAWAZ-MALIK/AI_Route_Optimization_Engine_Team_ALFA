/**
 * Billing Usage Calculator
 * Calculate costs and check usage limits for billing integration
 */

import { prisma } from '@/lib/db/prisma';

// Pricing structure (in cents)
export const PRICING = {
    endpoints: {
        '/api/v1/optimize/route': 5,           // 5 cents per request
        '/api/v1/optimize/multi-cluster': 15,  // 15 cents
        '/api/v1/matrix/distance': 2,          // 2 cents
    } as Record<string, number>,

    plans: {
        FREE: { included: 100, overage: 10 },         // 100 requests/month, 10¢ overage
        PRO: { included: 10000, overage: 5 },         // 10k requests/month, 5¢ overage
        ENTERPRISE: { included: Infinity, overage: 0 }, // Unlimited
    },
};

/**
 * Calculate cost for a single API request
 */
export function calculateRequestCost(endpoint: string, plan: 'FREE' | 'PRO' | 'ENTERPRISE'): number {
    const baseCost = PRICING.endpoints[endpoint] || 0;

    // Enterprise gets better rates
    if (plan === 'ENTERPRISE') {
        return baseCost * 0.5; // 50% discount
    }

    // Pro gets small discount
    if (plan === 'PRO') {
        return baseCost * 0.8; // 20% discount
    }

    return baseCost;
}

/**
 * Get usage summary for a billing period
 */
export async function getUsageSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date
): Promise<{
    totalRequests: number;
    totalCost: number;
    costByEndpoint: Record<string, number>;
}> {
    // Get user's subscription to determine plan
    const subscription = await prisma.subscription.findFirst({
        where: {
            userId,
            status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
    });

    const plan = (subscription?.plan || 'FREE') as 'FREE' | 'PRO' | 'ENTERPRISE';

    // Get usage logs for period
    const logs = await prisma.usageLog.findMany({
        where: {
            userId,
            timestamp: {
                gte: periodStart,
                lte: periodEnd,
            },
            statusCode: {
                gte: 200,
                lt: 300, // Only count successful requests
            },
        },
        select: {
            endpoint: true,
        },
    });

    // Calculate costs
    let totalCost = 0;
    const costByEndpoint: Record<string, number> = {};

    for (const log of logs) {
        const cost = calculateRequestCost(log.endpoint, plan);
        totalCost += cost;

        if (!costByEndpoint[log.endpoint]) {
            costByEndpoint[log.endpoint] = 0;
        }
        costByEndpoint[log.endpoint] += cost;
    }

    return {
        totalRequests: logs.length,
        totalCost: Math.round(totalCost), // Round to whole cents
        costByEndpoint,
    };
}

/**
 * Check if user is approaching or exceeding usage limits
 */
export async function checkUsageLimit(userId: string): Promise<{
    limitReached: boolean;
    percentageUsed: number;
    requestsRemaining: number;
    resetsAt: Date;
}> {
    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
        where: {
            userId,
            status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
    });

    const plan = (subscription?.plan || 'FREE') as 'FREE' | 'PRO' | 'ENTERPRISE';
    const limits = PRICING.plans[plan];

    // Enterprise has no limits
    if (plan === 'ENTERPRISE') {
        return {
            limitReached: false,
            percentageUsed: 0,
            requestsRemaining: Infinity,
            resetsAt: new Date(subscription?.currentPeriodEnd || new Date()),
        };
    }

    // Calculate current billing period
    const now = new Date();
    const periodEnd = subscription?.currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);

    // Count requests in current period
    const requestCount = await prisma.usageLog.count({
        where: {
            userId,
            timestamp: {
                gte: periodStart,
                lte: now,
            },
            statusCode: {
                gte: 200,
                lt: 300,
            },
        },
    });

    const percentageUsed = (requestCount / limits.included) * 100;
    const requestsRemaining = Math.max(0, limits.included - requestCount);
    const limitReached = requestCount >= limits.included;

    return {
        limitReached,
        percentageUsed: Math.round(percentageUsed),
        requestsRemaining,
        resetsAt: periodEnd,
    };
}
