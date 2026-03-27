/**
 * Admin Analytics Dashboard
 * Real-time platform analytics using backend metrics
 */

import { LineChart } from '@/components/portal/charts/LineChart';
import { BarChart } from '@/components/portal/charts/BarChart';
import { PieChart } from '@/components/portal/charts/PieChart';
import {
    getRevenueMetrics,
    getUsageMetrics,
    getUserMetrics,
    getErrorMetrics,
} from '@/lib/analytics/metrics';

export default async function AnalyticsPage() {
    // Fetch real data from backend
    const [revenue, usage, users, errors] = await Promise.all([
        getRevenueMetrics(),
        getUsageMetrics(),
        getUserMetrics(),
        getErrorMetrics(),
    ]);

    // Prepare chart data
    const planRevenueData = Object.entries(revenue.revenueByPlan).map(([name, value]) => ({
        name,
        value: value / 100, // Convert cents to dollars
    }));

    const endpointUsageData = Object.entries(usage.requestsByEndpoint)
        .map(([name, value]) => ({
            name: name.split('/').pop() || name,
            value,
        }))
        .sort((a, b) => b.value - a.value);

    const usersByPlanData = Object.entries(users.usersByPlan).map(([name, value]) => ({
        name,
        value,
    }));

    const errorTypeData = Object.entries(errors.errorsByType).map(([name, value]) => ({
        name,
        value,
    }));

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Analytics Dashboard</h1>
                <p className="page-description">Platform-wide metrics and insights</p>
            </div>

            {/* Key Metrics */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="stats-card">
                    <p className="stats-card-title">Monthly Recurring Revenue</p>
                    <div className="stats-card-value">${(revenue.mrr / 100).toFixed(2)}</div>
                    <p className="stats-card-description">
                        ARR: ${(revenue.arr / 100).toFixed(2)}
                    </p>
                </div>

                <div className="stats-card">
                    <p className="stats-card-title">Total Users</p>
                    <div className="stats-card-value">{users.totalUsers}</div>
                    <p className="stats-card-description">
                        {users.activeUsers} active ({users.totalUsers > 0 ? ((users.activeUsers / users.totalUsers) * 100).toFixed(1) : 0}%)
                    </p>
                </div>

                <div className="stats-card">
                    <p className="stats-card-title">Total Requests</p>
                    <div className="stats-card-value">{usage.totalRequests.toLocaleString()}</div>
                    <p className="stats-card-description">
                        {usage.requestsThisMonth.toLocaleString()} this month
                    </p>
                </div>

                <div className="stats-card">
                    <p className="stats-card-title">Error Rate</p>
                    <div className="stats-card-value">{errors.errorRate.toFixed(1)}%</div>
                    <p className="stats-card-description">
                        {errors.totalErrors.toLocaleString()} errors this month
                    </p>
                </div>
            </div>

            {/* Growth Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-2)' }}>Revenue Growth</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--white)' }}>
                            {revenue.revenueGrowth > 0 ? '+' : ''}{revenue.revenueGrowth.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>vs last month</span>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-2)' }}>User Growth</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--white)' }}>
                            {users.userGrowthRate > 0 ? '+' : ''}{users.userGrowthRate.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                            {users.newUsersThisMonth} new users this month
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            {(planRevenueData.length > 0 || endpointUsageData.length > 0 || usersByPlanData.length > 0 || errorTypeData.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                    {/* Revenue by Plan */}
                    {planRevenueData.length > 0 && (
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Revenue by Plan</h3>
                            <BarChart
                                data={planRevenueData}
                                height={250}
                                color="var(--blue)"
                            />
                        </div>
                    )}

                    {/* Users by Plan */}
                    {usersByPlanData.length > 0 && (
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Users by Plan</h3>
                            <PieChart
                                data={usersByPlanData}
                                height={250}
                            />
                        </div>
                    )}

                    {/* Requests by Endpoint */}
                    {endpointUsageData.length > 0 && (
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Requests by Endpoint</h3>
                            <BarChart
                                data={endpointUsageData}
                                height={250}
                                color="var(--green)"
                            />
                        </div>
                    )}

                    {/* Error Types */}
                    {errorTypeData.length > 0 && (
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Error Distribution</h3>
                            <PieChart
                                data={errorTypeData}
                                height={250}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Performance Metrics */}
            <div className="card">
                <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Performance Metrics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <div style={{ padding: 'var(--space-4)', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: 'var(--space-1)' }}>
                            Avg Response Time
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--white)' }}>
                            {usage.averageResponseTime}ms
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-4)', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: 'var(--space-1)' }}>
                            Requests Today
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--white)' }}>
                            {usage.requestsToday.toLocaleString()}
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-4)', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: 'var(--space-1)' }}>
                            Success Rate
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--white)' }}>
                            {(100 - errors.errorRate).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
