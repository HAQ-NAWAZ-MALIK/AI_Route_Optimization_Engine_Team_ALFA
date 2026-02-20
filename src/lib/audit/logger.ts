/**
 * Audit Logging System
 * Track all admin actions and sensitive operations
 */

import { prisma } from '@/lib/db/prisma';
import { headers } from 'next/headers';

export type AuditAction =
    | 'USER_ROLE_CHANGED'
    | 'USER_SUSPENDED'
    | 'USER_ACTIVATED'
    | 'USER_DELETED'
    | 'API_KEY_REVOKED_BY_ADMIN'
    | 'API_KEY_RATE_LIMIT_CHANGED'
    | 'USAGE_DATA_EXPORTED'
    | 'SYSTEM_SETTINGS_CHANGED'
    | 'ADMIN_SET_USER_PLAN'
    | 'PROMO_CODE_CREATED'
    | 'PROMO_CODE_DISABLED'
    | 'SUBSCRIPTION_CREATED'
    | 'SUBSCRIPTION_CANCELED';

export interface AuditLogDetails {
    targetUserId?: string;
    targetUserEmail?: string;
    apiKeyId?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    [key: string]: any;
}

/**
 * Create an audit log entry
 * @param action - Type of action performed
 * @param adminId - ID of admin who performed action
 * @param details - Additional details about the action
 */
export async function logAuditEvent(
    action: AuditAction,
    adminId: string,
    details: AuditLogDetails = {}
): Promise<void> {
    try {
        const headersList = await headers();
        const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headersList.get('x-real-ip')
            || 'unknown';

        const userAgent = headersList.get('user-agent') || 'unknown';

        await prisma.auditLog.create({
            data: {
                action,
                userId: adminId,
                details: details as any, // Prisma Json type
                ipAddress,
                userAgent,
                timestamp: new Date(),
            },
        });

        console.log(`[AUDIT] ${action} by user ${adminId}`, details);
    } catch (error) {
        // Don't fail the request if audit logging fails
        console.error('[AUDIT LOG ERROR]', error);
    }
}

/**
 * Get recent audit logs for admin dashboard
 */
export async function getRecentAuditLogs(limit: number = 100) {
    return await prisma.auditLog.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
            user: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
    });
}

/**
 * Get audit logs for specific user
 */
export async function getUserAuditLogs(userId: string, limit: number = 50) {
    return await prisma.auditLog.findMany({
        where: {
            OR: [
                { userId },
                { details: { path: ['targetUserId'], equals: userId } },
            ],
        },
        take: limit,
        orderBy: { timestamp: 'desc' },
    });
}
