/**
 * Portal Layout
 * Wrapper for all authenticated portal pages
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { PortalLayout as Layout } from '@/components/portal/layout/portal-layout';

export default async function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    return <Layout user={{ ...session.user, id: session.user.id, role: session.user.role || 'USER' }}>{children}</Layout>;
}
