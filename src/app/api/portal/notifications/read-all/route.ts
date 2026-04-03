/**
 * Mark All Notifications as Read
 * POST /api/portal/notifications/read-all
 */

import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { markAllRead } from '@/lib/notifications/notification-service';

export async function POST() {
    try {
        const session = await requireAuth();
        const result = await markAllRead(session.user.id);
        return NextResponse.json({ success: true, markedRead: result.count });
    } catch (error) {
        return handleApiError(error);
    }
}
