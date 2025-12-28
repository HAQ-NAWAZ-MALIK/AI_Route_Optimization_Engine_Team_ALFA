/**
 * Next.js Middleware
 * CORS headers only - API key validation moved to route handlers
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    const response = NextResponse.next();

    // Add CORS headers to all API responses
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    return response;
}

// Apply middleware to API routes
export const config = {
    matcher: '/api/:path*',
};
