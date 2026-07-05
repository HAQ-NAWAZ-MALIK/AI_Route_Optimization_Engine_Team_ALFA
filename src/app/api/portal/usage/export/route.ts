/**
 * Portal API: Export Usage Data
 * GET /api/portal/usage/export
 * 
 * Export usage data in CSV or JSON format.
 * Rate limited to prevent abuse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAuth } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';
import { getUserSubscription } from '@/lib/billing/subscription-service';
import { calculateRequestCost } from '@/lib/billing/usage-calculator';
import { z } from 'zod';

const QuerySchema = z.object({
    format: z.enum(['csv', 'json']).optional().default('csv'),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    apiKeyId: z.string().uuid().optional(),
}).refine(data => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 90;
}, {
    message: 'Export date range cannot exceed 90 days',
    path: ['endDate'],
}).refine(data => {
    return new Date(data.startDate) < new Date(data.endDate);
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
            format: searchParams.get('format') as any || undefined,
            startDate: searchParams.get('startDate')!,
            endDate: searchParams.get('endDate')!,
            apiKeyId: searchParams.get('apiKeyId') || undefined,
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

        // Get usage logs
        const [subscription, logs] = await Promise.all([
            getUserSubscription(session.user.id),
            prisma.usageLog.findMany({
                where: {
                    userId: session.user.id,
                    timestamp: {
                        gte: new Date(query.startDate),
                        lte: new Date(query.endDate),
                    },
                    ...(query.apiKeyId ? { apiKeyId: query.apiKeyId } : {}),
                },
                include: {
                    apiKey: {
                        select: {
                            name: true,
                            prefix: true,
                        },
                    },
                },
                orderBy: { timestamp: 'asc' },
            }),
        ]);
        const plan = subscription.plan as 'FREE' | 'PRO' | 'ENTERPRISE';

        // Log export for audit
        await logAuditEvent('USAGE_DATA_EXPORTED', session.user.id, {
            format: query.format,
            recordCount: logs.length,
            startDate: query.startDate,
            endDate: query.endDate,
        });

        // Format data based on requested format
        if (query.format === 'json') {
            const data = logs.map(log => ({
                timestamp: log.timestamp.toISOString(),
                endpoint: log.endpoint,
                method: log.method,
                statusCode: log.statusCode,
                responseTime: log.responseTime,
                apiKeyName: log.apiKey.name,
                cost: calculateRequestCost(log.endpoint, plan),
            }));

            return NextResponse.json(
                {
                    success: true,
                    data,
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        recordCount: logs.length,
                        startDate: query.startDate,
                        endDate: query.endDate,
                    },
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.json"`,
                    },
                }
            );
        }

        // CSV format
        const csvHeaders = 'Timestamp,Endpoint,Method,Status,ResponseTime,Cost,APIKey\n';
        const csvRows = logs.map(log =>
            `${log.timestamp.toISOString()},${log.endpoint},${log.method},${log.statusCode},${log.responseTime},${(calculateRequestCost(log.endpoint, plan) / 100).toFixed(2)},${log.apiKey.name}`
        ).join('\n');

        const csv = csvHeaders + csvRows;

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
