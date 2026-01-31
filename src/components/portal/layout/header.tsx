/**
 * Header Component
 * Top navigation bar for portal — contains the notification bell + drawer
 */

'use client';

import { useState } from 'react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

interface HeaderProps {
    user?: {
        name?: string | null;
        email: string;
        image?: string | null;
    };
}

export function Header({ user }: HeaderProps) {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);

    return (
        <>
            <header className="header">
                <div className="header-content">
                    <div className="header-search">
                        <input
                            type="search"
                            placeholder="Search..."
                            className="input"
                            style={{ marginBottom: 0 }}
                        />
                    </div>

                    <div className="header-actions">
                        {/* Notification Bell — the ONE true bell */}
                        <NotificationBell
                            onClick={() => setNotifOpen((v) => !v)}
                            isOpen={notifOpen}
                        />

                        <div style={{ position: 'relative' }}>
                            <button
                                className="header-icon-btn"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: 'var(--gradient-accent)',
                                    color: 'var(--white)',
                                    fontWeight: '600',
                                }}
                            >
                                {user?.name?.[0]?.toUpperCase() || user?.email[0]?.toUpperCase() || 'U'}
                            </button>

                            {showUserMenu && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: 'var(--space-2)',
                                        minWidth: '200px',
                                        background: 'var(--gray-800)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow-xl)',
                                        padding: 'var(--space-2)',
                                        zIndex: 900,
                                    }}
                                >
                                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                        <p style={{ fontWeight: '600', color: 'var(--white)', marginBottom: 'var(--space-1)' }}>
                                            {user?.name || 'User'}
                                        </p>
                                        <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                                            {user?.email}
                                        </p>
                                    </div>

                                    <a
                                        href="/settings"
                                        style={{
                                            display: 'block',
                                            padding: 'var(--space-3)',
                                            color: 'var(--gray-300)',
                                            textDecoration: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'background var(--duration-fast)',
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Settings
                                    </a>

                                    <a
                                        href="/api/auth/signout"
                                        style={{
                                            display: 'block',
                                            padding: 'var(--space-3)',
                                            color: 'var(--red)',
                                            textDecoration: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'background var(--duration-fast)',
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Sign Out
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Notification drawer — rendered outside the header so it can cover the full viewport */}
            <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
        </>
    );
}
