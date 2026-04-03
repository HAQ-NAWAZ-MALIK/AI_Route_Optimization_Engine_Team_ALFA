/**
 * Portal Notifications API
 * GET /api/portal/notifications — user's notifications with read status
 */

import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { getUserNotifications } from '@/lib/notifications/notification-service';

export async function GET() {
    try {
        const session = await requireAuth();
        const notifications = await getUserNotifications(session.user.id);
        return NextResponse.json({ success: true, notifications });
    } catch (error) {
        return handleApiError(error);
    }
}
