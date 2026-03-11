/**
 * NotificationBell — Bell icon with unread count badge
 * Polls /api/portal/notifications/unread-count every 30 seconds
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface Props {
    onClick: () => void;
    isOpen: boolean;
}

export function NotificationBell({ onClick, isOpen }: Props) {
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        try {
            const res = await fetch('/api/portal/notifications/unread-count');
            if (res.ok) {
                const data = await res.json();
                setCount(data.count ?? 0);
            }
        } catch {
            // Silently fail — bell still renders
        }
    }, []);

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 30_000);
        return () => clearInterval(interval);
    }, [fetchCount]);

    // Reset local count immediately when drawer opens (optimistic)
    useEffect(() => {
        if (isOpen) setCount(0);
    }, [isOpen]);

    return (
        <button
            onClick={onClick}
            title="Notifications"
            style={{
                position: 'relative',
                background: isOpen ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
                color: isOpen ? 'var(--white)' : 'var(--gray-400)',
            }}
            onMouseEnter={(e) => {
                if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
                if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
        >
            {/* Bell SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>

            {/* Badge */}
            {count > 0 && (
                <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'var(--red, #ef4444)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                    animation: 'bellPop 0.3s ease',
                }}>
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
}
