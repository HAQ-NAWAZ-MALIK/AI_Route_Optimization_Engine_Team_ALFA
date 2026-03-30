/**
 * Admin Notifications API
 * GET  /api/admin/notifications — list all notifications with read stats
 * POST /api/admin/notifications — create broadcast/targeted notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { createNotification, getAllNotifications } from '@/lib/notifications/notification-service';
import { NotificationType, NotificationPriority, SubscriptionPlan } from '@prisma/client';
import { z } from 'zod';

// ─── GET — List all ────────────────────────────────────

export async function GET() {
    try {
        await requireAdmin();
        const notifications = await getAllNotifications();
        return NextResponse.json({ success: true, notifications });
    } catch (error) {
        return handleApiError(error);
    }
}

// ─── POST — Create ─────────────────────────────────────

const CreateSchema = z.object({
    type: z.nativeEnum(NotificationType),
    priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(1000),
    actionUrl: z.string().url().optional().nullable(),
    /** null or omit = broadcast; string = specific user ID */
    userId: z.string().optional().nullable(),
    /** [] = all plans; non-empty = specific plans */
    targetPlans: z.array(z.nativeEnum(SubscriptionPlan)).default([]),
    scheduledAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdmin();
        const body = await request.json();
        const data = CreateSchema.parse(body);

        // Validate: if userId given, targetPlans must be empty
        if (data.userId && data.targetPlans.length > 0) {
            throw Errors.badRequest('Cannot combine userId with targetPlans. Use one or the other.');
        }

        const notification = await createNotification({
            type: data.type,
            priority: data.priority,
            title: data.title,
            body: data.body,
            actionUrl: data.actionUrl ?? undefined,
            userId: data.userId ?? null,
            targetPlans: data.targetPlans as SubscriptionPlan[],
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
            createdBy: session.user.id,
        });

        return NextResponse.json({ success: true, notification }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
