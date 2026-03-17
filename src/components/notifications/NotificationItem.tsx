/**
 * NotificationItem — Single notification row in the drawer
 */

'use client';

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
    notification: Notification;
    onRead: (id: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
    SYSTEM: { icon: '⚙️', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
    BILLING: { icon: '💳', color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
    ANNOUNCEMENT: { icon: '📢', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
    SECURITY: { icon: '🔐', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    API_ALERT: { icon: '⚡', color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
};

const PRIORITY_COLOR: Record<string, string> = {
    NORMAL: 'transparent',
    IMPORTANT: '#f59e0b',
    URGENT: '#ef4444',
};

function timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationItem({ notification, onRead }: Props) {
    const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.SYSTEM;
    const priorityColor = PRIORITY_COLOR[notification.priority] ?? 'transparent';

    const handleClick = () => {
        if (!notification.isRead) onRead(notification.id);
        if (notification.actionUrl) window.location.href = notification.actionUrl;
    };

    return (
        <div
            onClick={handleClick}
            style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 16px',
                cursor: notification.actionUrl || !notification.isRead ? 'pointer' : 'default',
                background: notification.isRead ? 'transparent' : 'rgba(255,255,255,0.025)',
                borderLeft: `3px solid ${notification.isRead ? 'transparent' : priorityColor === 'transparent' ? 'rgba(255,255,255,0.1)' : priorityColor}`,
                transition: 'background 0.15s',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = notification.isRead ? 'transparent' : 'rgba(255,255,255,0.025)')}
        >
            {/* Icon */}
            <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: cfg.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
            }}>
                {cfg.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: notification.isRead ? '400' : '600',
                        color: notification.isRead ? 'var(--gray-300)' : 'var(--white)',
                        lineHeight: '1.4',
                    }}>
                        {notification.title}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--gray-500)', flexShrink: 0 }}>
                        {timeAgo(notification.createdAt)}
                    </span>
                </div>
                <p style={{
                    margin: '3px 0 0',
                    fontSize: '12px',
                    color: 'var(--gray-500)',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                }}>
                    {notification.body}
                </p>
                {notification.priority !== 'NORMAL' && (
                    <span style={{
                        display: 'inline-block',
                        marginTop: '4px',
                        fontSize: '10px',
                        fontWeight: '600',
                        color: priorityColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>
                        {notification.priority}
                    </span>
                )}
            </div>

            {/* Unread dot */}
            {!notification.isRead && (
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#60a5fa',
                    flexShrink: 0,
                    marginTop: '6px',
                }} />
            )}
        </div>
    );
}
