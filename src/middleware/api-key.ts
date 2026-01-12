/**
 * Route Handler Wrapper for API Key Validation
 * Use this wrapper for protected API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyApiKey } from '@/lib/api-keys/generator';
import { hasPermission, getRequiredPermission, Permission } from '@/lib/api-keys/permissions';
import { rateLimiter } from '@/lib/rate-limiter';

export interface AuthenticatedRequest extends NextRequest {
    apiKeyData?: {
        id: string;
        name: string;
        userId: string;
        permissions: string[];
        rateLimit: number;
    };
    userData?: {
        id: string;
        email: string;
        role: string;
    };
}

/**
 * Extract API key from request headers
 */
function extractApiKey(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    const apiKeyHeader = request.headers.get('x-api-key');
    if (apiKeyHeader) {
        return apiKeyHeader;
    }

    return null;
}

/**
 * Wrapper function to protect API routes
 */
export function withApiKey(
    handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
    return async (request: NextRequest) => {
        const startTime = Date.now();
        const endpoint = new URL(request.url).pathname;
        const method = request.method;

        try {
            // Extract API key
            const apiKey = extractApiKey(request);
            if (!apiKey) {
                return NextResponse.json(
                    {
                        error: 'Missing API key',
                        message: 'Please provide an API key via Authorization header (Bearer token) or x-api-key header',
                    },
                    { status: 401 }
                );
            }

            // Extract prefix
            const prefix = apiKey.substring(0, 13);

            // Find API key
            const apiKeyRecord = await prisma.apiKey.findFirst({
                where: { prefix },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });

            if (!apiKeyRecord) {
                await logUsage(null, null, endpoint, method, 401, Date.now() - startTime, 'Invalid API key');
                return NextResponse.json(
                    { error: 'Invalid API key' },
                    { status: 401 }
                );
            }

            // Verify hash
            const isValid = await verifyApiKey(apiKey, apiKeyRecord.keyHash);
            if (!isValid) {
                await logUsage(apiKeyRecord.id, apiKeyRecord.userId, endpoint, method, 401, Date.now() - startTime, 'Invalid key hash');
                return NextResponse.json(
                    { error: 'Invalid API key' },
                    { status: 401 }
                );
            }

            // Check expiration
            if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
                await logUsage(apiKeyRecord.id, apiKeyRecord.userId, endpoint, method, 401, Date.now() - startTime, 'Key expired');
                return NextResponse.json(
                    { error: 'API key expired' },
                    { status: 401 }
                );
            }

            // Check permissions
            const requiredPermission = getRequiredPermission(endpoint);
            if (requiredPermission && !hasPermission(apiKeyRecord.permissions, requiredPermission)) {
                await logUsage(apiKeyRecord.id, apiKeyRecord.userId, endpoint, method, 403, Date.now() - startTime, 'Insufficient permissions');
                return NextResponse.json(
                    { error: 'Insufficient permissions', required: requiredPermission },
                    { status: 403 }
                );
            }

            // Rate limiting
            const rateLimitKey = `api:${apiKeyRecord.id}`;
            const rateLimit = await rateLimiter.checkLimit(
                rateLimitKey,
                apiKeyRecord.rateLimit,
                15 * 60 * 1000
            );

            if (!rateLimit.allowed) {
                const resetAtSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
                await logUsage(apiKeyRecord.id, apiKeyRecord.userId, endpoint, method, 429, Date.now() - startTime, 'Rate limit exceeded');

                return NextResponse.json(
                    {
                        error: 'Rate limit exceeded',
                        retryAfter: resetAtSeconds,
                    },
                    {
                        status: 429,
                        headers: {
                            'X-RateLimit-Limit': apiKeyRecord.rateLimit.toString(),
                            'X-RateLimit-Remaining': '0',
                            'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString(),
                            'Retry-After': resetAtSeconds.toString(),
                        },
                    }
                );
            }

            // Update last used
            await prisma.apiKey.update({
                where: { id: apiKeyRecord.id },
                data: { lastUsedAt: new Date() },
            });

            // Enrich request
            const authenticatedRequest = request as AuthenticatedRequest;
            authenticatedRequest.apiKeyData = {
                id: apiKeyRecord.id,
                name: apiKeyRecord.name,
                userId: apiKeyRecord.userId,
                permissions: apiKeyRecord.permissions,
                rateLimit: apiKeyRecord.rateLimit,
            };
            authenticatedRequest.userData = apiKeyRecord.user;

            // Call handler
            const response = await handler(authenticatedRequest);

            // Add rate limit headers
            response.headers.set('X-RateLimit-Limit', apiKeyRecord.rateLimit.toString());
            response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
            response.headers.set('X-RateLimit-Reset', Math.floor(rateLimit.resetAt / 1000).toString());

            // Log usage
            await logUsage(
                apiKeyRecord.id,
                apiKeyRecord.userId,
                endpoint,
                method,
                response.status,
                Date.now() - startTime
            );

            return response;
        } catch (error) {
            console.error('API validation error:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    };
}

async function logUsage(
    apiKeyId: string | null,
    userId: string | null,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    errorMessage?: string
) {
    try {
        if (!apiKeyId || !userId) return;

        await prisma.usageLog.create({
            data: {
                apiKeyId,
                userId,
                endpoint,
                method,
                statusCode,
                responseTime,
                errorMessage: errorMessage || null,
                timestamp: new Date(),
            },
        });
    } catch (error) {
        console.error('Failed to log usage:', error);
    }
}
