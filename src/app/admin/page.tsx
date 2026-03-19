/**
 * Admin Portal Entry
 * Redirects to admin dashboard
 */

import { redirect } from 'next/navigation';

export default function AdminPage() {
    redirect('/dashboard');
}
