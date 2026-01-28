/**
 * Sidebar Component
 * Navigation sidebar for portal with role-based navigation
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface SidebarProps {
    user?: {
        role?: string;
        name?: string | null;
        email?: string | null;
    };
}

interface SidebarLinkProps {
    href: string;
    icon: ReactNode;
    label: string;
}

function SidebarLink({ href, icon, label }: SidebarLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        >
            <span className="sidebar-link-icon">{icon}</span>
            <span className="sidebar-link-text">{label}</span>
        </Link>
    );
}

interface SidebarSectionProps {
    title: string;
    children: ReactNode;
}

function SidebarSection({ title, children }: SidebarSectionProps) {
    return (
        <div className="sidebar-section">
            <p className="sidebar-section-title">{title}</p>
            {children}
        </div>
    );
}

export function Sidebar({ user }: SidebarProps) {
    const isAdmin = user?.role === 'ADMIN';

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Link href={isAdmin ? "/admin/dashboard" : "/dashboard"} className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0L0 4v8l8 4 8-4V4L8 0zm0 2.5L13 5 8 7.5 3 5l5-2.5zM2 6.5l5 2.5v5l-5-2.5v-5zm12 0v5l-5 2.5v-5l5-2.5z" />
                        </svg>
                    </div>
                    <span>RouteOptimizer</span>
                </Link>
            </div>

            <nav className="sidebar-nav">
                {isAdmin ? (
                    <>
                        <SidebarSection title="Admin">
                            <SidebarLink
                                href="/admin/dashboard"
                                icon={<DashboardIcon />}
                                label="Dashboard"
                            />
                            <SidebarLink
                                href="/admin/users"
                                icon={<UsersIcon />}
                                label="Users"
                            />
                            <SidebarLink
                                href="/admin/keys"
                                icon={<KeyIcon />}
                                label="API Keys"
                            />
                            <SidebarLink
                                href="/admin/analytics"
                                icon={<ChartIcon />}
                                label="Analytics"
                            />
                            <SidebarLink
                                href="/admin/billing"
                                icon={<DocsIcon />}
                                label="Billing"
                            />
                            <SidebarLink
                                href="/admin/notifications"
                                icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}
                                label="Notifications"
                            />
                            <SidebarLink
                                href="/admin/system"
                                icon={<SettingsIcon />}
                                label="System"
                            />
                        </SidebarSection>

                        <SidebarSection title="Resources">
                            <SidebarLink
                                href="/docs"
                                icon={<DocsIcon />}
                                label="Documentation"
                            />
                        </SidebarSection>
                    </>
                ) : (
                    <>
                        <SidebarSection title="Main">
                            <SidebarLink
                                href="/dashboard"
                                icon={<DashboardIcon />}
                                label="Dashboard"
                            />
                            <SidebarLink
                                href="/api-keys"
                                icon={<KeyIcon />}
                                label="API Keys"
                            />
                            <SidebarLink
                                href="/usage"
                                icon={<ChartIcon />}
                                label="Usage"
                            />
                            <SidebarLink
                                href="/billing"
                                icon={<CreditCardIcon />}
                                label="Billing"
                            />
                        </SidebarSection>

                        <SidebarSection title="Settings">
                            <SidebarLink
                                href="/settings"
                                icon={<SettingsIcon />}
                                label="Settings"
                            />
                            <SidebarLink
                                href="/docs"
                                icon={<DocsIcon />}
                                label="Documentation"
                            />
                        </SidebarSection>
                    </>
                )}
            </nav>
        </aside>
    );
}

// Simple SVG Icons
function DashboardIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="13" width="7" height="4" rx="1" />
            <rect x="13" y="3" width="4" height="4" rx="1" />
            <rect x="13" y="10" width="4" height="7" rx="1" />
        </svg>
    );
}

function UsersIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
    );
}

function KeyIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10l7 7M14 11l2-2M17 14l-2 2" />
        </svg>
    );
}

function ChartIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 17V9l4-4 4 4 6-6v14H3z" />
        </svg>
    );
}

function CreditCardIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="16" height="10" rx="2" />
            <line x1="2" y1="9" x2="18" y2="9" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="10" cy="10" r="3" />
            <path d="M12 2l1.5 1.5M2 12l1.5-1.5M12 18l1.5-1.5M18 12l-1.5-1.5M8 2L6.5 3.5M2 8l1.5 1.5M8 18L6.5 16.5M18 8l-1.5 1.5" />
        </svg>
    );
}

function DocsIcon() {
    return (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h8l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
            <polyline points="12 4 12 8 16 8" />
        </svg>
    );
}
