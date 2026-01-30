/**
 * Helper to get authenticated API key and user from middleware
 */

import { NextRequest } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
    apiKey?: {
        id: string;
        name: string;
        userId: string;
        permissions: string[];
        rateLimit: number;
    };
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

/**
 * Get API key from authenticated request
 */
export function getApiKey(request: NextRequest) {
    return (request as any).apiKey;
}

/**
 * Get user from authenticated request
 */
export function getUser(request: NextRequest) {
    return (request as any).user;
}
