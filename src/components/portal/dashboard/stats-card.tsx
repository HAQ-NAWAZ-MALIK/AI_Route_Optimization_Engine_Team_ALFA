/**
 * Stats Card Component
 * Displays key metrics with icon and trend
 */

import { ReactNode } from 'react';

interface StatsCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon: ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function StatsCard({ title, value, description, icon, trend }: StatsCardProps) {
    return (
        <div className="stats-card">
            <div className="stats-card-header">
                <div className="stats-card-icon">{icon}</div>
                <p className="stats-card-title">{title}</p>
            </div>
            <div className="stats-card-value">{value}</div>
            {description && <p className="stats-card-description">{description}</p>}
            {trend && (
                <div className={`stats-card-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
                    {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </div>
            )}
        </div>
    );
}
