/**
 * Usage Analytics Page with Charts
 * Full integration with new usage APIs and chart components
 */

'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/portal/charts/LineChart';
import { BarChart } from '@/components/portal/charts/BarChart';

interface UsageStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalCost: number;
    averageResponseTime: number;
    requestsByEndpoint: Record<string, number>;
    requestsByDay: Array<{ date: string; count: number }>;
}

interface UsageLog {
    id: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    apiKeyName: string;
    apiKeyPrefix: string;
    timestamp: string;
    cost: number;
}

export default function UsagePage() {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [logs, setLogs] = useState<UsageLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [page, setPage] = useState(1);

    const fetchStats = async () => {
        try {
            const response = await fetch(`/api/portal/usage/stats?period=${period}`);
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            const response = await fetch(`/api/portal/usage/logs?page=${page}&limit=50`);
            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchLogs();
    }, [period, page]);

    const handleExport = async () => {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90));

        const url = `/api/portal/usage/export?format=csv&startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`;
        window.location.href = url;
    };

    const successRate = stats ? (stats.totalRequests > 0 ? (stats.successfulRequests / stats.totalRequests) * 100 : 0) : 0;

    // Prepare chart data
    const endpointChartData = stats ? Object.entries(stats.requestsByEndpoint).map(([name, value]) => ({
        name: name.split('/').pop() || name,
        value,
    })) : [];

    const dailyChartData = stats?.requestsByDay.map(day => ({
        name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: day.count,
    })) || [];

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h1 className="page-title">Usage Analytics</h1>
                        <p className="page-description">Monitor your API usage and performance</p>
                    </div>
                    <Button variant="primary" onClick={handleExport}>
                        📥 Export CSV
                    </Button>
                </div>
            </div>

            {/* Period Selector */}
            <div style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-2)' }}>
                {(['7d', '30d', '90d'] as const).map((p) => (
                    <Button
                        key={p}
                        variant={period === p ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setPeriod(p)}
                    >
                        {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
                    </Button>
                ))}
            </div>

            {/* Summary Stats */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="stats-card">
                    <p className="stats-card-title">Total Requests</p>
                    <div className="stats-card-value">{stats?.totalRequests.toLocaleString() || '0'}</div>
                    <p className="stats-card-description">
                        {period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'Last 90 days'}
                    </p>
                </div>

                <div className="stats-card">
                    <p className="stats-card-title">Success Rate</p>
                    <div className="stats-card-value">{successRate.toFixed(1)}%</div>
                    <p className="stats-card-description">
                        {stats?.successfulRequests.toLocaleString() || '0'} successful
                    </p>
                </div>

                <div className="stats-card">
                    <p className="stats-card-title">Avg Response Time</p>
                    <div className="stats-card-value">{stats?.averageResponseTime || 0}ms</div>
                    <p className="stats-card-description">Across all requests</p>
                </div>

                <div className="stats-card">
                    <p className="stats-card-title">Total Cost</p>
                    <div className="stats-card-value">${((stats?.totalCost || 0) / 100).toFixed(2)}</div>
                    <p className="stats-card-description">This period</p>
                </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                {/* Requests Over Time */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Requests Over Time</h3>
                    <LineChart
                        data={dailyChartData}
                        height={250}
                        color="var(--blue)"
                        yAxisLabel="Requests"
                    />
                </div>

                {/* By Endpoint */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Requests by Endpoint</h3>
                    <BarChart
                        data={endpointChartData}
                        height={250}
                        color="var(--green)"
                    />
                </div>
            </div>

            {/* Request Logs */}
            <div className="card">
                <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Recent Requests</h3>

                {isLoading ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        Loading logs...
                    </p>
                ) : logs.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        No API requests yet
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Endpoint</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                    <th>Response Time</th>
                                    <th>Cost</th>
                                    <th>API Key</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                                            {log.endpoint}
                                        </td>
                                        <td>
                                            <Badge variant="neutral" style={{ fontSize: '11px' }}>
                                                {log.method}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge
                                                variant={
                                                    log.statusCode < 300 ? 'success' :
                                                        log.statusCode < 400 ? 'info' :
                                                            log.statusCode < 500 ? 'warning' :
                                                                'error'
                                                }
                                            >
                                                {log.statusCode}
                                            </Badge>
                                        </td>
                                        <td style={{ fontSize: '13px' }}>{log.responseTime}ms</td>
                                        <td style={{ fontSize: '13px' }}>${(log.cost / 100).toFixed(3)}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                                            {log.apiKeyPrefix}...
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
