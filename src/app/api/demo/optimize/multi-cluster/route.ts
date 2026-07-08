/**
 * Multi-Cluster Optimization API Endpoint
 * 
 * POST /api/demo/optimize/multi-cluster
 * Optimizes routes for multiple cabs with employee clustering.
 * 
 * Demo-only endpoint: uses the same optimizer as the public API, but skips
 * external API-key authentication because it is called by the bundled Next app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { optimizeMultiCluster, ClusterResult } from '@/lib/multi-cluster-optimizer';
import { optimizeRoute } from '@/lib/ai-engine';
import { validateMultiClusterRequest } from '@/lib/api/validation';
import type { Employee, Cab, Config } from '@/lib/csv-parser';
import type {
    MultiClusterRequest,
    MultiClusterResponse,
    ErrorResponse,
    ClusterAssignment,
    OptimizedRouteResponse,
} from '@/lib/api/api-schemas';

export async function POST(request: NextRequest): Promise<NextResponse<MultiClusterResponse | ErrorResponse>> {
    const requestId = `demo_req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();

    try {
        // Parse request body
        let input: unknown;
        try {
            input = await request.json();
        } catch {
            const apiResponse = NextResponse.json<ErrorResponse>(
                { success: false, error: 'Invalid JSON', message: 'Request body must be valid JSON', requestId },
                { status: 400 }
            );
            return apiResponse;
        }

        // Validate input
        const validation = validateMultiClusterRequest(input);
        if (!validation.valid) {
            const apiResponse = NextResponse.json<ErrorResponse>(
                {
                    success: false,
                    error: 'Validation failed',
                    message: validation.errors.join('; '),
                    requestId
                },
                { status: 400 }
            );
            return apiResponse;
        }

        const req = input as MultiClusterRequest;

        // Convert API types to internal types
        const employees: Employee[] = req.employees.map(emp => ({
            id: emp.id,
            name: emp.name || '',
            address: emp.address || '',
            lat: emp.lat,
            lng: emp.lng,
        }));

        const cabs: Cab[] = req.cabs.map(cab => ({
            id: cab.id,
            name: cab.name || `Cab ${cab.id}`,
            seats: cab.capacity || (cab as any).seats || 4,
            driver: '',
            lat: cab.currentLocation?.lat || req.office.lat,
            lng: cab.currentLocation?.lng || req.office.lng,
        }));

        const config: Config = {
            officeName: req.office.name || 'Office',
            officeAddress: req.office.address || '',
            officeLat: req.office.lat,
            officeLng: req.office.lng,
            departureTime: '08:00',
            tripType: 'pickup',
        };

        // Call the multi-cluster optimizer (just clustering and assignment)
        const clusterResult: ClusterResult = optimizeMultiCluster(employees, cabs, config);

        // Now optimize routes for each cab assignment
        const clusters: ClusterAssignment[] = [];

        for (const assignment of clusterResult.assignments) {
            let optimizedRoute: OptimizedRouteResponse;

            if (assignment.cluster.employees.length > 0) {
                // Run route optimization for this cluster
                try {
                    const routeResult = await optimizeRoute({
                        origin: {
                            id: 'office',
                            lat: config.officeLat,
                            lng: config.officeLng,
                            name: config.officeName,
                            address: config.officeAddress,
                        },
                        destinations: assignment.cluster.employees.map(emp => ({
                            id: emp.id,
                            lat: emp.lat,
                            lng: emp.lng,
                            name: emp.name,
                            address: emp.address,
                        })),
                        tripType: 'pickup',
                        constraints: {
                            departureTime: config.departureTime,
                        },
                        options: {
                            useOSRM: true,
                        },
                    });

                    optimizedRoute = {
                        id: routeResult.primaryRoute.id,
                        stops: routeResult.primaryRoute.stops.map((stop, i) => ({
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
                        })),
                        totalDistance: routeResult.primaryRoute.totalDistance,
                        totalDuration: routeResult.primaryRoute.totalDuration,
                        estimatedArrival: routeResult.primaryRoute.estimatedArrival,
                        geometry: routeResult.primaryRoute.geometry,
                        optimizationMethod: routeResult.primaryRoute.optimizationMethod,
                    };
                } catch (routeError) {
                    // If route optimization fails, create a basic route
                    console.warn(`Route optimization failed for cab ${assignment.cab.id}:`, routeError);
                    optimizedRoute = {
                        id: `route_${assignment.cab.id}`,
                        stops: assignment.cluster.employees.map((emp, i) => ({
                            sequence: i + 1,
                            location: {
                                id: emp.id,
                                lat: emp.lat,
                                lng: emp.lng,
                                name: emp.name,
                                address: emp.address,
                            },
                            arrivalTime: '',
                            departureTime: '',
                            distanceFromPrevious: 0,
                            durationFromPrevious: 0,
                            cumulativeDistance: 0,
                            cumulativeDuration: 0,
                        })),
                        totalDistance: 0,
                        totalDuration: 0,
                        estimatedArrival: '',
                        optimizationMethod: 'failed',
                    };
                }
            } else {
                // Empty cluster
                optimizedRoute = {
                    id: `route_${assignment.cab.id}`,
                    stops: [],
                    totalDistance: 0,
                    totalDuration: 0,
                    estimatedArrival: '',
                    optimizationMethod: 'none',
                };
            }

            clusters.push({
                cabId: assignment.cab.id,
                cabName: assignment.cab.name,
                employees: assignment.cluster.employees.map(emp => ({
                    id: emp.id,
                    lat: emp.lat,
                    lng: emp.lng,
                    name: emp.name,
                    address: emp.address,
                })),
                route: optimizedRoute,
            });
        }

        const processingTimeMs = Date.now() - startTime;

        // Calculate metrics
        const totalDistance = clusters.reduce((sum, c) => sum + c.route.totalDistance, 0);
        const totalDuration = clusters.reduce((sum, c) => sum + c.route.totalDuration, 0);
        const totalCapacity = cabs.reduce((sum, c) => sum + c.seats, 0);
        const averageLoadFactor = totalCapacity > 0 ? employees.length / totalCapacity : 0;

        const response: MultiClusterResponse = {
            success: true,
            requestId,
            processingTimeMs,
            result: {
                clusters,
                totalCabs: clusters.length,
                totalEmployees: req.employees.length,
                metrics: {
                    averageLoadFactor: Math.round(averageLoadFactor * 100) / 100,
                    totalDistance: Math.round(totalDistance * 100) / 100,
                    totalDuration: Math.round(totalDuration * 100) / 100,
                },
            },
        };

        // Add warnings if there are unassigned employees
        if (clusterResult.unassignedEmployees.length > 0) {
            response.errors = [`${clusterResult.unassignedEmployees.length} employees could not be assigned due to capacity constraints`];
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Multi-cluster optimization error:', error);

        const apiResponse = NextResponse.json<ErrorResponse>(
            {
                success: false,
                error: 'Optimization failed',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                requestId
            },
            { status: 500 }
        );
        return apiResponse;
    }
}
