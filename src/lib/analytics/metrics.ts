/**
 * Analytics Metrics Aggregation
 * Functions for calculating platform-wide statistics
 */

import { prisma } from '@/lib/db/prisma';

/**
 * Get revenue metrics for admin dashboard
 */
export async function getRevenueMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: {
            user: { select: { email: true } },
        },
    });

    // Calculate MRR (Monthly Recurring Revenue)
    const planPrices: Record<string, number> = {
        FREE: 0,
        PRO: 4900, // $49/month in cents
        ENTERPRISE: 19900, // $199/month
    };

    const mrr = activeSubscriptions.reduce((sum, sub) => {
        return sum + (planPrices[sub.plan] || 0);
    }, 0);

    const arr = mrr * 12;

    // Revenue by plan
    const revenueByPlan = activeSubscriptions.reduce((acc, sub) => {
        const plan = sub.plan;
        acc[plan] = (acc[plan] || 0) + (planPrices[plan] || 0);
        return acc;
    }, {} as Record<string, number>);

    // Get total paid invoices this month
    const thisMonthRevenue = await prisma.invoice.aggregate({
        where: {
            status: 'PAID',
            paidAt: {
                gte: startOfMonth,
            },
        },
        _sum: { amount: true },
    });

    // Last month's revenue
    const lastMonthRevenue = await prisma.invoice.aggregate({
        where: {
            status: 'PAID',
            paidAt: {
                gte: startOfLastMonth,
                lte: endOfLastMonth,
            },
        },
        _sum: { amount: true },
    });

    const thisMonth = thisMonthRevenue._sum.amount || 0;
    const lastMonth = lastMonthRevenue._sum.amount || 0;
    const revenueGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return {
        mrr,  // Monthly Recurring Revenue
        arr,  // Annual Recurring Revenue
        totalRevenue: thisMonth,
        revenueByPlan,
        revenueGrowth,
    };
}

/**
 * Get usage metrics for admin dashboard
 */
export async function getUsageMetrics() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total requests
    const totalRequests = await prisma.usageLog.count();

    // Requests today
    const requestsToday = await prisma.usageLog.count({
        where: {
            timestamp: { gte: startOfDay },
        },
    });

    // Requests this month
    const requestsThisMonth = await prisma.usageLog.count({
        where: {
            timestamp: { gte: startOfMonth },
        },
    });

    // Requests by endpoint
    const byEndpoint = await prisma.usageLog.groupBy({
        by: ['endpoint'],
        _count: { id: true },
        where: {
            timestamp: { gte: startOfMonth },
        },
    });

    const requestsByEndpoint = byEndpoint.reduce((acc, item) => {
        acc[item.endpoint] = item._count.id;
        return acc;
    }, {} as Record<string, number>);

    // Average response time
    const avgResponseTime = await prisma.usageLog.aggregate({
        where: {
            timestamp: { gte: startOfMonth },
        },
        _avg: { responseTime: true },
    });

    return {
        totalRequests,
        requestsToday,
        requestsThisMonth,
        requestsByEndpoint,
        averageResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
    };
}

/**
 * Get user metrics for admin dashboard
 */
export async function getUserMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Total users
    const totalUsers = await prisma.user.count();

    // New users this month
    const newUsersThisMonth = await prisma.user.count({
        where: {
            createdAt: { gte: startOfMonth },
        },
    });

    // New users last month
    const newUsersLastMonth = await prisma.user.count({
        where: {
            createdAt: {
                gte: startOfLastMonth,
                lt: startOfMonth,
            },
        },
    });

    const userGrowthRate = newUsersLastMonth > 0
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
        : 0;

    // Active users (with API keys)
    const activeUsers = await prisma.user.count({
        where: {
            apiKeys: {
                some: {}, // Users who have at least one API key
            },
        },
    });

    // Users by plan
    const subscriptions = await prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
    });

    const usersByPlan = subscriptions.reduce((acc, item) => {
        acc[item.plan] = item._count.id;
        return acc;
    }, {} as Record<string, number>);

    // Add free tier users (users without active subscription)
    const freeUsers = totalUsers - Object.values(usersByPlan).reduce((sum, count) => sum + count, 0);
    usersByPlan['FREE'] = freeUsers;

    return {
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        userGrowthRate,
        usersByPlan,
    };
}

/**
 * Get error metrics for admin dashboard
 */
export async function getErrorMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total errors (4xx + 5xx)
    const totalErrors = await prisma.usageLog.count({
        where: {
            statusCode: { gte: 400 },
            timestamp: { gte: startOfMonth },
        },
    });

    // Total requests this month
    const totalRequests = await prisma.usageLog.count({
        where: { timestamp: { gte: startOfMonth } },
    });

    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Errors by endpoint
    const byEndpoint = await prisma.usageLog.groupBy({
        by: ['endpoint'],
        where: {
            statusCode: { gte: 400 },
            timestamp: { gte: startOfMonth },
        },
        _count: { id: true },
    });

    const errorsByEndpoint = byEndpoint.reduce((acc, item) => {
        acc[item.endpoint] = item._count.id;
        return acc;
    }, {} as Record<string, number>);

    // Errors by type (4xx vs 5xx)
    const clientErrors = await prisma.usageLog.count({
        where: {
            statusCode: { gte: 400, lt: 500 },
            timestamp: { gte: startOfMonth },
        },
    });

    const serverErrors = await prisma.usageLog.count({
        where: {
            statusCode: { gte: 500 },
            timestamp: { gte: startOfMonth },
        },
    });

    const errorsByType = {
        'Client Errors (4xx)': clientErrors,
        'Server Errors (5xx)': serverErrors,
    };

    return {
        totalErrors,
        errorRate,
        errorsByEndpoint,
        errorsByType,
    };
}
