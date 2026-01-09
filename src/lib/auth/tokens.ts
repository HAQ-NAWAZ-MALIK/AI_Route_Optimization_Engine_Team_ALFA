/**
 * Password Reset Token Management
 * Secure token generation and validation for password reset flow
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { emailService } from '@/lib/email/email-service';

const TOKEN_EXPIRY_HOURS = 1;
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

/**
 * Generate a secure password reset token
 * @param email - User's email address
 * @returns Token string
 */
export async function generatePasswordResetToken(email: string): Promise<string> {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');

    //  Calculate expiry (1 hour from now)
    const expires = new Date();
    expires.setHours(expires.getHours() + TOKEN_EXPIRY_HOURS);

    // Find user
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
    });

    if (!user) {
        // Don't reveal if email exists - return success anyway
        return '';
    }

    // Delete any existing password reset tokens for this user
    await prisma.verificationToken.deleteMany({
        where: {
            identifier: `password-reset:${user.id}`,
        },
    });

    // Create new token
    await prisma.verificationToken.create({
        data: {
            identifier: `password-reset:${user.id}`,
            token,
            expires,
        },
    });

    // Send reset email
    const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
    await emailService.sendPasswordReset(email, resetUrl, user.name || undefined);

    return token;
}

/**
 * Verify password reset token
 * @param token - Token to verify
 * @returns User ID if valid, null otherwise
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
    const record = await prisma.verificationToken.findUnique({
        where: { token },
    });

    if (!record) {
        return null;
    }

    // Check if it's a password reset token
    if (!record.identifier.startsWith('password-reset:')) {
        return null;
    }

    // Check if expired
    if (record.expires < new Date()) {
        // Delete expired token
        await prisma.verificationToken.delete({
            where: { token },
        });
        return null;
    }

    // Extract user ID from identifier
    const userId = record.identifier.replace('password-reset:', '');
    return userId;
}

/**
 * Consume password reset token (delete after use)
 * @param token - Token to consume
 */
export async function consumePasswordResetToken(token: string): Promise<void> {
    await prisma.verificationToken.delete({
        where: { token },
    });
}

/**
 * Generate email verification token
 * @param userId - User ID
 * @param email - User's email
 * @returns Token string
 */
export async function generateEmailVerificationToken(userId: string, email: string): Promise<string> {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiry (24 hours from now)
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    // Delete any existing verification tokens for this user
    await prisma.verificationToken.deleteMany({
        where: {
            identifier: `email-verification:${userId}`,
        },
    });

    // Create new token
    await prisma.verificationToken.create({
        data: {
            identifier: `email-verification:${userId}`,
            token,
            expires,
        },
    });

    // Send verification email
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;
    await emailService.sendEmailVerification(email, verificationUrl, user?.name || undefined);

    return token;
}

/**
 * Verify email verification token
 * @param token - Token to verify
 * @returns User ID if valid, null otherwise
 */
export async function verifyEmailVerificationToken(token: string): Promise<string | null> {
    const record = await prisma.verificationToken.findUnique({
        where: { token },
    });

    if (!record) {
        return null;
    }

    // Check if it's an email verification token
    if (!record.identifier.startsWith('email-verification:')) {
        return null;
    }

    // Check if expired
    if (record.expires < new Date()) {
        await prisma.verificationToken.delete({
            where: { token },
        });
        return null;
    }

    // Extract user ID
    const userId = record.identifier.replace('email-verification:', '');
    return userId;
}

/**
 * Mark email as verified and consume token
 */
export async function markEmailAsVerified(userId: string, token: string): Promise<void> {
    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { emailVerified: new Date() },
        }),
        prisma.verificationToken.delete({
            where: { token },
        }),
    ]);
}
