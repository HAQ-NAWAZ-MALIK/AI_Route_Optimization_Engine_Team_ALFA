/**
 * Reset Password API
 * POST /api/auth/reset-password
 * 
 * Reset user password with valid token
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { verifyPasswordResetToken, consumePasswordResetToken } from '@/lib/auth/tokens';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: NextRequest) {
    try {
        // Parse and validate
        const body = await request.json();
        const validation = RequestSchema.safeParse(body);

        if (!validation.success) {
            throw Errors.badRequest('Invalid request data', validation.error.errors);
        }

        const { token, newPassword } = validation.data;

        // Verify token
        const userId = await verifyPasswordResetToken(token);
        if (!userId) {
            throw Errors.badRequest('Invalid or expired reset token');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password and consume token in transaction
        await prisma.$transaction(async (tx) => {
            // Update password
            await tx.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });

            // Delete all sessions for this user (force re-login)
            await tx.session.deleteMany({
                where: { userId },
            });
        });

        // Consume token (delete it)
        await consumePasswordResetToken(token);

        return NextResponse.json({
            success: true,
            message: 'Password has been reset successfully. Please log in with your new password.',
        });

    } catch (error) {
        return handleApiError(error);
    }
}
