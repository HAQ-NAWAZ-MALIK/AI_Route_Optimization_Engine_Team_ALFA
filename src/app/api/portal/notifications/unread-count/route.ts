/**
 * Portal Notifications Unread Count API
 * GET /api/portal/notifications/unread-count — badge count for bell icon
 */

import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { getUnreadCount } from '@/lib/notifications/notification-service';

export async function GET() {
    try {
        const session = await requireAuth();
        const count = await getUnreadCount(session.user.id);
        return NextResponse.json({ success: true, count });
    } catch (error) {
        return handleApiError(error);
    }
}
