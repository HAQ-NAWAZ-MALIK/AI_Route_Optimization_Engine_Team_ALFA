/**
 * Notification Service
 * Create, retrieve, and manage notifications for users.
 * Supports broadcast, plan-targeted, and user-specific notifications.
 */

import { prisma } from '@/lib/db/prisma';
import { NotificationType, NotificationPriority, SubscriptionPlan } from '@prisma/client';

// ─── Types ─────────────────────────────────────────────

export interface CreateNotificationInput {
    type: NotificationType;
    priority?: NotificationPriority;
    title: string;
    body: string;
    /** null = broadcast to all users, string = specific user */
    userId?: string | null;
    /** Only notify users on these plans (null = all plans) */
    targetPlans?: SubscriptionPlan[];
    /** ISO string — schedule for future delivery */
    scheduledAt?: Date;
    /** Admin user ID who created this */
    createdBy?: string;
    /** Optional action URL the notification can link to */
    actionUrl?: string;
}

export interface NotificationWithRead {
    id: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    body: string;
    actionUrl: string | null;
    createdAt: Date;
    sentAt: Date | null;
    isRead: boolean;
    readAt: Date | null;
}

// ─── Create ────────────────────────────────────────────

/**
 * Create a notification (broadcast, plan-targeted, or per-user)
 */
export async function createNotification(input: CreateNotificationInput) {
    return await prisma.notification.create({
        data: {
            type: input.type,
            priority: input.priority ?? NotificationPriority.NORMAL,
            title: input.title,
            body: input.body,
            userId: input.userId ?? null,
            targetPlans: input.targetPlans ?? [],
            scheduledAt: input.scheduledAt ?? null,
            sentAt: input.scheduledAt ? null : new Date(),
            createdBy: input.createdBy ?? null,
            actionUrl: input.actionUrl ?? null,
        },
    });
}

/**
 * Auto-trigger helper — quickly send a system notification to a specific user
 */
export async function notifyUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    options?: { priority?: NotificationPriority; actionUrl?: string }
) {
    return createNotification({
        type,
        priority: options?.priority ?? NotificationPriority.NORMAL,
        title,
        body,
        userId,
        actionUrl: options?.actionUrl,
    });
}

// ─── Read ──────────────────────────────────────────────

/**
 * Get all notifications for a user (personal + broadcasts that match plan)
 * Returns newest first, max 50
 */
export async function getUserNotifications(
    userId: string,
    limit = 50
): Promise<NotificationWithRead[]> {
    // Get user's current plan
    const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { plan: true },
    });
    const plan = sub?.plan ?? SubscriptionPlan.FREE;

    // Find all notifications visible to this user:
    // 1. Personal (userId = this user)
    // 2. Global broadcast (userId = null, targetPlans = [] or includes user's plan)
    const notifications = await prisma.notification.findMany({
        where: {
            deletedAt: null,
            sentAt: { not: null, lte: new Date() },
            OR: [
                { userId },
                {
                    userId: null,
                    OR: [
                        { targetPlans: { isEmpty: true } },
                        { targetPlans: { has: plan } },
                    ],
                },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            reads: {
                where: { userId },
                select: { readAt: true },
            },
        },
    });

    return notifications.map((n) => ({
        id: n.id,
        type: n.type,
        priority: n.priority,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl,
        createdAt: n.createdAt,
        sentAt: n.sentAt,
        isRead: n.reads.length > 0,
        readAt: n.reads[0]?.readAt ?? null,
    }));
}

/**
 * Fast unread count — used for the bell badge
 */
