/**
 * Route Optimization API Endpoint
 * 
 * POST /api/v1/optimize/route
 * Optimizes a single route using the AI engine.
 * 
 * Authentication: Required (X-API-Key header)
 * Rate Limiting: Based on API key tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { optimizeRoute } from '@/lib/ai-engine';
import { validateOptimizeRouteRequest } from '@/lib/api/validation';
import { processApiRequest, addRateLimitHeaders } from '@/lib/api/api-middleware';
import type {
    OptimizeRouteRequest,
    OptimizeRouteResponse,
    ErrorResponse,
    RouteStopResponse,
    OptimizedRouteResponse,
    OptimizationMetricsResponse,
    AlternativeRouteResponse,
} from '@/lib/api/api-schemas';
import type { OptimizationMethod, RouteStop } from '@/lib/ai-engine';

export async function POST(request: NextRequest): Promise<NextResponse<OptimizeRouteResponse | ErrorResponse>> {
    //Process authentication and rate limiting
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
        const validation = validateOptimizeRouteRequest(input);
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

        const req = input as OptimizeRouteRequest;

        // Map algorithm name to OptimizationMethod (only valid internal types)
        const algorithmMap: Record<string, OptimizationMethod | undefined> = {
            'nearest_neighbor': 'nearest_neighbor',
            'christofides': 'christofides',
            'genetic': 'genetic_algorithm',
            'exhaustive': 'christofides', // Map to christofides for small sets
            'auto': undefined, // Let the optimizer auto-select
        };

        // Get the method, defaulting to undefined (auto-select)
        const method = req.options?.algorithm ? algorithmMap[req.options.algorithm] : undefined;

        // Call the optimization engine
        const result = await optimizeRoute({
            origin: {
                id: req.origin.id,
                lat: req.origin.lat,
                lng: req.origin.lng,
                name: req.origin.name || '',
                address: req.origin.address || '',
            },
            destinations: req.destinations.map(d => ({
                id: d.id,
                lat: d.lat,
                lng: d.lng,
                name: d.name || '',
                address: d.address || '',
                preferredPickupTime: d.preferredPickupTime,
                timeWindowStart: d.timeWindowStart,
                timeWindowEnd: d.timeWindowEnd,
            })),
            tripType: req.tripType || 'pickup',
            constraints: {
                departureTime: req.constraints.departureTime,
                maxTotalDuration: req.constraints.maxTotalDuration,
                bufferPerStop: req.constraints.bufferPerStop,
            },
            options: {
                method,
                useOSRM: req.options?.useRealRoads ?? true,
                useTraffic: req.options?.considerTraffic ?? false,
                generateAlternatives: req.options?.generateAlternatives ?? false,
                maxAlternatives: req.options?.maxAlternatives ?? 2,
            },
        });

        // Helper to transform stops
        const transformStops = (stops: RouteStop[]): RouteStopResponse[] =>
            stops.map((stop, i) => ({
                sequence: i + 1,
                location: {
                    id: stop.location.id,
                    lat: stop.location.lat,
                    lng: stop.location.lng,
                    name: stop.location.name,
                    address: stop.location.address,
                },
                arrivalTime: stop.arrivalTime,
                departureTime: stop.departureTime,
                distanceFromPrevious: stop.distanceFromPrevious,
                durationFromPrevious: stop.durationFromPrevious,
                cumulativeDistance: stop.cumulativeDistance,
                cumulativeDuration: stop.cumulativeDuration,
            }));

        // Transform to API response format
        const route: OptimizedRouteResponse = {
            id: result.primaryRoute.id,
            stops: transformStops(result.primaryRoute.stops),
            totalDistance: result.primaryRoute.totalDistance,
            totalDuration: result.primaryRoute.totalDuration,
            estimatedArrival: result.primaryRoute.estimatedArrival,
            geometry: result.primaryRoute.geometry,
            optimizationMethod: result.primaryRoute.optimizationMethod,
        };

        // Use internal metrics (note: 'methodUsed' vs 'algorithmUsed', 'efficiencyScore' is on route not metrics)
        const metrics: OptimizationMetricsResponse = {
            algorithmUsed: result.metrics.methodUsed,
            optimizationDuration: result.metrics.optimizationDuration,
            improvementOverNaive: result.metrics.improvementOverNaive,
            efficiencyScore: result.primaryRoute.efficiencyScore, // Get from route
        };

        // Transform alternative routes if available
        // Note: AlternativeRoute extends OptimizedRoute, so properties are directly on alt, not alt.route
        let alternatives: AlternativeRouteResponse[] | undefined;
        if (result.alternativeRoutes && result.alternativeRoutes.length > 0) {
            alternatives = result.alternativeRoutes.map(alt => ({
                route: {
                    id: alt.id,
                    stops: transformStops(alt.stops),
                    totalDistance: alt.totalDistance,
                    totalDuration: alt.totalDuration,
                    estimatedArrival: alt.estimatedArrival,
                    geometry: alt.geometry,
                    optimizationMethod: alt.optimizationMethod,
                },
                description: alt.description,
                comparisonToMain: alt.comparisonToMain,
            }));
        }

        const processingTimeMs = Date.now() - startTime;

        const response: OptimizeRouteResponse = {
            success: true,
            requestId,
            processingTimeMs,
            result: {
                route,
                metrics,
                alternatives,
            },
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Optimization error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Optimization failed',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                requestId
            },
            { status: 500 }
        );
    }
}
