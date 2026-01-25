/**
 * Portal Layout
 * Main layout wrapper for authenticated portal pages
 */

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface PortalLayoutProps {
    children: ReactNode;
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        role: string;
    };
}

export function PortalLayout({ children, user }: PortalLayoutProps) {
    return (
        <div className="portal-wrapper">
            <Sidebar user={user} />
            <div className="portal-main">
                <Header user={user} />
                <main className="portal-content">{children}</main>
            </div>
        </div>
    );
}
