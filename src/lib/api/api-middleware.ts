/**
 * API Middleware
 * 
 * Provides authentication, rate limiting, and request logging for API endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, recordKeyUsage, getKeyLimits, getEffectiveLimitsForTier, type ApiKeyInfo } from './api-keys';
import { getRateLimiter, type RateLimitResult } from './rate-limiter';
import { getMaintenanceStatus } from '../config/platform-config';
import { getUserSubscription } from '../billing/subscription-service';
import { isWithinPlanLimits } from '../billing/plans';
import type { ErrorResponse } from './api-schemas';
import { prisma } from '../db/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiContext {
    keyInfo: ApiKeyInfo;
    rateLimit: RateLimitResult;
    requestId: string;
    dbApiKeyId?: string;
    dbUserId?: string;
}

export interface MiddlewareResult {
    success: boolean;
    context?: ApiContext;
    response?: NextResponse<ErrorResponse>;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Process API request through authentication and rate limiting
 */
export async function processApiRequest(request: NextRequest): Promise<MiddlewareResult> {
    const requestId = generateRequestId();

    // ── Maintenance Mode Check ──────────────────────────────────
    // Block ALL API requests when maintenance mode is enabled.
    // This runs before auth so that even valid keys get 503.
    try {
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return {
                success: false,
                response: NextResponse.json(
                    {
                        success: false,
                        error: 'Service Unavailable',
                        message: maintenance.message || 'The platform is currently under maintenance. Please try again later.',
                        requestId,
                    },
                    {
                        status: 503,
                        headers: {
                            'X-Request-Id': requestId,
                            'Retry-After': '300',
                        },
                    }
                ),
            };
        }
    } catch (err) {
        // If we can't read maintenance status, let the request through
        console.error('Failed to check maintenance status:', err);
    }

    // Extract API key from header
    const apiKey = request.headers.get('X-API-Key') ||
        request.headers.get('Authorization')?.replace('Bearer ', '') ||
        '';

    // Validate API key
    const keyInfo = await validateApiKey(apiKey);
    if (!keyInfo) {
        return {
            success: false,
            response: NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized',
                    message: 'Invalid or missing API key. Use header: X-API-Key: <your-key>',
                    requestId,
                },
                {
                    status: 401,
                    headers: {
                        'WWW-Authenticate': 'ApiKey',
                        'X-Request-Id': requestId,
                    },
                }
            ),
        };
    }

    // Fetch effective rate limits from DB config (with fallback to defaults)
    const effectiveLimits = await getEffectiveLimitsForTier(keyInfo.tier);

    let dbApiKeyId: string | undefined;
    let dbUserId: string | undefined;

    if (keyInfo.key.startsWith('ropt_')) {
        try {
            const dbKey = await prisma.apiKey.findFirst({
                where: {
                    prefix: keyInfo.key.substring(0, 12),
                    active: true,
                },
                select: { id: true, userId: true },
            });

            dbApiKeyId = dbKey?.id;
            dbUserId = dbKey?.userId;
        } catch (error) {
            console.error('Failed to resolve API key for usage tracking:', error);
        }
    }

    // Check rate limits
    const rateLimiter = getRateLimiter();
    const rateLimit = rateLimiter.check(keyInfo.key, effectiveLimits);

    if (!rateLimit.allowed) {
        return {
            success: false,
            response: NextResponse.json(
                {
                    success: false,
                    error: 'Rate limit exceeded',
                    message: `You have exceeded your rate limit. Retry after ${rateLimit.retryAfter} seconds.`,
                    requestId,
                },
                {
                    status: 429,
                    headers: {
                        'X-Request-Id': requestId,
                        'X-RateLimit-Limit': String(effectiveLimits.requestsPerDay),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Math.floor(rateLimit.resetAt / 1000)),
                        'Retry-After': String(rateLimit.retryAfter || 60),
                    },
                }
            ),
        };
    }

    // Record usage
    recordKeyUsage(keyInfo.key);

    // ── Subscription Plan Enforcement ───────────────────────────
    // Check user's subscription limits (monthly requests)
    try {
        if (keyInfo.key.startsWith('ropt_')) {
            const dbKey = await prisma.apiKey.findFirst({
                where: { prefix: keyInfo.key.substring(0, 12), active: true },
                select: { userId: true },
            });

            if (dbKey) {
                const sub = await getUserSubscription(dbKey.userId);
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const monthlyUsage = await prisma.usageLog.count({
                    where: {
                        userId: dbKey.userId,
                        timestamp: { gte: startOfMonth },
                        statusCode: { gte: 200, lt: 300 },
                    },
                });

                const planCheck = await isWithinPlanLimits(
                    sub.plan as any,
                    monthlyUsage,
                    0, // locations checked at route level
                    0, // cabs checked at route level
                );

                if (!planCheck.allowed) {
                    return {
                        success: false,
                        response: NextResponse.json(
                            {
                                success: false,
                                error: 'Plan limit exceeded',
                                message: planCheck.reason || 'You have exceeded your subscription plan limits.',
                                upgrade: {
                                    currentPlan: sub.plan,
                                    url: '/billing',
                                },
                                requestId,
                            },
                            {
                                status: 402,
                                headers: {
                                    'X-Request-Id': requestId,
                                    'X-Plan': sub.plan,
                                    'X-Plan-Limit-Exceeded': 'true',
                                },
                            }
                        ),
                    };
                }
            }
        }
    } catch (planError) {
        // Plan check failure shouldn't break the request
        console.error('Subscription plan check error:', planError);
    }


    return {
        success: true,
        context: {
            keyInfo,
            rateLimit,
            requestId,
            dbApiKeyId,
            dbUserId,
        },
    };
}

/**
 * Record the completed API request after the route has produced a response.
 */
export async function recordApiUsage(
    request: NextRequest,
    context: ApiContext,
    response: NextResponse,
    startTime: number,
    errorMessage?: string
): Promise<void> {
    if (!context.dbApiKeyId || !context.dbUserId) return;

    try {
        await prisma.usageLog.create({
            data: {
                apiKeyId: context.dbApiKeyId,
                userId: context.dbUserId,
                endpoint: new URL(request.url).pathname,
                method: request.method,
                statusCode: response.status,
                responseTime: Date.now() - startTime,
                errorMessage: errorMessage || null,
                timestamp: new Date(),
            },
        });
    } catch (error) {
        console.error('Usage logging error:', error);
    }
}

/**
 * Add rate limit headers to a response
 */
export async function addRateLimitHeaders<T>(
    response: NextResponse<T>,
    context: ApiContext
): Promise<NextResponse<T>> {
    const limits = await getKeyLimits(context.keyInfo.key);

    response.headers.set('X-Request-Id', context.requestId);
    response.headers.set('X-RateLimit-Limit', String(limits?.requestsPerDay || 0));
    response.headers.set('X-RateLimit-Remaining', String(context.rateLimit.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.floor(context.rateLimit.resetAt / 1000)));

    return response;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
    error: string,
    message: string,
    status: number,
    requestId: string
): NextResponse<ErrorResponse> {
    return NextResponse.json(
        {
            success: false,
            error,
            message,
            requestId,
        },
        {
            status,
            headers: { 'X-Request-Id': requestId },
        }
    );
}

// ============================================================================
// CORS HEADERS
// ============================================================================

export const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Access-Control-Max-Age': '86400',
};

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflght(): NextResponse {
    return new NextResponse(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

// ============================================================================
// HELPERS
// ============================================================================

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
