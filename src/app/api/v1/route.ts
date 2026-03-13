/**
 * API Status Endpoint
 * Public endpoint to check API status (no authentication required)
 */

import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'operational',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            optimize: '/api/v1/optimize/route',
            // Add more endpoints as needed
        },
        documentation: '/docs',
    });
}
