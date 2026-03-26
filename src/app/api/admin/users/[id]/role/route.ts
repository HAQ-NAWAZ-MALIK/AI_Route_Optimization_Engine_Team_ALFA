/**
 * Admin API: Change User Role
 * POST /api/admin/users/[id]/role
 * 
 * Allows admins to promote users to admin or demote admins to users.
 * Prevents self-modification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { preventSelfModification } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';

const ChangeRoleSchema = z.object({
    role: z.enum(['USER', 'ADMIN'], {
        errorMap: () => ({ message: 'Role must be either USER or ADMIN' })
    })
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Prevent self-modification and ensure admin session
        const session = await preventSelfModification(params.id);

        // Parse and validate request
        const body = await request.json();
        const validation = ChangeRoleSchema.safeParse(body);

        if (!validation.success) {
            throw Errors.badRequest('Invalid request data', validation.error.errors);
        }

        const { role } = validation.data;

        // Find target user
        const targetUser = await prisma.user.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        });

        if (!targetUser) {
            throw Errors.notFound('User');
        }

        // Check if role is actually changing
        if (targetUser.role === role) {
            return NextResponse.json({
                success: true,
                message: 'User already has this role',
                user: targetUser,
            });
        }

        // Update user role
        const updatedUser = await prisma.user.update({
            where: { id: params.id },
            data: { role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                updatedAt: true,
            },
        });

        // Log to audit
        await logAuditEvent('USER_ROLE_CHANGED', session.user.id, {
            targetUserId: params.id,
            targetUserEmail: targetUser.email,
            oldRole: targetUser.role,
            newRole: role,
        });

        return NextResponse.json({
            success: true,
            user: updatedUser,
            message: `User role changed from ${targetUser.role} to ${role}`,
        });

    } catch (error) {
        return handleApiError(error);
    }
}
