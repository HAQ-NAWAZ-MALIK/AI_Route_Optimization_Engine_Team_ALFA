/**
 * Plan Card Component with Stripe Integration
 * Displays subscription plan with features and handles upgrades
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlanFeature {
    text: string;
    included: boolean;
}

interface PlanCardProps {
    name: string;
    plan: 'FREE' | 'PRO' | 'ENTERPRISE';
    price: number;
    interval: string;
    description: string;
    features: PlanFeature[];
    isCurrentPlan?: boolean;
    isPopular?: boolean;
}

export function PlanCard({
    name,
    plan,
    price,
    interval,
    description,
    features,
    isCurrentPlan = false,
    isPopular = false,
}: PlanCardProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleUpgrade = async () => {
        if (plan === 'FREE') {
            return; // Free plan doesn't need checkout
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/portal/subscription/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan }),
            });

            const data = await response.json();

            if (data.success && data.checkoutUrl) {
                // Redirect to Stripe checkout
                window.location.href = data.checkoutUrl;
            } else {
                alert('Failed to create checkout session');
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Failed to create checkout:', error);
            alert('Failed to create checkout session');
            setIsLoading(false);
        }
    };

    return (
        <div
            className="card"
            style={{
                position: 'relative',
                padding: 'var(--space-8)',
                border: isPopular ? '2px solid var(--blue)' : undefined,
            }}
        >
            {isPopular && (
                <Badge variant="info" style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)' }}>
                    Popular
                </Badge>
            )}

            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                    {name}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{description}</p>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '48px', fontWeight: '700', color: 'var(--white)' }}>
                        ${price}
                    </span>
                    <span style={{ fontSize: '16px', color: 'var(--gray-400)' }}>/{interval}</span>
                </div>
            </div>

            <ul style={{ marginBottom: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {features.map((feature, index) => (
                    <li
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            fontSize: '14px',
                            color: feature.included ? 'var(--gray-300)' : 'var(--gray-500)',
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>
                            {feature.included ? '✓' : '✕'}
                        </span>
                        {feature.text}
                    </li>
                ))}
            </ul>

            {isCurrentPlan ? (
                <Button variant="ghost" style={{ width: '100%' }} disabled>
                    Current Plan
                </Button>
            ) : (
                <Button
                    variant={isPopular ? 'primary' : 'secondary'}
                    style={{ width: '100%' }}
                    onClick={handleUpgrade}
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : price === 0 ? 'Get Started' : 'Upgrade'}
                </Button>
            )}
        </div>
    );
}
