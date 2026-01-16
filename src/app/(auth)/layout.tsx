/**
 * Auth Layout
 * Minimal layout for authentication pages
 */

import { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gradient-hero)',
            padding: 'var(--space-6)',
        }}>
            {/* Logo */}
            <Link href="/" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-12)',
                textDecoration: 'none',
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'var(--gradient-accent)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <svg width="24" height="24" viewBox="0 0 16 16" fill="white">
                        <path d="M8 0L0 4v8l8 4 8-4V4L8 0zm0 2.5L13 5 8 7.5 3 5l5-2.5zM2 6.5l5 2.5v5l-5-2.5v-5zm12 0v5l-5 2.5v-5l5-2.5z" />
                    </svg>
                </div>
                <span style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: 'var(--white)',
                }}>RouteOptimizer AI</span>
            </Link>

            {/* Auth Card */}
            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-10)',
                boxShadow: 'var(--shadow-xl)',
            }}>
                {children}
            </div>

            {/* Footer */}
            <p style={{
                marginTop: 'var(--space-8)',
                fontSize: '14px',
                color: 'var(--gray-500)',
            }}>
                © 2025 RouteOptimizer AI. All rights reserved.
            </p>
        </div>
    );
}
