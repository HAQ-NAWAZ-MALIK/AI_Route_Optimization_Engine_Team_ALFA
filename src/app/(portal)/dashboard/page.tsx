/**
 * Dashboard Page
 * Overview of usage, stats, and quick actions
 */

import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { PLANS } from '@/lib/billing/plans';
import { StatsCard } from '@/components/portal/dashboard/stats-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

async function getDashboardData(userId: string) {
    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });

    // Get usage count for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageCount = await prisma.usageLog.count({
        where: {
            userId,
            timestamp: { gte: startOfMonth },
        },
    });

    // Get average response time
    const avgResponseTime = await prisma.usageLog.aggregate({
        where: {
            userId,
            timestamp: { gte: startOfMonth },
        },
        _avg: {
            responseTime: true,
        },
    });

    // Get recent API calls
    const recentCalls = await prisma.usageLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
            id: true,
            endpoint: true,
            method: true,
            statusCode: true,
            responseTime: true,
            timestamp: true,
        },
    });

    const plan = subscription ? PLANS[subscription.plan] : PLANS.FREE;
    const quota = plan.requestsPerMonth === -1 ? 'Unlimited' : plan.requestsPerMonth;
    const remaining = plan.requestsPerMonth === -1 ? 'Unlimited' : Math.max(0, plan.requestsPerMonth - usageCount);

    return {
        usageCount,
        quota,
        remaining,
        avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
        recentCalls,
        planName: subscription?.plan || 'FREE',
    };
}

export default async function DashboardPage() {
    const session = await auth();
    const userId = session!.user.id;

    const data = await getDashboardData(userId);

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">Welcome back, {session!.user.name || 'User'}!</h1>
                <p className="page-description">
                    Here's what's happening with your API usage today.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatsCard
                    title="API Calls This Month"
                    value={data.usageCount.toLocaleString()}
                    description={`${data.planName} Plan`}
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 17V9l4-4 4 4 6-6v14H3z" />
                        </svg>
                    }
                    trend={{ value: 12.5, isPositive: true }}
                />

                <StatsCard
                    title="Remaining Quota"
                    value={typeof data.remaining === 'number' ? data.remaining.toLocaleString() : data.remaining}
                    description={`of ${typeof data.quota === 'number' ? data.quota.toLocaleString() : data.quota}`}
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="10" cy="10" r="8" />
                            <path d="M10 6v8M6 10h8" />
                        </svg>
                    }
                />

                <StatsCard
                    title="Avg Response Time"
                    value={`${data.avgResponseTime}ms`}
                    description="Last 30 days"
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="10" cy="10" r="8" />
                            <path d="M10 5v5l3 3" />
                        </svg>
                    }
                    trend={{ value: 8.2, isPositive: false }}
                />
            </div>

            {/* Recent Activity */}
            <div className="card" style={{ marginTop: 'var(--space-8)' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 className="card-title">Recent API Calls</h3>
                        <p className="card-description">Your latest requests</p>
                    </div>
                    <Link href="/usage">
                        <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>Response Time</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentCalls.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                                        No API calls yet. <Link href="/api-keys" style={{ color: 'var(--blue-light)' }}>Create an API key</Link> to get started.
                                    </td>
                                </tr>
                            ) : (
                                data.recentCalls.map((call) => (
                                    <tr key={call.id}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{call.endpoint}</td>
                                        <td>
                                            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                                {call.method}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${call.statusCode < 300 ? 'success' : call.statusCode < 400 ? 'info' : 'error'}`}>
                                                {call.statusCode}
                                            </span>
                                        </td>
                                        <td>{call.responseTime}ms</td>
                                        <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
                                            {new Date(call.timestamp).toLocaleDateString()} {new Date(call.timestamp).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: 'var(--space-8)', display: 'flex', gap: 'var(--space-4)' }}>
                <Link href="/api-keys">
                    <Button variant="primary">Create API Key</Button>
                </Link>
                <Link href="https://docs.routeoptimizer.ai" target="_blank">
                    <Button variant="ghost">View Documentation</Button>
                </Link>
                <Link href="/billing">
                    <Button variant="ghost">Upgrade Plan</Button>
                </Link>
            </div>
        </div>
    );
}
