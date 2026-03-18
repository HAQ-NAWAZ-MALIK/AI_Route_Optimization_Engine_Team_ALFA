/**
 * Distance Matrix API Endpoint
 * 
 * POST /api/v1/matrix/distance
 * Calculates distance and duration matrices for a set of coordinates.
 * 
 * Authentication: Required (X-API-Key header)
 * Rate Limiting: Based on API key tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildDistanceMatrixFromCoordinates, haversineDistance } from '@/lib/ai-engine';
import { validateDistanceMatrixRequest } from '@/lib/api/validation';
import { processApiRequest } from '@/lib/api/api-middleware';
import type {
    DistanceMatrixRequest,
    DistanceMatrixResponse,
    ErrorResponse,
} from '@/lib/api/api-schemas';

export async function POST(request: NextRequest): Promise<NextResponse<DistanceMatrixResponse | ErrorResponse>> {
    // Process authentication and rate limiting
    const middleware = await processApiRequest(request);
    if (!middleware.success) {
        return middleware.response!;
    }

    const { context } = middleware;
    const requestId = context!.requestId;
    const startTime = Date.now();

    try {
        // Parse request body
        let input: unknown;
        try {
            input = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON', message: 'Request body must be valid JSON', requestId },
                { status: 400 }
            );
        }

        // Validate input
        const validation = validateDistanceMatrixRequest(input);
        if (!validation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Validation failed',
                    message: validation.errors.join('; '),
                    requestId
                },
                { status: 400 }
            );
        }

        const req = input as DistanceMatrixRequest;

        let distances: number[][];
        let durations: number[][];

        if (req.useRealRoads) {
            // Use OSRM for real road distances
            try {
                const matrix = await buildDistanceMatrixFromCoordinates(req.coordinates);
                distances = matrix;
                // Estimate durations from distances (assuming 40 km/h average speed)
                durations = matrix.map(row => row.map(dist => (dist / 40) * 60)); // Convert to minutes
            } catch (error) {
                // Fall back to Haversine if OSRM fails
                console.warn('OSRM matrix failed, falling back to Haversine:', error);
                distances = buildHaversineMatrix(req.coordinates);
                durations = distances.map(row => row.map(dist => (dist / 40) * 60));
            }
        } else {
            // Use Haversine (straight-line) distances
            distances = buildHaversineMatrix(req.coordinates);
            // Estimate durations from distances (assuming 40 km/h average speed)
            durations = distances.map(row => row.map(dist => (dist / 40) * 60));
        }

        const processingTimeMs = Date.now() - startTime;

        const response: DistanceMatrixResponse = {
            success: true,
            requestId,
            processingTimeMs,
            result: {
                distances: distances.map(row => row.map(d => Math.round(d * 100) / 100)),
                durations: durations.map(row => row.map(d => Math.round(d * 100) / 100)),
            },
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Distance matrix error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Matrix calculation failed',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                requestId
            },
            { status: 500 }
        );
    }
}

/**
 * Build a distance matrix using Haversine formula
 */
function buildHaversineMatrix(coordinates: Array<{ lat: number; lng: number }>): number[][] {
    const n = coordinates.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
        matrix[i] = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                matrix[i][j] = 0;
            } else {
                matrix[i][j] = haversineDistance(
                    coordinates[i].lat,
                    coordinates[i].lng,
                    coordinates[j].lat,
                    coordinates[j].lng
                );
            }
        }
    }

    return matrix;
}
