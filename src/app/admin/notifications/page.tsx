/**
 * Admin Notifications Page
 * Compose and send notifications to users. View history with read stats.
 * Route: /admin/notifications
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ─── Types ─────────────────────────────────────────────

interface Notification {
    id: string;
    type: string;
    priority: string;
    title: string;
    body: string;
    actionUrl: string | null;
    userId: string | null;
    targetPlans: string[];
    scheduledAt: string | null;
    sentAt: string | null;
    createdAt: string;
    readCount: number;
}

const TYPE_OPTIONS = ['SYSTEM', 'BILLING', 'ANNOUNCEMENT', 'SECURITY', 'API_ALERT'];
const PRIORITY_OPTIONS = ['NORMAL', 'IMPORTANT', 'URGENT'];
const PLAN_OPTIONS = ['FREE', 'TRIAL', 'PRO', 'ENTERPRISE'];

const TYPE_ICON: Record<string, string> = {
    SYSTEM: '⚙️', BILLING: '💳', ANNOUNCEMENT: '📢', SECURITY: '🔐', API_ALERT: '⚡',
};
const PRIORITY_COLOR: Record<string, string> = {
    NORMAL: 'var(--gray-500)', IMPORTANT: '#f59e0b', URGENT: '#ef4444',
};

function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

// ─── Component ─────────────────────────────────────────

export default function AdminNotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

    // Form state
    const [form, setForm] = useState({
        type: 'ANNOUNCEMENT',
        priority: 'NORMAL',
        title: '',
        body: '',
        actionUrl: '',
        targetMode: 'broadcast',   // 'broadcast' | 'plans' | 'user'
        targetUserId: '',
        targetPlans: [] as string[],
        scheduledAt: '',
    });

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/admin/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications ?? []);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchNotifications(); }, []);

    const togglePlan = (plan: string) => {
        setForm((f) => ({
            ...f,
            targetPlans: f.targetPlans.includes(plan)
                ? f.targetPlans.filter((p) => p !== plan)
                : [...f.targetPlans, plan],
        }));
    };

    const handleSend = async () => {
        if (!form.title.trim() || !form.body.trim()) return;
        setIsSending(true);
        try {
            const payload: Record<string, any> = {
                type: form.type,
                priority: form.priority,
                title: form.title.trim(),
                body: form.body.trim(),
                actionUrl: form.actionUrl.trim() || null,
                scheduledAt: form.scheduledAt || null,
            };

            if (form.targetMode === 'user') {
                payload.userId = form.targetUserId.trim();
            } else if (form.targetMode === 'plans') {
                payload.targetPlans = form.targetPlans;
            } else {
                payload.targetPlans = [];
            }

            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setForm({
                    type: 'ANNOUNCEMENT', priority: 'NORMAL', title: '', body: '',
                    actionUrl: '', targetMode: 'broadcast', targetUserId: '',
                    targetPlans: [], scheduledAt: '',
                });
                fetchNotifications();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to send notification');
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleRetract = async (id: string) => {
        if (!confirm('Retract this notification? Users will no longer see it.')) return;
        const res = await fetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
        if (res.ok) fetchNotifications();
    };

    const selectStyle = {
        width: '100%',
        padding: 'var(--space-2)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--white)',
        fontSize: '14px',
    };
    const textareaStyle = {
        ...selectStyle,
        resize: 'vertical' as const,
        minHeight: '90px',
        fontFamily: 'inherit',
    };
    const labelStyle = {
        fontSize: '12px',
        color: 'var(--gray-400)',
        display: 'block',
        marginBottom: 'var(--space-1)',
        fontWeight: '500',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    };

    return (
        <div style={{ padding: 'var(--space-6)' }}>
            <div className="page-header">
                <h1 className="page-title">Notifications</h1>
                <p className="page-description">Send notifications to users. Broadcasts reach everyone; you can also target by plan or individual user.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 'var(--space-6)', alignItems: 'start' }}>

                {/* ─── Compose Panel ─────────────────────── */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>Compose</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {/* Type + Priority row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={labelStyle}>Type</label>
                                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={selectStyle}>
                                    {TYPE_OPTIONS.map((t) => (
                                        <option key={t} value={t}>{TYPE_ICON[t]} {t.replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Priority</label>
                                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={selectStyle}>
                                    {PRIORITY_OPTIONS.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label style={labelStyle}>Title</label>
                            <Input
                                id="notif-title"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Short, clear title…"
                                maxLength={120}
                            />
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--gray-500)' }}>
                                {form.title.length}/120
                            </p>
                        </div>

                        {/* Body */}
                        <div>
                            <label style={labelStyle}>Message</label>
                            <textarea
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                placeholder="Full notification message…"
                                maxLength={1000}
                                style={textareaStyle}
                            />
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--gray-500)' }}>
                                {form.body.length}/1000
                            </p>
                        </div>

                        {/* Action URL */}
                        <div>
                            <label style={labelStyle}>Action URL (optional)</label>
                            <Input id="notif-url" value={form.actionUrl} onChange={(e) => setForm({ ...form, actionUrl: e.target.value })} placeholder="/billing" />
                        </div>

                        {/* Target Mode */}
                        <div>
                            <label style={labelStyle}>Send to</label>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                {(['broadcast', 'plans', 'user'] as const).map((mode) => (
                                    <button key={mode} onClick={() => setForm({ ...form, targetMode: mode })} style={{
                                        flex: 1, padding: '7px 4px', borderRadius: 'var(--radius-sm)',
                                        border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                                        background: form.targetMode === mode ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                                        color: form.targetMode === mode ? '#60a5fa' : 'var(--gray-400)',
                                    }}>
                                        {mode === 'broadcast' ? '🌐 All Users' : mode === 'plans' ? '📦 By Plan' : '👤 User'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.targetMode === 'plans' && (
                            <div>
                                <label style={labelStyle}>Target Plans</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                    {PLAN_OPTIONS.map((plan) => (
                                        <button key={plan} onClick={() => togglePlan(plan)} style={{
                                            padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                                            border: '1px solid ' + (form.targetPlans.includes(plan) ? '#60a5fa' : 'rgba(255,255,255,0.1)'),
                                            background: form.targetPlans.includes(plan) ? 'rgba(96,165,250,0.15)' : 'transparent',
                                            color: form.targetPlans.includes(plan) ? '#60a5fa' : 'var(--gray-400)',
                                            fontWeight: form.targetPlans.includes(plan) ? '600' : '400',
                                        }}>
                                            {plan}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {form.targetMode === 'user' && (
                            <div>
                                <label style={labelStyle}>User ID or Email</label>
                                <Input
                                    id="notif-user"
                                    value={form.targetUserId}
                                    onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}
                                    placeholder="user_id or email@example.com"
                                />
                            </div>
                        )}

                        {/* Schedule */}
                        <div>
                            <label style={labelStyle}>Schedule (optional)</label>
                            <input
                                type="datetime-local"
                                value={form.scheduledAt}
                                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                                style={{ ...selectStyle }}
                            />
                        </div>

                        <Button
                            variant="primary"
                            onClick={handleSend}
                            disabled={isSending || !form.title || !form.body}
                            style={{ width: '100%', marginTop: 'var(--space-2)' }}
                        >
                            {isSending ? 'Sending…' : form.scheduledAt ? '📅 Schedule Notification' : '📨 Send Now'}
                        </Button>
                    </div>
                </div>

                {/* ─── History Panel ──────────────────────── */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>
                        Sent Notifications
                        <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '400', color: 'var(--gray-500)' }}>
                            ({notifications.length})
                        </span>
                    </h3>

                    {isLoading ? (
                        <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>Loading…</p>
                    ) : notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--gray-500)' }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                            <p style={{ margin: 0, fontSize: '14px' }}>No notifications yet</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {notifications.map((n) => (
                                <div key={n.id} style={{
                                    padding: 'var(--space-4)',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '16px' }}>{TYPE_ICON[n.type]}</span>
                                            <span style={{
                                                fontSize: '13px', fontWeight: '600', color: 'var(--white)',
                                            }}>
                                                {n.title}
                                            </span>
                                            <span style={{
                                                fontSize: '11px', fontWeight: '600',
                                                color: PRIORITY_COLOR[n.priority],
                                                textTransform: 'uppercase',
                                            }}>
                                                {n.priority !== 'NORMAL' ? n.priority : ''}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRetract(n.id)}
                                            title="Retract notification"
                                            style={{
                                                background: 'transparent', border: 'none',
                                                color: 'var(--gray-600)', cursor: 'pointer',
                                                fontSize: '13px', padding: '2px 6px', borderRadius: '4px',
                                                flexShrink: 0,
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <p style={{ margin: '6px 0 8px', fontSize: '12px', color: 'var(--gray-400)', lineHeight: '1.5' }}>
                                        {n.body}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <Badge variant={n.userId ? 'info' : n.targetPlans.length > 0 ? 'warning' : 'default'}>
                                            {n.userId ? '👤 User' : n.targetPlans.length > 0 ? `📦 ${n.targetPlans.join(', ')}` : '🌐 Broadcast'}
                                        </Badge>
                                        <span style={{ fontSize: '11px', color: 'var(--gray-600)' }}>
                                            👁 {n.readCount} reads
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--gray-600)' }}>
                                            {n.sentAt ? `Sent ${timeAgo(n.sentAt)}` : `Scheduled: ${n.scheduledAt ? new Date(n.scheduledAt).toLocaleString() : '—'}`}
                                        </span>
                                        {n.actionUrl && (
                                            <span style={{ fontSize: '11px', color: '#60a5fa' }}>🔗 {n.actionUrl}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
