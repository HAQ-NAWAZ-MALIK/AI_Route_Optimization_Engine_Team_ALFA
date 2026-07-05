/**
 * Portal Subscription API
 * GET /api/portal/subscription — Current subscription details
 */

import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { getUserSubscription } from '@/lib/billing/subscription-service';
import { PLANS, getPlanLimits } from '@/lib/billing/plans';
import { getUsageSummary } from '@/lib/billing/usage-calculator';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
    try {
        const session = await requireAuth();
        const sub = await getUserSubscription(session.user.id);
        const limits = await getPlanLimits(sub.plan as any);
        const planFeatures = PLANS[sub.plan as keyof typeof PLANS];

        // Current month usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date();

        const usageCount = await prisma.usageLog.count({
            where: {
                userId: session.user.id,
                timestamp: { gte: startOfMonth },
                statusCode: { gte: 200, lt: 300 },
            },
        });
        const usageSummary = await getUsageSummary(session.user.id, startOfMonth, endOfMonth);

        const quota = limits.requestsPerMonth;
        const usagePercentage = quota === -1 ? 0 : Math.min((usageCount / quota) * 100, 100);

        return NextResponse.json({
            success: true,
            subscription: sub,
            usage: {
                current: usageCount,
                limit: quota,
                percentage: Math.round(usagePercentage),
                remaining: quota === -1 ? -1 : Math.max(0, quota - usageCount),
                totalCost: usageSummary.totalCost,
            },
            plan: {
                name: sub.plan,
                features: planFeatures,
                limits,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}
