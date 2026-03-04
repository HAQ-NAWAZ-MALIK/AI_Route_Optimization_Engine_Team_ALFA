/**
 * Email Verification API
 * GET /api/auth/verify-email?token=xxx
 * 
 * Verify user's email address with token
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { verifyEmailVerificationToken, markEmailAsVerified } from '@/lib/auth/tokens';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            throw Errors.badRequest('Verification token is required');
        }

        // Verify token
        const userId = await verifyEmailVerificationToken(token);
        if (!userId) {
            // Redirect to error page
            return NextResponse.redirect(
                new URL('/login?error=invalid-verification-token', request.url)
            );
        }

        // Mark email as verified
        await markEmailAsVerified(userId, token);

        // Redirect to login with success message
        return NextResponse.redirect(
            new URL('/login?verified=true', request.url)
        );

    } catch (error) {
        return NextResponse.redirect(
            new URL('/login?error=verification-failed', new URL(request.url).origin)
        );
    }
}
