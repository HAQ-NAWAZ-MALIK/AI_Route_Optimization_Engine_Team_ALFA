/**
 * Bar Chart Component
 * Reusable bar chart using Recharts
 */

'use client';

import {
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

export interface BarChartProps {
    data: Array<{ name: string; value: number }>;
    height?: number;
    color?: string;
    showGrid?: boolean;
}

export function BarChart({
    data,
    height = 300,
    color = '#10b981',
    showGrid = true,
}: BarChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsBarChart data={data}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
                <XAxis
                    dataKey="name"
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                />
                <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px',
                    }}
                />
                <Bar
                    dataKey="value"
                    fill={color}
                    radius={[4, 4, 0, 0]}
                />
            </RechartsBarChart>
        </ResponsiveContainer>
    );
}
