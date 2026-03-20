/**
 * Metrics API Endpoint
 * 
 * GET /api/v1/metrics
 * Exposes Prometheus-format metrics for scraping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/monitoring/metrics';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const output = metrics.export();

    return new NextResponse(output, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
    });
}
