/**
 * Admin Dashboard
 * Platform overview with key metrics and insights
 */

import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { StatsCard } from '@/components/portal/dashboard/stats-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

async function getAdminStats() {
    // Total users
    const totalUsers = await prisma.user.count();
    const adminUsers = await prisma.user.count({ where: { role: 'ADMIN' } });

    // Active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
        where: { status: 'ACTIVE' },
    });

    // Subscription breakdown
    const subsByPlan = await prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: true,
    });

    // Total API keys
    const totalApiKeys = await prisma.apiKey.count();

    // Last 24h usage
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const usage24h = await prisma.usageLog.count({
        where: { timestamp: { gte: last24h } },
    });

    // Average response time (last 1000 requests)
    const recentLogs = await prisma.usageLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 1000,
        select: { responseTime: true },
    });
    const avgResponseTime = recentLogs.length > 0
        ? Math.round(recentLogs.reduce((sum, log) => sum + log.responseTime, 0) / recentLogs.length)
        : 0;

    // Error rate (last 1000)
    const errors = recentLogs.filter(log => log.responseTime === 0).length; // Simplified
    const errorRate = recentLogs.length > 0 ? (errors / recentLogs.length) * 100 : 0;

    // Recent users (last 10)
    const recentUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: {
                select: { apiKeys: true },
            },
        },
    });

    // Revenue this month (simplified - just count PAID invoices)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthRevenue = await prisma.invoice.aggregate({
        where: {
            status: 'PAID',
            paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
    });

    const revenue = (monthRevenue._sum.amount || 0) / 100; // Convert cents to dollars

    return {
        totalUsers,
        adminUsers,
        activeSubscriptions,
        subsByPlan: subsByPlan.map(s => ({ plan: s.plan, count: s._count })),
        totalApiKeys,
        usage24h,
        avgResponseTime,
        errorRate,
        recentUsers,
        revenue,
    };
}

export default async function AdminDashboardPage() {
    const session = await auth();
    const stats = await getAdminStats();

    return (
        <div style={{ padding: 'var(--space-6)' }}>
            <div className="page-header">
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="page-description">Platform overview and key metrics</p>
            </div>

            {/* Key Metrics */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                <StatsCard
                    title="Total Users"
                    value={stats.totalUsers}
                    description={`${stats.adminUsers} admins`}
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 3a4 4 0 100 8 4 4 0 000-8zM4 17a6 6 0 0112 0" />
                        </svg>
                    }
                />

                <StatsCard
                    title="Active Subscriptions"
                    value={stats.activeSubscriptions}
                    description={`$${stats.revenue.toFixed(2)} this month`}
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="7" width="14" height="10" rx="2" />
                            <path d="M3 11h14M7 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                        </svg>
                    }
                />

                <StatsCard
                    title="API Keys"
                    value={stats.totalApiKeys}
                    description="Total active keys"
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="10" cy="7" r="3" />
                            <path d="M10 10v7M7 14h6M8 17h4" />
                        </svg>
                    }
                />

                <StatsCard
                    title="Requests (24h)"
                    value={stats.usage24h.toLocaleString()}
                    description={`${stats.avgResponseTime}ms avg`}
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 17V9l4-4 4 4 6-6v14H3z" />
                        </svg>
                    }
                />
            </div>

            {/* Subscription Breakdown */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Subscription Breakdown</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    {stats.subsByPlan.map((sub) => (
                        <div
                            key={sub.plan}
                            style={{
                                padding: 'var(--space-4)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                        >
                            <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }}>
                                {sub.plan}
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--white)' }}>
                                {sub.count}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Users */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title">Recent Users</h3>
                    <Link href="/admin/users" style={{ fontSize: '14px', color: 'var(--blue-light)', textDecoration: 'none' }}>
                        View All →
                    </Link>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>API Keys</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recentUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.name || 'N/A'}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <Badge variant={user.role === 'ADMIN' ? 'warning' : 'neutral'}>
                                            {user.role}
                                        </Badge>
                                    </td>
                                    <td>{user._count.apiKeys}</td>
                                    <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
