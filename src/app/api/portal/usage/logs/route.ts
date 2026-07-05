/**
 * Portal API: Detailed Usage Logs
 * GET /api/portal/usage/logs
 * 
 * Get paginated detailed usage logs with filtering options.
 * Supports filtering by date range, status, endpoint, and API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { getUserSubscription } from '@/lib/billing/subscription-service';
import { calculateRequestCost } from '@/lib/billing/usage-calculator';
import { z } from 'zod';

const QuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().max(100)).optional().default(50),
    apiKeyId: z.string().uuid().optional(),
    status: z.enum(['success', 'error', 'all']).optional().default('all'),
    endpoint: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
}, {
    message: 'Start date must be before end date',
    path: ['startDate'],
});

export async function GET(request: NextRequest) {
    try {
        // Get authenticated session
        const session = await requireAuth();

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const query = QuerySchema.parse({
            page: searchParams.get('page') || undefined,
            limit: searchParams.get('limit') || undefined,
            apiKeyId: searchParams.get('apiKeyId') || undefined,
            status: searchParams.get('status') as any || undefined,
            endpoint: searchParams.get('endpoint') || undefined,
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
        });

        // If apiKeyId provided, verify ownership
        if (query.apiKeyId) {
            const apiKey = await prisma.apiKey.findUnique({
                where: { id: query.apiKeyId },
                select: { userId: true },
            });

            if (!apiKey || (apiKey.userId !== session.user.id && session.user.role !== 'ADMIN')) {
                throw Errors.forbidden('API key does not belong to you');
            }
        }

        // Build where clause
        const where: any = {
            userId: session.user.id,
        };

        if (query.apiKeyId) {
            where.apiKeyId = query.apiKeyId;
        }

        if (query.status !== 'all') {
            where.statusCode = query.status === 'success'
                ? { gte: 200, lt: 300 }
                : { gte: 400 };
        }

        if (query.endpoint) {
            where.endpoint = query.endpoint;
        }

        if (query.startDate || query.endDate) {
            where.timestamp = {};
            if (query.startDate) {
                where.timestamp.gte = new Date(query.startDate);
            }
            if (query.endDate) {
                where.timestamp.lte = new Date(query.endDate);
            }
        }

        // Calculate pagination
        const page = parseInt(String(query.page));
        const limit = parseInt(String(query.limit));
        const skip = (page - 1) * limit;

        // Get total count and logs
        const [subscription, total, logs] = await Promise.all([
            getUserSubscription(session.user.id),
            prisma.usageLog.count({ where }),
            prisma.usageLog.findMany({
                where,
                include: {
                    apiKey: {
                        select: {
                            name: true,
                            prefix: true,
                        },
                    },
                },
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
            }),
        ]);
        const plan = subscription.plan as 'FREE' | 'PRO' | 'ENTERPRISE';

        // Format logs
        const formattedLogs = logs.map(log => ({
            id: log.id,
            endpoint: log.endpoint,
            method: log.method,
            statusCode: log.statusCode,
            responseTime: log.responseTime,
            apiKeyName: log.apiKey.name,
            apiKeyPrefix: log.apiKey.prefix,
            timestamp: log.timestamp.toISOString(),
            cost: calculateRequestCost(log.endpoint, plan),
        }));

        return NextResponse.json({
            success: true,
            logs: formattedLogs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
