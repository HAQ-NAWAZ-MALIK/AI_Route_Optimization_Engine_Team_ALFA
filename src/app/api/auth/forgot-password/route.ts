/**
 * Forgot Password API
 * POST /api/auth/forgot-password
 * 
 * Generate and send password reset token
 * Rate limited for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { generatePasswordResetToken } from '@/lib/auth/tokens';
import { z } from 'zod';

const RequestSchema = z.object({
    email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
    try {
        // Parse and validate
        const body = await request.json();
        const validation = RequestSchema.safeParse(body);

        if (!validation.success) {
            throw Errors.badRequest('Invalid request data', validation.error.errors);
        }

        const { email } = validation.data;

        // Generate token and send email
        // Note: This always returns success, even if email doesn't exist (security)
        await generatePasswordResetToken(email);

        // Always return success to prevent email enumeration
        return NextResponse.json({
            success: true,
            message: 'If an account exists with that email, a password reset link has been sent.',
        });

    } catch (error) {
        return handleApiError(error);
    }
}
