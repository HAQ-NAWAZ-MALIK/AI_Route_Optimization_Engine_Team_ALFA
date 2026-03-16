/**
 * Test API Route - Route Optimization
 * Protected endpoint using withApiKey wrapper
 * Route: POST /api/v1/optimize/route
 */

import { NextResponse } from 'next/server';
import { withApiKey, AuthenticatedRequest } from '@/middleware/api-key';

async function handler(request: AuthenticatedRequest) {
    try {
        const body = await request.json();
        const { locations, vehicleCount } = body;

        // Validate input
        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return NextResponse.json(
                { error: 'Invalid input', message: 'locations array is required' },
                { status: 400 }
            );
        }

        if (!vehicleCount || vehicleCount < 1) {
            return NextResponse.json(
                { error: 'Invalid input', message: 'vehicleCount must be at least 1' },
                { status: 400 }
            );
        }

        // DEMO: Return mock response
        const mockResponse = {
            success: true,
            requestId: `req_${Date.now()}`,
            optimization: {
                routes: Array.from({ length: vehicleCount }, (_, i) => ({
                    vehicleId: i + 1,
                    locations: locations.slice(i * 2, Math.min(i * 2 + 3, locations.length)),
                    totalDistance: Math.round(Math.random() * 100 * 100) / 100,
                    totalDuration: Math.round(Math.random() * 3600),
                })),
                totalDistance: Math.round(Math.random() * 500 * 100) / 100,
                totalDuration: Math.round(Math.random() * 7200),
                algorithm: 'genetic',
            },
            metadata: {
                apiKeyId: request.apiKeyData?.id,
                apiKeyName: request.apiKeyData?.name,
                userId: request.userData?.id,
                userEmail: request.userData?.email,
                locationsCount: locations.length,
                vehicleCount,
                processingTime: Math.round(Math.random() * 1000),
            },
        };

        return NextResponse.json(mockResponse, { status: 200 });
    } catch (error) {
        console.error('Route optimization error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: 'Failed to process route optimization' },
            { status: 500 }
        );
    }
}

// Export wrapped handler
export const POST = withApiKey(handler);
