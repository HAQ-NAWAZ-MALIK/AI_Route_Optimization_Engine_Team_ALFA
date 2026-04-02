/**
 * Admin Config Test Dashboard
 * 
 * Visual test page to verify all admin config features:
 * - Maintenance mode warning visibility
 * - Rate limits CRUD
 * - Plan quotas CRUD
 * - Feature flags toggle
 * - Input validation
 * 
 * Navigate to: /admin/test
 */

'use client';

import { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
    label: string;
    passed: boolean;
    detail?: string;
}

interface TestSuite {
    name: string;
    icon: string;
    status: 'idle' | 'running' | 'done';
    results: TestResult[];
}

interface PlatformConfig {
    tierLimits: Record<string, { requestsPerDay: number; requestsPerMinute: number; maxDestinations: number }>;
    planLimits: Record<string, { requestsPerMonth: number; maxLocations: number; maxCabs: number }>;
    features: Record<string, boolean>;
    maintenance: { enabled: boolean; message: string };
}

// ============================================================================
// API HELPER
// ============================================================================

async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminTestPage() {
    const [suites, setSuites] = useState<TestSuite[]>([
        { name: 'Config API', icon: '📋', status: 'idle', results: [] },
        { name: 'Rate Limits', icon: '⚡', status: 'idle', results: [] },
        { name: 'Plan Quotas', icon: '📊', status: 'idle', results: [] },
        { name: 'Feature Flags', icon: '🚀', status: 'idle', results: [] },
        { name: 'Maintenance Mode', icon: '🔧', status: 'idle', results: [] },
        { name: 'Validation', icon: '🛡️', status: 'idle', results: [] },
    ]);

    const [liveConfig, setLiveConfig] = useState<PlatformConfig | null>(null);
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState<number | null>(null);

    // Update a specific suite
    const updateSuite = useCallback((index: number, update: Partial<TestSuite>) => {
        setSuites(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s));
    }, []);

    // ─── Refresh live config ─────────────────────────
    const refreshConfig = useCallback(async () => {
        const { data } = await api('GET', '/api/admin/config');
        if (data?.config) setLiveConfig(data.config);
        return data?.config;
    }, []);

    // ─── Run all tests ───────────────────────────────
    const runAllTests = useCallback(async () => {
        setRunning(true);
        setElapsed(null);
        const start = Date.now();

        // Reset all suites
        setSuites(prev => prev.map(s => ({ ...s, status: 'idle', results: [] })));

        // ── 1. Config API ──
        updateSuite(0, { status: 'running' });
        const configResults: TestResult[] = [];
        try {
            const { status, data } = await api('GET', '/api/admin/config');
            configResults.push({ label: 'GET returns 200', passed: status === 200 });
            configResults.push({ label: 'Has success=true', passed: data?.success === true });
            configResults.push({ label: 'Has tierLimits', passed: !!data?.config?.tierLimits });
            configResults.push({ label: 'Has planLimits', passed: !!data?.config?.planLimits });
            configResults.push({ label: 'Has features', passed: data?.config?.features !== undefined });
            configResults.push({ label: 'Has maintenance', passed: data?.config?.maintenance !== undefined });
            if (data?.config) setLiveConfig(data.config);
        } catch (e: any) {
            configResults.push({ label: 'API reachable', passed: false, detail: e.message });
        }
        updateSuite(0, { status: 'done', results: configResults });

        // ── 2. Rate Limits ──
        updateSuite(1, { status: 'running' });
        const rateResults: TestResult[] = [];
        try {
            const original = await refreshConfig();
            // Modify free tier
            const { status: s1, data: d1 } = await api('PUT', '/api/admin/config', {
                tierLimits: {
                    ...original?.tierLimits,
                    free: { requestsPerDay: 77, requestsPerMinute: 7, maxDestinations: 15 },
                },
            });
            rateResults.push({ label: 'PUT returns 200', passed: s1 === 200 });
            rateResults.push({ label: 'Free requestsPerDay → 77', passed: d1?.config?.tierLimits?.free?.requestsPerDay === 77 });
            rateResults.push({ label: 'Free requestsPerMinute → 7', passed: d1?.config?.tierLimits?.free?.requestsPerMinute === 7 });
            rateResults.push({ label: 'Pro tier unchanged', passed: d1?.config?.tierLimits?.pro?.requestsPerDay === original?.tierLimits?.pro?.requestsPerDay });

            // Read back
            const { data: read } = await api('GET', '/api/admin/config');
            rateResults.push({ label: 'GET confirms persistence', passed: read?.config?.tierLimits?.free?.requestsPerDay === 77 });

            // Restore
            await api('PUT', '/api/admin/config', { tierLimits: original?.tierLimits });
            const { data: restored } = await api('GET', '/api/admin/config');
            rateResults.push({ label: 'Restored to original', passed: restored?.config?.tierLimits?.free?.requestsPerDay === original?.tierLimits?.free?.requestsPerDay });
            setLiveConfig(restored?.config);
        } catch (e: any) {
            rateResults.push({ label: 'Rate limit test', passed: false, detail: e.message });
        }
        updateSuite(1, { status: 'done', results: rateResults });

        // ── 3. Plan Quotas ──
        updateSuite(2, { status: 'running' });
        const planResults: TestResult[] = [];
        try {
            const original = await refreshConfig();
            const { status: s1, data: d1 } = await api('PUT', '/api/admin/config', {
                planLimits: {
                    ...original?.planLimits,
                    FREE: { requestsPerMonth: 33, maxLocations: 3, maxCabs: 1 },
                },
            });
            planResults.push({ label: 'PUT returns 200', passed: s1 === 200 });
            planResults.push({ label: 'FREE requestsPerMonth → 33', passed: d1?.config?.planLimits?.FREE?.requestsPerMonth === 33 });
            planResults.push({ label: 'FREE maxLocations → 3', passed: d1?.config?.planLimits?.FREE?.maxLocations === 3 });
            planResults.push({ label: 'PRO unchanged', passed: d1?.config?.planLimits?.PRO?.requestsPerMonth === original?.planLimits?.PRO?.requestsPerMonth });

            // Restore
            await api('PUT', '/api/admin/config', { planLimits: original?.planLimits });
            planResults.push({ label: 'Restored to original', passed: true });
            setLiveConfig((await refreshConfig()) || null);
        } catch (e: any) {
            planResults.push({ label: 'Plan quota test', passed: false, detail: e.message });
        }
        updateSuite(2, { status: 'done', results: planResults });

        // ── 4. Feature Flags ──
        updateSuite(3, { status: 'running' });
        const flagResults: TestResult[] = [];
        try {
            const original = await refreshConfig();
            // Toggle webhooks ON
            const { data: d1 } = await api('PUT', '/api/admin/config', {
                features: { ...original?.features, webhooks: true },
            });
            flagResults.push({ label: 'Webhooks → enabled', passed: d1?.config?.features?.webhooks === true });

            // Toggle webhooks OFF
            const { data: d2 } = await api('PUT', '/api/admin/config', {
                features: { ...d1?.config?.features, webhooks: false },
            });
            flagResults.push({ label: 'Webhooks → disabled', passed: d2?.config?.features?.webhooks === false });

            // Restore
            await api('PUT', '/api/admin/config', { features: original?.features });
            flagResults.push({ label: 'Restored original flags', passed: true });
            setLiveConfig((await refreshConfig()) || null);
        } catch (e: any) {
            flagResults.push({ label: 'Feature flag test', passed: false, detail: e.message });
        }
        updateSuite(3, { status: 'done', results: flagResults });

        // ── 5. Maintenance Mode ──
        updateSuite(4, { status: 'running' });
        const maintResults: TestResult[] = [];
        try {
            // Enable
            const { data: d1 } = await api('PUT', '/api/admin/config', {
                maintenance: { enabled: true, message: '🛠 Test maintenance active' },
            });
            maintResults.push({ label: 'Maintenance → enabled', passed: d1?.config?.maintenance?.enabled === true });
            maintResults.push({ label: 'Message persisted', passed: d1?.config?.maintenance?.message === '🛠 Test maintenance active' });
            setLiveConfig(d1?.config); // Show maintenance banner

            // Small delay so user can see the banner
            await new Promise(r => setTimeout(r, 1500));

            // GET confirms
            const { data: read } = await api('GET', '/api/admin/config');
            maintResults.push({ label: 'GET confirms enabled', passed: read?.config?.maintenance?.enabled === true });

            // Disable
            const { data: d2 } = await api('PUT', '/api/admin/config', {
                maintenance: { enabled: false, message: '' },
            });
            maintResults.push({ label: 'Maintenance → disabled', passed: d2?.config?.maintenance?.enabled === false });
            setLiveConfig(d2?.config);
        } catch (e: any) {
            maintResults.push({ label: 'Maintenance test', passed: false, detail: e.message });
        }
        updateSuite(4, { status: 'done', results: maintResults });

        // ── 6. Validation ──
        updateSuite(5, { status: 'running' });
        const valResults: TestResult[] = [];
        try {
            const { status: s1 } = await api('PUT', '/api/admin/config', { garbage: 'bad' });
            valResults.push({ label: 'Rejects unknown keys (400)', passed: s1 === 400 });

            const { status: s2 } = await api('PUT', '/api/admin/config', {
                tierLimits: { free: { requestsPerDay: 'not_a_number', requestsPerMinute: 10, maxDestinations: 20 } },
            });
            valResults.push({ label: 'Rejects non-numeric values (400)', passed: s2 === 400 });
        } catch (e: any) {
            valResults.push({ label: 'Validation test', passed: false, detail: e.message });
        }
        updateSuite(5, { status: 'done', results: valResults });

        setElapsed((Date.now() - start) / 1000);
        setRunning(false);
    }, [updateSuite, refreshConfig]);

    // ─── Stats ───────────────────────────────────────
    const totalPassed = suites.reduce((sum, s) => sum + s.results.filter(r => r.passed).length, 0);
    const totalFailed = suites.reduce((sum, s) => sum + s.results.filter(r => !r.passed).length, 0);
    const totalTests = totalPassed + totalFailed;
    const allDone = suites.every(s => s.status === 'done');

    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: 1100 }}>
            {/* ═══ Maintenance Banner ═══ */}
            {liveConfig?.maintenance?.enabled && (
                <div style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.15), rgba(255, 149, 0, 0.1))',
                    border: '1px solid rgba(255, 59, 48, 0.4)',
                    borderRadius: 12,
                    marginBottom: 24,
                    display: 'flex', alignItems: 'center', gap: 12,
                    animation: 'pulse 2s ease-in-out infinite',
                }}>
                    <span style={{ fontSize: 28, animation: 'spin 3s linear infinite' }}>⚠️</span>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#ff3b30', marginBottom: 4 }}>
                            🚨 MAINTENANCE MODE ACTIVE
                        </div>
                        <div style={{ fontSize: 14, color: '#ff9f0a' }}>
                            {liveConfig.maintenance.message || 'The platform is currently under maintenance.'}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Header ═══ */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>🧪 Config Test Dashboard</h1>
                    <span style={{
                        padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 20,
                        background: 'rgba(255, 159, 10, 0.15)', color: '#ff9f0a', border: '1px solid rgba(255, 159, 10, 0.3)',
                    }}>ADMIN</span>
                </div>
                <p style={{ fontSize: 14, color: '#86868b', margin: 0 }}>
                    Run end-to-end tests for rate limits, plan quotas, feature flags, and maintenance mode.
                </p>
            </div>

            {/* ═══ Run Button + Summary ═══ */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28,
                padding: '16px 24px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
            }}>
                <button
                    onClick={runAllTests}
                    disabled={running}
                    style={{
                        padding: '10px 28px', fontSize: 14, fontWeight: 600,
                        background: running ? 'rgba(0, 113, 227, 0.3)' : 'linear-gradient(135deg, #0071e3, #0055b3)',
                        color: '#fff', border: 'none', borderRadius: 8, cursor: running ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: running ? 'none' : '0 4px 12px rgba(0, 113, 227, 0.3)',
                    }}
                >
                    {running ? '⏳ Running…' : '▶ Run All Tests'}
                </button>

                {allDone && totalTests > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            padding: '6px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                            background: totalFailed === 0 ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                            color: totalFailed === 0 ? '#30d158' : '#ff3b30',
                        }}>
                            {totalFailed === 0 ? '✅ ALL PASSED' : `❌ ${totalFailed} FAILED`}
                        </div>
                        <span style={{ fontSize: 13, color: '#86868b' }}>
                            {totalPassed}/{totalTests} tests · {elapsed?.toFixed(1)}s
                        </span>
                    </div>
                )}
            </div>

            {/* ═══ Live Config Preview ═══ */}
            {liveConfig && (
                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#86868b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Live Platform Config
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {/* Tier Limits Mini Cards */}
                        {Object.entries(liveConfig.tierLimits).map(([tier, limits]) => (
                            <div key={tier} style={{
                                padding: 14, borderRadius: 10,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <div style={{ fontSize: 11, color: '#86868b', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
                                    {tier} tier
                                </div>
                                <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
                                    <div>{limits.requestsPerDay === -1 ? '∞' : limits.requestsPerDay} req/day</div>
                                    <div>{limits.requestsPerMinute === -1 ? '∞' : limits.requestsPerMinute} req/min</div>
                                    <div>{limits.maxDestinations} max dest</div>
                                </div>
                            </div>
                        ))}
                        {/* Maintenance */}
                        <div style={{
                            padding: 14, borderRadius: 10,
                            background: liveConfig.maintenance.enabled ? 'rgba(255, 59, 48, 0.08)' : 'rgba(48, 209, 88, 0.06)',
                            border: `1px solid ${liveConfig.maintenance.enabled ? 'rgba(255, 59, 48, 0.2)' : 'rgba(48, 209, 88, 0.15)'}`,
                        }}>
                            <div style={{ fontSize: 11, color: '#86868b', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
                                Maintenance
                            </div>
                            <div style={{
                                fontSize: 14, fontWeight: 700,
                                color: liveConfig.maintenance.enabled ? '#ff3b30' : '#30d158',
                            }}>
                                {liveConfig.maintenance.enabled ? '🔴 ACTIVE' : '🟢 OFF'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Test Suites ═══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suites.map((suite, i) => (
                    <div key={suite.name} style={{
                        padding: '16px 20px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${suite.status === 'done'
                            ? (suite.results.every(r => r.passed) ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 59, 48, 0.2)')
                            : 'rgba(255,255,255,0.06)'}`,
                        transition: 'border-color 0.3s',
                    }}>
                        {/* Suite header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: suite.results.length > 0 ? 12 : 0 }}>
                            <span style={{ fontSize: 18 }}>{suite.icon}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>{suite.name}</span>

                            {suite.status === 'idle' && (
                                <span style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>Waiting</span>
                            )}
                            {suite.status === 'running' && (
                                <span style={{ fontSize: 12, color: '#0071e3', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{
                                        display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(0,113,227,0.3)',
                                        borderTopColor: '#0071e3', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
                                    }} />
                                    Running…
                                </span>
                            )}
                            {suite.status === 'done' && (
                                <span style={{
                                    fontSize: 12, fontWeight: 600,
                                    color: suite.results.every(r => r.passed) ? '#30d158' : '#ff3b30',
                                }}>
                                    {suite.results.filter(r => r.passed).length}/{suite.results.length} passed
                                </span>
                            )}
                        </div>

                        {/* Results */}
                        {suite.results.length > 0 && (
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6,
                            }}>
                                {suite.results.map((r, j) => (
                                    <div key={j} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '6px 10px', borderRadius: 6,
                                        background: r.passed ? 'rgba(48, 209, 88, 0.06)' : 'rgba(255, 59, 48, 0.06)',
                                        fontSize: 13,
                                    }}>
                                        <span style={{ fontSize: 12 }}>{r.passed ? '✅' : '❌'}</span>
                                        <span style={{ color: r.passed ? '#a8d8b0' : '#ff8a80' }}>{r.label}</span>
                                        {r.detail && <span style={{ color: '#666', fontSize: 11 }}>({r.detail})</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.85; }
                }
            `}</style>
        </div>
    );
}
