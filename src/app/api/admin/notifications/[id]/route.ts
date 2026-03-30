/**
 * Admin Notification Detail API
 * DELETE /api/admin/notifications/[id] — retract (soft-delete) a notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { deleteNotification } from '@/lib/notifications/notification-service';
import { prisma } from '@/lib/db/prisma';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await requireAdmin();

        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) {
            throw Errors.notFound('Notification');
        }

        await deleteNotification(id);

        return NextResponse.json({ success: true, message: 'Notification retracted' });
    } catch (error) {
        return handleApiError(error);
    }
}
