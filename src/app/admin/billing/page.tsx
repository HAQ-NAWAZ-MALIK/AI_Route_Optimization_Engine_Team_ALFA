/**
 * Admin Billing Dashboard
 * Promo codes manager, revenue overview, subscription analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

// ─── Types ─────────────────────────────────────────────

interface PromoCode {
    id: string;
    code: string;
    discountPercent: number;
    maxRedemptions: number;
    timesRedeemed: number;
    validFrom: string;
    expiresAt: string | null;
    applicablePlans: string[];
    active: boolean;
    createdAt: string;
}

interface BillingStats {
    totalSubscribers: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
    activePromoCodes: number;
    totalPromoRedemptions: number;
    mrr: number;
    recentSubscriptions: Array<{
        id: string;
        userEmail: string;
        plan: string;
        status: string;
        priceAtPurchase: number;
        adminGranted: boolean;
        createdAt: string;
    }>;
}

// ─── Component ─────────────────────────────────────────

export default function BillingPage() {
    const [codes, setCodes] = useState<PromoCode[]>([]);
    const [stats, setStats] = useState<BillingStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create form
    const [newCode, setNewCode] = useState('');
    const [newDiscount, setNewDiscount] = useState('10');
    const [newMaxUses, setNewMaxUses] = useState('100');
    const [newExpiry, setNewExpiry] = useState('');
    const [newPlans, setNewPlans] = useState<string[]>(['PRO', 'ENTERPRISE']);

    const fetchData = async () => {
        try {
            const [codesRes, statsRes] = await Promise.all([
                fetch('/api/admin/promo-codes'),
                fetch('/api/admin/billing/stats'),
            ]);

            const codesData = await codesRes.json();
            const statsData = await statsRes.json();

            setCodes(codesData.codes || []);
            setStats(statsData.stats || null);
        } catch (error) {
            console.error('Failed to fetch billing data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreateCode = async () => {
        try {
            const res = await fetch('/api/admin/promo-codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: newCode,
                    discountPercent: parseInt(newDiscount),
                    maxRedemptions: parseInt(newMaxUses),
                    expiresAt: newExpiry || null,
                    applicablePlans: newPlans,
                }),
            });

            if (res.ok) {
                alert('Promo code created!');
                setShowCreateModal(false);
                resetForm();
                fetchData();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to create promo code');
            }
        } catch (error) {
            alert('Failed to create promo code');
        }
    };

    const handleDisableCode = async (id: string) => {
        if (!confirm('Disable this promo code?')) return;

        try {
            const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            } else {
                alert('Failed to disable code');
            }
        } catch { alert('Failed to disable code'); }
    };

    const resetForm = () => {
        setNewCode('');
        setNewDiscount('10');
        setNewMaxUses('100');
        setNewExpiry('');
        setNewPlans(['PRO', 'ENTERPRISE']);
    };

    const togglePlan = (plan: string) => {
        setNewPlans(prev =>
            prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan]
        );
    };

    if (isLoading) {
        return (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-500)' }}>
                Loading billing data...
            </div>
        );
    }

    return (
        <div style={{ padding: 'var(--space-6)' }}>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h1 className="page-title">Billing & Revenue</h1>
                        <p className="page-description">Manage subscriptions, promo codes, and revenue analytics</p>
                    </div>
                    <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        + Create Promo Code
                    </Button>
                </div>
            </div>

            {/* ─── Revenue Stats ─────────────────────────────── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-8)',
            }}>
                <StatCard label="Monthly Revenue (MRR)" value={`$${((stats?.mrr || 0) / 100).toFixed(2)}`} />
                <StatCard label="Total Subscribers" value={String(stats?.totalSubscribers || 0)} />
                <StatCard
                    label="Active Subs"
                    value={String(stats?.byStatus?.['ACTIVE'] || 0)}
                    accent="var(--green)"
                />
                <StatCard
                    label="Promo Redemptions"
                    value={String(stats?.totalPromoRedemptions || 0)}
                    accent="var(--blue-light)"
                />
            </div>

            {/* ─── Plan Distribution ────────────────────────── */}
            {stats && Object.keys(stats.byPlan).length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Plan Distribution</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                        {Object.entries(stats.byPlan).map(([plan, count]) => (
                            <div key={plan} style={{
                                padding: 'var(--space-3) var(--space-4)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                            }}>
                                <Badge variant={
                                    plan === 'ENTERPRISE' ? 'warning' :
                                        plan === 'PRO' ? 'success' :
                                            plan === 'TRIAL' ? 'info' : 'neutral'
                                }>
                                    {plan}
                                </Badge>
                                <span style={{ fontWeight: '600', color: 'var(--white)' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Promo Codes Table ───────────────────────── */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="card-header" style={{ marginBottom: 'var(--space-4)' }}>
                    <h3 className="card-title">
                        Promo Codes ({codes.length})
                    </h3>
                </div>

                {codes.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        No promo codes yet. Create one to get started.
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Discount</th>
                                    <th>Usage</th>
                                    <th>Plans</th>
                                    <th>Expires</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {codes.map((code) => (
                                    <tr key={code.id} style={{ opacity: code.active ? 1 : 0.5 }}>
                                        <td>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontWeight: '600',
                                                color: 'var(--blue-light)',
                                                fontSize: '14px',
                                            }}>
                                                {code.code}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                color: 'var(--green)',
                                                fontWeight: '600',
                                            }}>
                                                {code.discountPercent}% OFF
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ color: 'var(--white)' }}>
                                                {code.timesRedeemed}
                                            </span>
                                            <span style={{ color: 'var(--gray-500)' }}>
                                                /{code.maxRedemptions}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {code.applicablePlans.map(plan => (
                                                    <Badge key={plan} variant="neutral" style={{ fontSize: '11px' }}>
                                                        {plan}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                            {code.expiresAt
                                                ? new Date(code.expiresAt).toLocaleDateString()
                                                : 'Never'}
                                        </td>
                                        <td>
                                            <Badge variant={code.active ? 'success' : 'error'}>
                                                {code.active ? 'Active' : 'Disabled'}
                                            </Badge>
                                        </td>
                                        <td>
                                            {code.active && (
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => handleDisableCode(code.id)}
                                                >
                                                    Disable
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Recent Subscriptions ─────────────────────── */}
            {stats && stats.recentSubscriptions.length > 0 && (
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
                        Recent Subscriptions
                    </h3>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Plan</th>
                                    <th>Status</th>
                                    <th>Price</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentSubscriptions.map((sub) => (
                                    <tr key={sub.id}>
                                        <td style={{ fontSize: '13px' }}>{sub.userEmail}</td>
                                        <td>
                                            <Badge variant={
                                                sub.plan === 'ENTERPRISE' ? 'warning' :
                                                    sub.plan === 'PRO' ? 'success' : 'neutral'
                                            }>
                                                {sub.plan}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge variant={sub.status === 'ACTIVE' ? 'success' : 'error'}>
                                                {sub.status}
                                            </Badge>
                                        </td>
                                        <td>
                                            {sub.priceAtPurchase === 0
                                                ? <span style={{ color: 'var(--gray-500)' }}>Free</span>
                                                : <span style={{ color: 'var(--green)' }}>${(sub.priceAtPurchase / 100).toFixed(2)}</span>
                                            }
                                        </td>
                                        <td>
                                            {sub.adminGranted
                                                ? <Badge variant="warning">Admin</Badge>
                                                : <Badge variant="neutral">User</Badge>
                                            }
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                            {new Date(sub.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Create Promo Code Modal ──────────────────── */}
            {showCreateModal && (
                <Modal
                    isOpen={showCreateModal}
                    onClose={() => { setShowCreateModal(false); resetForm(); }}
                    title="Create Promo Code"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                Code (e.g. LAUNCH50)
                            </label>
                            <Input
                                id="promo-code"
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                                placeholder="PROMO_CODE"
                                style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                    Discount %
                                </label>
                                <Input
                                    id="discount-percent"
                                    type="number"
                                    value={newDiscount}
                                    onChange={(e) => setNewDiscount(e.target.value)}
                                    min="1"
                                    max="100"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                    Max Uses
                                </label>
                                <Input
                                    id="max-uses"
                                    type="number"
                                    value={newMaxUses}
                                    onChange={(e) => setNewMaxUses(e.target.value)}
                                    min="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                Expiry Date (optional)
                            </label>
                            <Input
                                id="expiry-date"
                                type="datetime-local"
                                value={newExpiry}
                                onChange={(e) => setNewExpiry(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                Applicable Plans
                            </label>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                {['PRO', 'ENTERPRISE'].map(plan => (
                                    <button
                                        key={plan}
                                        onClick={() => togglePlan(plan)}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${newPlans.includes(plan) ? 'var(--blue-light)' : 'rgba(255,255,255,0.1)'}`,
                                            background: newPlans.includes(plan) ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                            color: newPlans.includes(plan) ? 'var(--blue-light)' : 'var(--gray-500)',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {plan}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        {newCode && newDiscount && (
                            <div style={{
                                padding: 'var(--space-3)',
                                background: 'rgba(16, 185, 129, 0.06)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '14px',
                                color: 'var(--gray-300)',
                            }}>
                                <strong style={{ color: 'var(--green)' }}>{newCode || '...'}</strong> →{' '}
                                {newDiscount}% off for {newPlans.join(' & ')} plans
                                {newMaxUses && ` · up to ${newMaxUses} uses`}
                                {newExpiry && ` · expires ${new Date(newExpiry).toLocaleDateString()}`}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <Button variant="ghost" onClick={() => { setShowCreateModal(false); resetForm(); }} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleCreateCode}
                                style={{ flex: 1 }}
                                disabled={!newCode || !newDiscount || newPlans.length === 0}
                            >
                                Create Code
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Stat Card Component ────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: 'var(--space-2)' }}>
                {label}
            </div>
            <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: accent || 'var(--white)',
                lineHeight: 1.1,
            }}>
                {value}
            </div>
        </div>
    );
}
