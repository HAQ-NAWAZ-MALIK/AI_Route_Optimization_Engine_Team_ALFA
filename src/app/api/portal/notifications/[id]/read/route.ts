/**
 * Mark Single Notification as Read
 * POST /api/portal/notifications/[id]/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { markAsRead } from '@/lib/notifications/notification-service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await requireAuth();
        await markAsRead(session.user.id, id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
