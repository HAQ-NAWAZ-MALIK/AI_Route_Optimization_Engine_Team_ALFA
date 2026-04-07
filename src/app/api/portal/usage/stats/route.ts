/**
 * Portal API: Usage Statistics
 * GET /api/portal/usage/stats
 * 
 * Get aggregated usage statistics for the current user.
 * Supports filtering by period and specific API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { z } from 'zod';

const QuerySchema = z.object({
    period: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
    apiKeyId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
    try {
        // Get authenticated session
        const session = await requireAuth();

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const query = QuerySchema.parse({
            period: searchParams.get('period') || undefined,
            apiKeyId: searchParams.get('apiKeyId') || undefined,
        });

        // Calculate date range
        const endDate = new Date();
        let startDate = new Date();

        switch (query.period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case 'all':
                startDate = new Date(0); // Beginning of time
                break;
        }

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
        const where = {
            userId: session.user.id,
            timestamp: {
                gte: startDate,
                lte: endDate,
            },
            ...(query.apiKeyId ? { apiKeyId: query.apiKeyId } : {}),
        };

        // Get aggregated statistics
        const [totalLogs, requestsByEndpoint, requestsByDay] = await Promise.all([
            // Total requests with success/fail counts
            prisma.usageLog.groupBy({
                by: ['statusCode'],
                where,
                _count: { id: true },
                _avg: { responseTime: true },
            }),

            // Requests by endpoint
            prisma.usageLog.groupBy({
                by: ['endpoint'],
                where,
                _count: { id: true },
            }),

            // Requests by day
            prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
                SELECT DATE(timestamp) as date, COUNT(*)::bigint as count
                FROM usage_logs
                WHERE user_id = ${session.user.id}
                  AND timestamp >= ${startDate}
                  AND timestamp <= ${endDate}
                  ${query.apiKeyId ? prisma.$queryRawUnsafe(`AND api_key_id = '${query.apiKeyId}'`) : prisma.$queryRaw``}
                GROUP BY DATE(timestamp)
                ORDER BY date ASC
            `,
        ]);

        // Process statistics
        const totalRequests = totalLogs.reduce((sum, log) => sum + log._count.id, 0);
        const successfulRequests = totalLogs
            .filter(log => log.statusCode >= 200 && log.statusCode < 300)
            .reduce((sum, log) => sum + log._count.id, 0);
        const failedRequests = totalRequests - successfulRequests;
        const averageResponseTime = totalLogs.reduce((sum, log) => sum + (log._avg.responseTime || 0), 0) / totalLogs.length || 0;

        // Format requests by endpoint
        const endpointStats = requestsByEndpoint.reduce((acc, item) => {
            acc[item.endpoint] = item._count.id;
            return acc;
        }, {} as Record<string, number>);

        // Format requests by day
        const dailyStats = requestsByDay.map(row => ({
            date: row.date.toISOString().split('T')[0],
            count: Number(row.count),
        }));

        return NextResponse.json({
            success: true,
            stats: {
                totalRequests,
                successfulRequests,
                failedRequests,
                totalCost: 0, // TODO: Calculate from pricing
                averageResponseTime: Math.round(averageResponseTime),
                requestsByEndpoint: endpointStats,
                requestsByDay: dailyStats,
            },
            period: query.period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });

    } catch (error) {
        return handleApiError(error);
    }
}
