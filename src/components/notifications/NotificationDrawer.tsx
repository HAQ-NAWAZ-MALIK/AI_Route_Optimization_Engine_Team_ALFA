/**
 * NotificationDrawer — slide-in panel showing user notifications.
 * Fetches full list on open, handles mark-read, mark-all-read.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { NotificationItem } from './NotificationItem';

interface Notification {
    id: string;
    type: string;
    priority: string;
    title: string;
    body: string;
    actionUrl: string | null;
    createdAt: string;
    isRead: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/portal/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications ?? []);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) fetchNotifications();
    }, [isOpen, fetchNotifications]);

    const handleRead = async (id: string) => {
        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        await fetch(`/api/portal/notifications/${id}/read`, { method: 'POST' });
    };

    const handleMarkAllRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        await fetch('/api/portal/notifications/read-all', { method: 'POST' });
    };

    const displayed = filter === 'unread'
        ? notifications.filter((n) => !n.isRead)
        : notifications;

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop — solid dark, NO blur/glassmorphism */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000,
                    background: 'rgba(0, 0, 0, 0.72)',
                }}
            />

            {/* Drawer panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '390px',
                maxWidth: '95vw',
                zIndex: 10001,
                display: 'flex',
                flexDirection: 'column',
                background: '#0f172a',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
                animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 16px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--white)' }}>
                            Notifications
                        </h2>
                        {unreadCount > 0 && (
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-500)' }}>
                                {unreadCount} unread
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '6px',
                                    color: 'var(--gray-400)',
                                    fontSize: '12px',
                                    padding: '4px 10px',
                                    cursor: 'pointer',
                                }}
                            >
                                Mark all read
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--gray-400)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Filter tabs */}
                <div style={{
                    display: 'flex',
                    padding: '8px 16px',
                    gap: '4px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {(['all', 'unread'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '5px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: filter === f ? 'rgba(96,165,250,0.15)' : 'transparent',
                                color: filter === f ? '#60a5fa' : 'var(--gray-500)',
                                fontSize: '13px',
                                fontWeight: filter === f ? '600' : '400',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                            }}
                        >
                            {f}
                            {f === 'unread' && unreadCount > 0 && (
                                <span style={{
                                    marginLeft: '5px',
                                    background: '#60a5fa',
                                    color: 'white',
                                    borderRadius: '10px',
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    fontWeight: '700',
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {isLoading ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '14px' }}>
                            Loading…
                        </div>
                    ) : displayed.length === 0 ? (
                        <div style={{
                            padding: '48px 24px',
                            textAlign: 'center',
                            color: 'var(--gray-500)',
                        }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔔</div>
                            <p style={{ margin: 0, fontSize: '14px' }}>
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                        </div>
                    ) : (
                        displayed.map((n) => (
                            <NotificationItem key={n.id} notification={n} onRead={handleRead} />
                        ))
                    )}
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                @keyframes bellPop {
                    0%   { transform: scale(0.5); }
                    70%  { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </>
    );
}
