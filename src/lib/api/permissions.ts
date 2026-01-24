/**
 * API Authorization & Permission Checks
 * Helpers for verifying user permissions and ownership
 */

import { auth } from '@/lib/auth/config';
import { Errors } from './error-handler';
import type { Session } from 'next-auth';

/**
 * Get current session or throw unauthorized error
 */
export async function requireAuth(): Promise<Session> {
    const session = await auth();

    if (!session || !session.user) {
        throw Errors.unauthorized();
    }

    return session;
}

/**
 * Require admin role
 * @throws 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(): Promise<Session> {
    const session = await requireAuth();

    if (session.user.role !== 'ADMIN') {
        throw Errors.forbidden('Admin role required');
    }

    return session;
}

/**
 * Require ownership of resource or admin role
 * @param resourceUserId - The user ID who owns the resource
 * @throws 401 if not authenticated, 403 if not owner/admin
 */
export async function requireOwnership(resourceUserId: string): Promise<Session> {
    const session = await requireAuth();

    // Admins can access anything
    if (session.user.role === 'ADMIN') {
        return session;
    }

    // Regular users can only access their own resources
    if (session.user.id !== resourceUserId) {
        throw Errors.forbidden('You do not have access to this resource');
    }

    return session;
}

/**
 * Check if current user can modify target user
 * Prevents users from modifying themselves in certain scenarios
 * @param targetUserId - The user ID to be modified
 * @throws 409 if trying to modify self
 */
export async function preventSelfModification(targetUserId: string): Promise<Session> {
    const session = await requireAdmin();

    if (session.user.id === targetUserId) {
        throw Errors.conflict('Cannot modify your own account', {
            reason: 'Use the settings page to modify your own account'
        });
    }

    return session;
}

/**
 * Get user ID from session
 */
export async function getUserId(): Promise<string> {
    const session = await requireAuth();
    return session.user.id;
}

/**
 * Check if user is admin (without throwing)
 */
export async function isAdmin(): Promise<boolean> {
    const session = await auth();
    return session?.user?.role === 'ADMIN';
}
