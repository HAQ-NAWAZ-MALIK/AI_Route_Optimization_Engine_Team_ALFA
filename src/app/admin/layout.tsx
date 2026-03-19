/**
 * Admin Layout
 * Protected layout for admin portal with role check
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { PortalLayout } from '@/components/portal/layout/portal-layout';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Redirect if not logged in
    if (!session?.user) {
        redirect('/login');
    }

    // Redirect if not admin
    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    return (
        <PortalLayout user={session.user}>
            {/* Admin indicator banner */}
            <div style={{
                background: 'rgba(255, 159, 10, 0.1)',
                borderBottom: '1px solid rgba(255, 159, 10, 0.3)',
                padding: 'var(--space-3) var(--space-6)',
                marginBottom: 'var(--space-6)',
            }}>
                <div style={{ fontSize: '13px', color: 'var(--orange)', fontWeight: '500' }}>
                    🔐 Admin Portal
                </div>
            </div>
            {children}
        </PortalLayout>
    );
}
