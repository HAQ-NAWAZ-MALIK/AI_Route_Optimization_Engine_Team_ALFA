/**
 * Admin API: Delete User
 * DELETE /api/admin/users/[id]
 * 
 * Permanently delete a user and all associated data.
 * Prevents deletion of users with active paid subscriptions.
 * Cascade deletes API keys, usage logs, and other related data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { preventSelfModification } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Prevent self-deletion and ensure admin session
        const session = await preventSelfModification(params.id);

        // Find target user with subscription info
        const targetUser = await prisma.user.findUnique({
            where: { id: params.id },
            include: {
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    select: {
                        id: true,
                        plan: true,
                        status: true,
                    },
                },
                apiKeys: { select: { id: true } },
                usageLogs: { select: { id: true } },
            },
        });

        if (!targetUser) {
            throw Errors.notFound('User');
        }

        // Check for active paid subscriptions
        const activePaidSubscription = targetUser.subscriptions.find(
            sub => sub.plan !== 'FREE' && sub.status === 'ACTIVE'
        );

        if (activePaidSubscription) {
            throw Errors.conflict(
                'Cannot delete user with active paid subscription',
                {
                    reason: 'User must cancel their subscription first',
                    activePlan: activePaidSubscription.plan,
                }
            );
        }

        // Count records for reporting
        const counts = {
            apiKeys: targetUser.apiKeys.length,
            usageLogs: targetUser.usageLogs.length,
            subscriptions: targetUser.subscriptions.length,
        };

        // Log to audit BEFORE deletion (so we have user data)
        await logAuditEvent('USER_DELETED', session.user.id, {
            targetUserId: params.id,
            targetUserEmail: targetUser.email,
            targetUserName: targetUser.name,
            deletedRecords: counts,
        });

        // Delete user (cascade will handle related records)
        // Order matters for foreign key constraints
        await prisma.$transaction(async (tx) => {
            // Delete usage logs first
            await tx.usageLog.deleteMany({
                where: { userId: params.id },
            });

            // Delete API keys
            await tx.apiKey.deleteMany({
                where: { userId: params.id },
            });

            // Delete subscriptions
            await tx.subscription.deleteMany({
                where: { userId: params.id },
            });

            // Delete invoices
            await tx.invoice.deleteMany({
                where: { userId: params.id },
            });

            // Delete sessions
            await tx.session.deleteMany({
                where: { userId: params.id },
            });

            // Delete accounts (OAuth)
            await tx.account.deleteMany({
                where: { userId: params.id },
            });

            // Finally, delete user
            await tx.user.delete({
                where: { id: params.id },
            });
        });

        return NextResponse.json({
            success: true,
            message: 'User and all associated data deleted successfully',
            deletedUser: {
                id: params.id,
                email: targetUser.email,
                name: targetUser.name,
            },
            deletedRecords: {
                user: 1,
                ...counts,
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
