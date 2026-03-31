/**
 * Admin System Configuration Page
 * 
 * Fully functional admin controls for:
 * - Rate Limits per API tier (free / pro / enterprise)
 * - Plan Quotas per subscription (FREE / TRIAL / PRO / ENTERPRISE)
 * - Feature Flags (signup, oauth, trial, webhooks, AI features)
 * - Maintenance Mode
 *
 * All changes persist to the database via /api/admin/config
 * and take effect platform-wide within ~30 seconds.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ============================================================================
// TYPES
// ============================================================================

interface TierRateLimits {
    requestsPerDay: number;
    requestsPerMinute: number;
    maxDestinations: number;
}

interface PlanQuotas {
    requestsPerMonth: number;
    maxLocations: number;
    maxCabs: number;
}

interface FeatureFlags {
    signup: boolean;
    oauth: boolean;
    trial: boolean;
    webhooks: boolean;
    aiFeatures: boolean;
}

interface MaintenanceConfig {
    enabled: boolean;
    message: string;
}

interface PlatformConfig {
    tierLimits: Record<string, TierRateLimits>;
    planLimits: Record<string, PlanQuotas>;
    features: FeatureFlags;
    maintenance: MaintenanceConfig;
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <div style={{
            position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)',
            padding: 'var(--space-4) var(--space-6)',
            background: type === 'success' ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 59, 48, 0.15)',
            border: `1px solid ${type === 'success' ? 'rgba(48, 209, 88, 0.4)' : 'rgba(255, 59, 48, 0.4)'}`,
            borderRadius: 'var(--radius-lg)',
            color: type === 'success' ? '#30d158' : '#ff3b30',
            fontSize: '14px', fontWeight: 500, zIndex: 9999,
            backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            animation: 'fadeIn 0.3s ease-out',
        }}>
            <span>{type === 'success' ? '✓' : '✕'}</span>
            {message}
        </div>
    );
}

// ============================================================================
// TOGGLE SWITCH
// ============================================================================

function Toggle({ checked, onChange, label, description }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description: string;
}) {
    return (
        <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background 0.2s',
        }}>
            <div
                onClick={(e) => { e.preventDefault(); onChange(!checked); }}
                style={{
                    position: 'relative', width: 44, height: 24,
                    borderRadius: 12, marginTop: 2, flexShrink: 0,
                    background: checked ? '#30d158' : 'rgba(255, 255, 255, 0.15)',
                    transition: 'background 0.25s ease',
                    cursor: 'pointer',
                }}
            >
                <div style={{
                    position: 'absolute', top: 2, left: checked ? 22 : 2,
                    width: 20, height: 20, borderRadius: 10,
                    background: '#fff', transition: 'left 0.25s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
            </div>
            <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--white)', marginBottom: 'var(--space-1)' }}>
                    {label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                    {description}
                </div>
            </div>
        </label>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SystemConfigPage() {
    const [activeTab, setActiveTab] = useState('rate-limits');
    const [config, setConfig] = useState<PlatformConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Draft state for editable fields
    const [draftTier, setDraftTier] = useState<Record<string, TierRateLimits>>({});
    const [draftPlan, setDraftPlan] = useState<Record<string, PlanQuotas>>({});
    const [draftFeatures, setDraftFeatures] = useState<FeatureFlags | null>(null);
    const [draftMaintenance, setDraftMaintenance] = useState<MaintenanceConfig | null>(null);

    const tabs = [
        { id: 'rate-limits', label: '⚡ Rate Limits', description: 'API throttling per tier' },
        { id: 'plan-quotas', label: '📊 Plan Quotas', description: 'Subscription plan limits' },
        { id: 'features', label: '🚀 Feature Flags', description: 'Enable/disable features' },
        { id: 'maintenance', label: '🔧 Maintenance', description: 'Maintenance mode' },
    ];

    // ──────────────── FETCH ────────────────
    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/config');
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                setDraftTier(data.config.tierLimits);
                setDraftPlan(data.config.planLimits);
                setDraftFeatures(data.config.features);
                setDraftMaintenance(data.config.maintenance);
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
            setToast({ message: 'Failed to load configuration', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    // ──────────────── SAVE ────────────────
    const saveConfig = async (patch: Partial<PlatformConfig>, label: string) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                setDraftTier(data.config.tierLimits);
                setDraftPlan(data.config.planLimits);
                setDraftFeatures(data.config.features);
                setDraftMaintenance(data.config.maintenance);
                setToast({ message: `${label} saved — takes effect within 30 seconds`, type: 'success' });
            } else {
                setToast({ message: data.error || 'Save failed', type: 'error' });
            }
        } catch {
            setToast({ message: 'Network error — could not save', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // ──────────────── HELPERS ────────────────
    const updateTierField = (tier: string, field: keyof TierRateLimits, value: string) => {
        setDraftTier(prev => ({
            ...prev,
            [tier]: { ...prev[tier], [field]: parseInt(value) || 0 },
        }));
    };

    const updatePlanField = (plan: string, field: keyof PlanQuotas, value: string) => {
        setDraftPlan(prev => ({
            ...prev,
            [plan]: { ...prev[plan], [field]: parseInt(value) || 0 },
        }));
    };

    // ──────────────── RENDER ────────────────

    if (loading) {
        return (
            <div style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                    width: 20, height: 20, border: '2px solid rgba(255,255,255,0.2)',
                    borderTopColor: 'var(--blue)', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'var(--gray-400)', fontSize: 14 }}>Loading configuration…</span>
            </div>
        );
    }

    const tierOrder = ['free', 'pro', 'enterprise'];
    const tierLabels: Record<string, { name: string; color: string; icon: string }> = {
        free: { name: 'Free', color: '#86868b', icon: '🆓' },
        pro: { name: 'Professional', color: '#0071e3', icon: '⭐' },
        enterprise: { name: 'Enterprise', color: '#bf5af2', icon: '🏢' },
    };

    const planOrder = ['FREE', 'TRIAL', 'PRO', 'ENTERPRISE'];
    const planLabels: Record<string, { name: string; color: string }> = {
        FREE: { name: 'Free', color: '#86868b' },
        TRIAL: { name: 'Trial', color: '#ff9f0a' },
        PRO: { name: 'Professional', color: '#0071e3' },
        ENTERPRISE: { name: 'Enterprise', color: '#bf5af2' },
    };

    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: 1100 }}>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                    <h1 className="page-title" style={{ margin: 0 }}>System Configuration</h1>
                    <span className="badge badge-warning" style={{ fontSize: 11 }}>ADMIN</span>
                </div>
                <p className="page-description">
                    Manage platform-wide rate limits, plan quotas, and feature flags.
                    Changes take effect across the platform within ~30 seconds.
                </p>
            </div>

            {/* Config-last-updated info */}
            {config && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-3) var(--space-5)',
                    background: 'rgba(0, 113, 227, 0.08)',
                    border: '1px solid rgba(0, 113, 227, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-6)',
                    fontSize: 13, color: 'var(--gray-300)',
                }}>
                    <span style={{ color: 'var(--blue)' }}>ℹ</span>
                    Changes are cached for 30s. All API requests will use updated limits after cache refresh.
                </div>
            )}

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: 'var(--space-1)',
                marginBottom: 'var(--space-8)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                overflowX: 'auto',
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: 'var(--space-4) var(--space-6)',
                            fontSize: '13px',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            color: activeTab === tab.id ? 'var(--white)' : 'var(--gray-400)',
                            background: activeTab === tab.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════ RATE LIMITS TAB ═══════════════════ */}
            {activeTab === 'rate-limits' && (
                <div>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                            API Rate Limits by Tier
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                            Control how many requests each API tier can make. Set to <code style={{ color: 'var(--blue)', background: 'rgba(0,113,227,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>-1</code> for unlimited.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                        {tierOrder.map((tier) => {
                            const meta = tierLabels[tier];
                            const limits = draftTier[tier];
                            if (!limits) return null;

                            return (
                                <div key={tier} className="card" style={{
                                    borderLeft: `3px solid ${meta.color}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, color: meta.color, margin: 0 }}>
                                            {meta.name} Tier
                                        </h3>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--gray-400)', marginBottom: 'var(--space-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Requests / Day
                                            </label>
                                            <Input
                                                id={`${tier}-rpd`}
                                                type="number"
                                                value={String(limits.requestsPerDay)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTierField(tier, 'requestsPerDay', e.target.value)}
                                                helper={limits.requestsPerDay === -1 ? '∞ Unlimited' : `${limits.requestsPerDay.toLocaleString()} req/day`}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--gray-400)', marginBottom: 'var(--space-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Requests / Minute
                                            </label>
                                            <Input
                                                id={`${tier}-rpm`}
                                                type="number"
                                                value={String(limits.requestsPerMinute)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTierField(tier, 'requestsPerMinute', e.target.value)}
                                                helper={limits.requestsPerMinute === -1 ? '∞ Unlimited' : `${limits.requestsPerMinute} req/min`}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--gray-400)', marginBottom: 'var(--space-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Max Destinations
                                            </label>
                                            <Input
                                                id={`${tier}-maxd`}
                                                type="number"
                                                value={String(limits.maxDestinations)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTierField(tier, 'maxDestinations', e.target.value)}
                                                helper={`${limits.maxDestinations} per request`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <Button variant="primary" onClick={() => saveConfig({ tierLimits: draftTier }, 'Rate limits')} disabled={saving}>
                            {saving ? 'Saving…' : '💾 Save Rate Limits'}
                        </Button>
                        <Button variant="ghost" onClick={() => config && setDraftTier(config.tierLimits)}>
                            Reset
                        </Button>
                        <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto' }}>
                            Changes propagate within ~30 seconds
                        </span>
                    </div>
                </div>
            )}

            {/* ═══════════════════ PLAN QUOTAS TAB ═══════════════════ */}
            {activeTab === 'plan-quotas' && (
                <div>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                            Subscription Plan Quotas
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                            Control monthly request quotas and per-request maximums for each subscription plan.
                        </p>
                    </div>

                    {/* Plan comparison table */}
                    <div className="card" style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan</th>
                                    <th style={{ textAlign: 'center', padding: 'var(--space-3) var(--space-4)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests / Month</th>
                                    <th style={{ textAlign: 'center', padding: 'var(--space-3) var(--space-4)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Locations</th>
                                    <th style={{ textAlign: 'center', padding: 'var(--space-3) var(--space-4)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Cabs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {planOrder.map((plan) => {
                                    const meta = planLabels[plan];
                                    const quotas = draftPlan[plan];
                                    if (!quotas) return null;

                                    return (
                                        <tr key={plan} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: 'var(--space-4)', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-block', width: 8, height: 8, borderRadius: 4,
                                                    background: meta.color, marginRight: 'var(--space-3)',
                                                }} />
                                                <span style={{ fontSize: 14, fontWeight: 500, color: meta.color }}>{meta.name}</span>
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                                <Input
                                                    id={`${plan}-rpm`}
                                                    type="number"
                                                    value={String(quotas.requestsPerMonth)}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePlanField(plan, 'requestsPerMonth', e.target.value)}
                                                    helper={quotas.requestsPerMonth === -1 ? '∞ Unlimited' : ''}
                                                />
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                                <Input
                                                    id={`${plan}-loc`}
                                                    type="number"
                                                    value={String(quotas.maxLocations)}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePlanField(plan, 'maxLocations', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                                <Input
                                                    id={`${plan}-cabs`}
                                                    type="number"
                                                    value={String(quotas.maxCabs)}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePlanField(plan, 'maxCabs', e.target.value)}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <Button variant="primary" onClick={() => saveConfig({ planLimits: draftPlan }, 'Plan quotas')} disabled={saving}>
                            {saving ? 'Saving…' : '💾 Save Plan Quotas'}
                        </Button>
                        <Button variant="ghost" onClick={() => config && setDraftPlan(config.planLimits)}>
                            Reset
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══════════════════ FEATURE FLAGS TAB ═══════════════════ */}
            {activeTab === 'features' && draftFeatures && (
                <div>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                            Feature Flags
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                            Enable or disable platform features globally. Changes apply to all users.
                        </p>
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <Toggle
                                checked={draftFeatures.signup}
                                onChange={(v) => setDraftFeatures(prev => prev ? { ...prev, signup: v } : prev)}
                                label="User Signup"
                                description="Allow new users to create accounts via the registration page"
                            />
                            <Toggle
                                checked={draftFeatures.oauth}
                                onChange={(v) => setDraftFeatures(prev => prev ? { ...prev, oauth: v } : prev)}
                                label="OAuth Login"
                                description="Enable Google and GitHub OAuth authentication"
                            />
                            <Toggle
                                checked={draftFeatures.trial}
                                onChange={(v) => setDraftFeatures(prev => prev ? { ...prev, trial: v } : prev)}
                                label="Trial Plans"
                                description="Allow users to start free trial subscriptions"
                            />
                            <Toggle
                                checked={draftFeatures.webhooks}
                                onChange={(v) => setDraftFeatures(prev => prev ? { ...prev, webhooks: v } : prev)}
                                label="Webhooks"
                                description="Enable webhook functionality for event notifications"
                            />
                            <Toggle
                                checked={draftFeatures.aiFeatures}
                                onChange={(v) => setDraftFeatures(prev => prev ? { ...prev, aiFeatures: v } : prev)}
                                label="AI Features"
                                description="Advanced AI-powered route optimizations and predictions"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="primary" onClick={() => saveConfig({ features: draftFeatures }, 'Feature flags')} disabled={saving}>
                            {saving ? 'Saving…' : '💾 Save Feature Flags'}
                        </Button>
                        <Button variant="ghost" onClick={() => config && setDraftFeatures(config.features)}>
                            Reset
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══════════════════ MAINTENANCE TAB ═══════════════════ */}
            {activeTab === 'maintenance' && draftMaintenance && (
                <div>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                            Maintenance Mode
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                            Enable maintenance mode to temporarily disable API access during updates.
                        </p>
                    </div>

                    {/* Warning banner */}
                    <div style={{
                        padding: 'var(--space-5) var(--space-6)',
                        background: draftMaintenance.enabled ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 159, 10, 0.08)',
                        border: `1px solid ${draftMaintenance.enabled ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255, 159, 10, 0.2)'}`,
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <span style={{ fontSize: 20 }}>{draftMaintenance.enabled ? '🔴' : '⚠️'}</span>
                            <span style={{
                                fontSize: 14, fontWeight: 600,
                                color: draftMaintenance.enabled ? '#ff3b30' : 'var(--orange)',
                            }}>
                                {draftMaintenance.enabled
                                    ? 'Maintenance mode is ACTIVE — all API requests are disabled'
                                    : 'Maintenance mode will disable all API requests when enabled'}
                            </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: 0 }}>
                            Use this when performing database migrations, critical updates, or scheduled downtime.
                        </p>
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                            <Toggle
                                checked={draftMaintenance.enabled}
                                onChange={(v) => setDraftMaintenance(prev => prev ? { ...prev, enabled: v } : prev)}
                                label="Enable Maintenance Mode"
                                description="When enabled, all API endpoints will return 503 Service Unavailable"
                            />

                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--gray-400)', marginBottom: 'var(--space-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Public Message
                                </label>
                                <Input
                                    id="maintenance-message"
                                    value={draftMaintenance.message}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftMaintenance(prev => prev ? { ...prev, message: e.target.value } : prev)}
                                    placeholder="We're performing scheduled maintenance. Back soon!"
                                    helper="This message will be shown to API consumers"
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
                        <Button
                            variant={draftMaintenance.enabled ? 'primary' : 'primary'}
                            onClick={() => saveConfig({ maintenance: draftMaintenance }, 'Maintenance settings')}
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : draftMaintenance.enabled ? '🔴 Save & Activate Maintenance' : '💾 Save Maintenance Settings'}
                        </Button>
                        <Button variant="ghost" onClick={() => config && setDraftMaintenance(config.maintenance)}>
                            Reset
                        </Button>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
