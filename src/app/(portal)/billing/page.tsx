/**
 * Billing Page (Portal)
 * Subscribe to plans, manage subscription, apply promo codes, view invoices
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// ─── Types ─────────────────────────────────────────────

interface SubscriptionData {
    subscription: {
        id: string;
        plan: string;
        status: string;
        billingInterval: string;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        discountPercent: number;
        priceAtPurchase: number;
        adminGranted: boolean;
        promoCode: { code: string; discountPercent: number } | null;
    };
    usage: {
        current: number;
        limit: number;
        percentage: number;
        remaining: number;
    };
    plan: {
        name: string;
        features: Record<string, any>;
        limits: Record<string, any>;
    };
}

interface Invoice {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    createdAt: string;
}

// ─── Plan definitions ──────────────────────────────────

const plans = [
    {
        name: 'Free',
        plan: 'FREE',
        priceMonthly: 0,
        priceYearly: 0,
        description: 'Perfect for testing and small projects',
        features: [
            { text: '100 requests/month', included: true },
            { text: 'Up to 10 locations', included: true },
            { text: '2 cabs maximum', included: true },
            { text: 'Basic algorithms', included: true },
            { text: 'Community support', included: true },
            { text: 'Traffic data', included: false },
            { text: 'Priority support', included: false },
        ],
    },
    {
        name: 'Pro',
        plan: 'PRO',
        priceMonthly: 4900,
        priceYearly: 47000,
        description: 'For growing businesses and production use',
        features: [
            { text: '10,000 requests/month', included: true },
            { text: 'Up to 100 locations', included: true },
            { text: '50 cabs maximum', included: true },
            { text: 'All algorithms', included: true },
            { text: 'Real-time traffic data', included: true },
            { text: 'Email support', included: true },
            { text: 'Priority support', included: false },
        ],
        isPopular: true,
    },
    {
        name: 'Enterprise',
        plan: 'ENTERPRISE',
        priceMonthly: 49900,
        priceYearly: 479000,
        description: 'For large-scale operations',
        features: [
            { text: 'Unlimited requests', included: true },
            { text: 'Up to 500 locations', included: true },
            { text: '200 cabs maximum', included: true },
            { text: 'All algorithms + custom', included: true },
            { text: 'Real-time traffic data', included: true },
            { text: '24/7 priority support', included: true },
            { text: '99.9% SLA', included: true },
        ],
    },
];

// ─── Component ─────────────────────────────────────────

export default function BillingPage() {
    const [data, setData] = useState<SubscriptionData | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
    const [promoCode, setPromoCode] = useState('');
    const [promoStatus, setPromoStatus] = useState<{ valid?: boolean; message?: string; discount?: number } | null>(null);
    const [subscribing, setSubscribing] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/portal/subscription');
            const json = await res.json();
            if (json.success) {
                setData(json);
            }
        } catch (error) {
            console.error('Failed to fetch subscription:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubscribe = async (plan: string) => {
        setSubscribing(plan);
        try {
            const res = await fetch('/api/portal/subscription/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan,
                    interval: billingInterval,
                    promoCode: promoCode || undefined,
                }),
            });

            const json = await res.json();
            if (json.success) {
                alert(`Successfully subscribed to ${plan}!`);
                setPromoCode('');
                setPromoStatus(null);
                fetchData();
            } else {
                alert(json.error || 'Failed to subscribe');
            }
        } catch (error) {
            alert('Failed to subscribe');
        } finally {
            setSubscribing(null);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) return;

        try {
            const res = await fetch('/api/portal/subscription/cancel', { method: 'POST' });
            const json = await res.json();

            if (json.success) {
                alert('Subscription cancelled. You will retain access until end of billing period.');
                fetchData();
            } else {
                alert(json.error || 'Failed to cancel');
            }
        } catch (error) {
            alert('Failed to cancel subscription');
        }
    };

    const handleApplyPromo = async () => {
        if (!promoCode.trim()) return;

        try {
            const res = await fetch('/api/portal/subscription/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: promoCode }),
            });

            const json = await res.json();

            if (json.success) {
                setPromoStatus({ valid: true, message: `Promo applied! New price: $${(json.newPrice / 100).toFixed(2)}`, discount: 0 });
                setPromoCode('');
                fetchData();
            } else {
                setPromoStatus({ valid: false, message: json.error });
            }
        } catch (error) {
            setPromoStatus({ valid: false, message: 'Failed to apply promo code' });
        }
    };

    const handleValidatePromo = async () => {
        if (!promoCode.trim()) return;

        try {
            const res = await fetch(`/api/portal/subscription/redeem?code=${promoCode}`);
            const json = await res.json();

            if (json.validation?.valid) {
                setPromoStatus({
                    valid: true,
                    message: `${json.validation.discountPercent}% off! Price: $${(json.validation.discountedPrice / 100).toFixed(2)}`,
                    discount: json.validation.discountPercent,
                });
            } else {
                setPromoStatus({ valid: false, message: json.validation?.error || 'Invalid code' });
            }
        } catch (error) {
            setPromoStatus({ valid: false, message: 'Failed to validate code' });
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-500)' }}>
                Loading billing data...
            </div>
        );
    }

    const currentPlan = data?.subscription?.plan || 'FREE';

    return (
        <div style={{ padding: 'var(--space-6)' }}>
            <div className="page-header">
                <h1 className="page-title">Billing & Subscription</h1>
                <p className="page-description">Manage your plan, usage, and invoices</p>
            </div>

            {/* ─── Current Plan ──────────────────────────── */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h3 className="card-title">Current Plan</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                            <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--white)' }}>
                                {currentPlan}
                            </span>
                            <Badge variant={data?.subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>
                                {data?.subscription?.status || 'ACTIVE'}
                            </Badge>
                            {data?.subscription?.adminGranted && (
                                <Badge variant="warning">Admin Granted</Badge>
                            )}
                            {data?.subscription?.promoCode && (
                                <Badge variant="info">
                                    {data.subscription.promoCode.discountPercent}% OFF
                                </Badge>
                            )}
                        </div>
                        {data?.subscription?.currentPeriodEnd && (
                            <p style={{ marginTop: 'var(--space-2)', fontSize: '14px', color: 'var(--gray-400)' }}>
                                {data.subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}{' '}
                                {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
                            </p>
                        )}
                        {data?.subscription?.priceAtPurchase ? (
                            <p style={{ marginTop: 'var(--space-1)', fontSize: '14px', color: 'var(--gray-400)' }}>
                                ${(data.subscription.priceAtPurchase / 100).toFixed(2)}/{data.subscription.billingInterval === 'YEARLY' ? 'year' : 'month'}
                            </p>
                        ) : null}
                    </div>
                    {currentPlan !== 'FREE' && data?.subscription?.status === 'ACTIVE' && !data?.subscription?.cancelAtPeriodEnd && (
                        <Button variant="danger" size="sm" onClick={handleCancel}>
                            Cancel Subscription
                        </Button>
                    )}
                </div>

                {/* Usage Meter */}
                {data?.usage && (
                    <div style={{ marginTop: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>Monthly Usage</span>
                            <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                {data.usage.current.toLocaleString()} / {data.usage.limit === -1 ? '∞' : data.usage.limit.toLocaleString()}
                            </span>
                        </div>
                        <div style={{
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${Math.min(data.usage.percentage, 100)}%`,
                                background: data.usage.percentage > 90 ? 'var(--red)' : data.usage.percentage > 70 ? 'var(--orange)' : 'var(--green)',
                                borderRadius: '4px',
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                        {data.usage.remaining !== -1 && (
                            <p style={{ marginTop: 'var(--space-2)', fontSize: '12px', color: 'var(--gray-500)' }}>
                                {data.usage.remaining.toLocaleString()} requests remaining
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Promo Code ───────────────────────────── */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Promo Code</h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                        <Input
                            id="promo-code"
                            value={promoCode}
                            onChange={(e) => {
                                setPromoCode(e.target.value.toUpperCase());
                                setPromoStatus(null);
                            }}
                            placeholder="Enter promo code (e.g. LAUNCH50)"
                            style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                        />
                    </div>
                    <Button variant="ghost" onClick={handleValidatePromo} disabled={!promoCode.trim()}>
                        Validate
                    </Button>
                    {currentPlan !== 'FREE' && !data?.subscription?.promoCode && (
                        <Button variant="primary" onClick={handleApplyPromo} disabled={!promoCode.trim()}>
                            Apply
                        </Button>
                    )}
                </div>
                {promoStatus && (
                    <p style={{
                        marginTop: 'var(--space-2)',
                        fontSize: '13px',
                        color: promoStatus.valid ? 'var(--green)' : 'var(--red)',
                    }}>
                        {promoStatus.valid ? '✓' : '✗'} {promoStatus.message}
                    </p>
                )}
            </div>

            {/* ─── Billing Interval Toggle ──────────────── */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-6)',
            }}>
                <button
                    onClick={() => setBillingInterval('MONTHLY')}
                    style={{
                        padding: 'var(--space-2) var(--space-4)',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: billingInterval === 'MONTHLY' ? 'var(--blue-light)' : 'rgba(255,255,255,0.05)',
                        color: billingInterval === 'MONTHLY' ? 'white' : 'var(--gray-400)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                    }}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setBillingInterval('YEARLY')}
                    style={{
                        padding: 'var(--space-2) var(--space-4)',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: billingInterval === 'YEARLY' ? 'var(--blue-light)' : 'rgba(255,255,255,0.05)',
                        color: billingInterval === 'YEARLY' ? 'white' : 'var(--gray-400)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                    }}
                >
                    Yearly <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: '600' }}>Save 20%</span>
                </button>
            </div>

            {/* ─── Available Plans ───────────────────────── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-8)',
            }}>
                {plans.map((plan) => {
                    const isCurrent = currentPlan === plan.plan;
                    const price = billingInterval === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
                    const discountedPrice = promoStatus?.valid && promoStatus.discount
                        ? Math.round(price * (1 - promoStatus.discount / 100))
                        : price;

                    return (
                        <div
                            key={plan.plan}
                            className="card"
                            style={{
                                padding: 'var(--space-6)',
                                border: plan.isPopular
                                    ? '1px solid var(--blue-light)'
                                    : '1px solid rgba(255,255,255,0.06)',
                                position: 'relative',
                            }}
                        >
                            {plan.isPopular && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-12px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'var(--blue-light)',
                                    color: 'white',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    padding: '2px 12px',
                                    borderRadius: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    Most Popular
                                </div>
                            )}

                            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                                {plan.name}
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: 'var(--space-4)' }}>
                                {plan.description}
                            </p>

                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                {promoStatus?.valid && promoStatus.discount && plan.plan !== 'FREE' ? (
                                    <>
                                        <span style={{ fontSize: '16px', color: 'var(--gray-500)', textDecoration: 'line-through' }}>
                                            ${(price / 100).toFixed(0)}
                                        </span>{' '}
                                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--green)' }}>
                                            ${(discountedPrice / 100).toFixed(0)}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--white)' }}>
                                        {price === 0 ? 'Free' : `$${(price / 100).toFixed(0)}`}
                                    </span>
                                )}
                                {price > 0 && (
                                    <span style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
                                        /{billingInterval === 'YEARLY' ? 'year' : 'month'}
                                    </span>
                                )}
                            </div>

                            <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--space-6)' }}>
                                {plan.features.map((f, i) => (
                                    <li key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)',
                                        padding: '6px 0',
                                        fontSize: '13px',
                                        color: f.included ? 'var(--gray-300)' : 'var(--gray-600)',
                                    }}>
                                        <span style={{ color: f.included ? 'var(--green)' : 'var(--gray-600)' }}>
                                            {f.included ? '✓' : '✗'}
                                        </span>
                                        {f.text}
                                    </li>
                                ))}
                            </ul>

                            {isCurrent ? (
                                <Button variant="ghost" disabled style={{ width: '100%' }}>
                                    Current Plan
                                </Button>
                            ) : plan.plan === 'FREE' ? (
                                <div />
                            ) : (
                                <Button
                                    variant={plan.isPopular ? 'primary' : 'ghost'}
                                    onClick={() => handleSubscribe(plan.plan)}
                                    disabled={subscribing === plan.plan}
                                    style={{ width: '100%' }}
                                >
                                    {subscribing === plan.plan ? 'Subscribing...' : `Upgrade to ${plan.name}`}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