export async function getUnreadCount(userId: string): Promise<number> {
    const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { plan: true },
    });
    const plan = sub?.plan ?? SubscriptionPlan.FREE;

    // Get IDs of notifications already read
    const readIds = await prisma.notificationRead.findMany({
        where: { userId },
        select: { notificationId: true },
    });
    const readSet = new Set(readIds.map((r) => r.notificationId));

    const all = await prisma.notification.findMany({
        where: {
            deletedAt: null,
            sentAt: { not: null, lte: new Date() },
            OR: [
                { userId },
                {
                    userId: null,
                    OR: [
                        { targetPlans: { isEmpty: true } },
                        { targetPlans: { has: plan } },
                    ],
                },
            ],
        },
        select: { id: true },
    });

    return all.filter((n) => !readSet.has(n.id)).length;
}

// ─── Mark Read ─────────────────────────────────────────

/**
 * Mark a single notification as read for this user
 */
export async function markAsRead(userId: string, notificationId: string) {
    return await prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId, userId } },
        create: { notificationId, userId, readAt: new Date() },
        update: { readAt: new Date() },
    });
}

/**
 * Mark ALL notifications as read for this user
 */
export async function markAllRead(userId: string) {
    const notifications = await getUserNotifications(userId);
    const unread = notifications.filter((n) => !n.isRead);

    if (unread.length === 0) return { count: 0 };

    await prisma.notificationRead.createMany({
        data: unread.map((n) => ({
            notificationId: n.id,
            userId,
            readAt: new Date(),
        })),
        skipDuplicates: true,
    });

    return { count: unread.length };
}

// ─── Admin ─────────────────────────────────────────────

/**
 * Soft-delete a notification (retract)
 */
export async function deleteNotification(id: string) {
    return await prisma.notification.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
}

/**
 * List all notifications for admin view with aggregated read stats
 */
export async function getAllNotifications(limit = 100) {
    const notifications = await prisma.notification.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            _count: { select: { reads: true } },
        },
    });

    return notifications.map((n) => ({
        ...n,
        readCount: n._count.reads,
        _count: undefined,
    }));
}

// ─── Auto-Trigger Helpers ──────────────────────────────

export async function notifyPlanLimitReached(userId: string, plan: string, used: number, max: number) {
    return notifyUser(
        userId,
        NotificationType.API_ALERT,
        'Monthly API limit reached',
        `You've used all ${max.toLocaleString()} requests for your ${plan} plan this month. Upgrade to continue using the API.`,
        { priority: NotificationPriority.URGENT, actionUrl: '/billing' }
    );
}

export async function notifyPlanLimitWarning(userId: string, plan: string, percent: number) {
    return notifyUser(
        userId,
        NotificationType.API_ALERT,
        `${percent}% of your API limit used`,
        `You're approaching your ${plan} plan's monthly request limit. Consider upgrading to avoid service interruption.`,
        { priority: NotificationPriority.IMPORTANT, actionUrl: '/billing' }
    );
}

export async function notifySubscriptionCancelled(userId: string, plan: string, endDate: Date) {
    return notifyUser(
        userId,
        NotificationType.BILLING,
        'Subscription cancelled',
        `Your ${plan} subscription has been cancelled. You'll retain access until ${endDate.toLocaleDateString()}.`,
        { priority: NotificationPriority.IMPORTANT, actionUrl: '/billing' }
    );
}

export async function notifyPlanChanged(userId: string, oldPlan: string, newPlan: string, byAdmin = false) {
    return notifyUser(
        userId,
        NotificationType.BILLING,
        'Your plan has been updated',
        byAdmin
            ? `An admin has upgraded your account from ${oldPlan} to ${newPlan}.`
            : `Your subscription has been updated from ${oldPlan} to ${newPlan}.`,
        { priority: NotificationPriority.IMPORTANT, actionUrl: '/billing' }
    );
}

export async function notifyApiKeyCreated(userId: string, keyName: string) {
    return notifyUser(
        userId,
        NotificationType.SECURITY,
        'New API key created',
        `A new API key "${keyName}" was created on your account. If this wasn't you, revoke it immediately.`,
        { priority: NotificationPriority.IMPORTANT, actionUrl: '/api-keys' }
    );
}
