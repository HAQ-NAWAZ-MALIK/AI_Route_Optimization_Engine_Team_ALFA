/**
 * Tool Handlers - Execute MCP tools and return results
 * These handlers wrap the AI engine functions with proper error handling
 */

import { logger } from '../logger.js';
import { config } from '../config.js';
import { MCPError, ErrorCode } from '../errors.js';

// Import AI engine functions (these will be resolved via tsconfig paths)
// In production, these would import from the parent project's lib/
type OptimizationInput = {
    origin: { id: string; lat: number; lng: number; name: string; address: string };
    destinations: Array<{
        id: string;
        lat: number;
        lng: number;
        name: string;
        address: string;
        preferredPickupTime?: string;
        timeWindowStart?: string;
        timeWindowEnd?: string;
    }>;
    tripType: 'pickup' | 'drop';
    constraints: {
        departureTime: string;
        maxTotalDuration?: number;
        bufferPerStop?: number;
    };
    options?: {
        method?: 'nearest_neighbor' | 'christofides' | 'genetic_algorithm';
        useOSRM?: boolean;
        useTraffic?: boolean;
        generateAlternatives?: boolean;
        maxAlternatives?: number;
    };
};

type ToolArgs = Record<string, any>;

function requireObject(value: unknown, fieldName: string): ToolArgs {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new MCPError(ErrorCode.InvalidParams, `${fieldName} must be an object`);
    }

    return value as ToolArgs;
}

function requireArray(value: unknown, fieldName: string): any[] {
    if (!Array.isArray(value)) {
        throw new MCPError(ErrorCode.InvalidParams, `${fieldName} must be an array`);
    }

    return value;
}

function requireCoordinate(value: unknown, fieldName: string): ToolArgs {
    const coordinate = requireObject(value, fieldName);

    if (typeof coordinate.lat !== 'number' || typeof coordinate.lng !== 'number') {
        throw new MCPError(ErrorCode.InvalidParams, `${fieldName}.lat and ${fieldName}.lng must be numbers`);
    }

    return coordinate;
}

/**
 * Handle optimize_route tool call
 */
export async function handleOptimizeRoute(args: any, requestId: string): Promise<any> {
    const startTime = Date.now();

    try {
        const input = requireObject(args, 'arguments');
        const origin = requireCoordinate(input.origin, 'origin');
        const destinations = requireArray(input.destinations, 'destinations');
        const constraints = requireObject(input.constraints, 'constraints');
        const options = input.options === undefined ? {} : requireObject(input.options, 'options');

        if (destinations.length === 0) {
            throw new MCPError(ErrorCode.InvalidParams, 'destinations must contain at least one location');
        }

        if (typeof constraints.departureTime !== 'string') {
            throw new MCPError(ErrorCode.InvalidParams, 'constraints.departureTime must be a string');
        }

        if (input.tripType !== 'pickup' && input.tripType !== 'drop') {
            throw new MCPError(ErrorCode.InvalidParams, 'tripType must be either "pickup" or "drop"');
        }

        // Validate input limits
        if (destinations.length > config.optimization.maxLocations) {
            throw new MCPError(
                ErrorCode.InvalidParams,
                `Too many locations. Maximum allowed: ${config.optimization.maxLocations}`
            );
        }

        logger.toolCall('optimize_route', { locationCount: destinations.length }, requestId);

        // Check if auto mode is requested (default behavior)
        const isAutoMode = !options.algorithm || options.algorithm === 'auto';

        // Build common input structure
        const optimizationInput: OptimizationInput = {
            origin: {
                id: 'origin',
                lat: origin.lat,
                lng: origin.lng,
                name: origin.name || 'Origin',
                address: origin.address || '',
            },
            destinations: destinations.map((destination: any, i: number) => {
                const d = requireCoordinate(destination, `destinations[${i}]`);

                return {
                    id: d.id || `dest_${i}`,
                    lat: d.lat,
                    lng: d.lng,
                    name: d.name || `Location ${i + 1}`,
                    address: d.address || '',
                    preferredPickupTime: d.preferredPickupTime,
                    timeWindowStart: d.timeWindowStart,
                    timeWindowEnd: d.timeWindowEnd,
                };
            }),
            tripType: input.tripType,
            constraints: {
                departureTime: constraints.departureTime,
                maxTotalDuration: constraints.maxTotalDuration,
                bufferPerStop: constraints.bufferPerStop || 2,
            },
            options: {
                useOSRM: options.useRealRoads ?? true,
                useTraffic: options.considerTraffic ?? false,
                generateAlternatives: options.generateAlternatives ?? false,
                maxAlternatives: options.maxAlternatives ?? 2,
            },
        };

        // Handle auto mode - run all algorithms in parallel
        if (isAutoMode) {
            try {
                const enginePath = `../../../` + `src/lib/ai-engine/index.js`;
                const module = await import(enginePath);
                const optimizeRouteAuto = module.optimizeRouteAuto;

                if (!optimizeRouteAuto) {
                    throw new Error('optimizeRouteAuto not found - falling back to standard optimization');
                }

                // Run all algorithms in parallel with timeout
                const result = await Promise.race([
                    optimizeRouteAuto(optimizationInput),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Optimization timeout')), config.optimization.timeout)
                    ),
                ]) as any;

                const duration = Date.now() - startTime;
                logger.toolResult('optimize_route', true, duration, requestId);

                // Return enhanced response with comparison data
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                mode: 'auto',
                                bestRoute: {
                                    stops: result.bestRoute.stops.map((stop: any, i: number) => ({
                                        sequence: i + 1,
                                        location: stop.location.name,
                                        coordinates: { lat: stop.location.lat, lng: stop.location.lng },
                                        arrivalTime: stop.arrivalTime,
                                        departureTime: stop.departureTime,
                                        distanceFromPrevious: stop.distanceFromPrevious,
                                        durationFromPrevious: stop.durationFromPrevious,
                                    })),
                                    totalDistance: result.bestRoute.totalDistance,
                                    totalDuration: result.bestRoute.totalDuration,
                                    estimatedArrival: result.bestRoute.estimatedArrival,
                                    efficiencyScore: result.bestRoute.efficiencyScore,
                                },
                                winner: result.winner,
                                algorithmComparison: result.comparison.map((r: any) => ({
                                    algorithm: r.algorithm,
                                    distance: r.distance,
                                    duration: r.duration,
                                    executionTime: r.executionTimeMs,
                                    viable: r.success,
                                    note: r.note,
                                })),
                                summary: result.summary,
                                metrics: {
                                    optimizationTimeMs: duration,
                                    totalAlgorithmsRun: result.comparison.length,
                                },
                            }, null, 2),
                        },
                    ],
                };
            } catch (autoError) {
                // Fall back to standard optimization if auto mode fails
                logger.warn('Auto mode failed, falling back to standard optimization', { error: autoError });
            }
        }

        // Standard single-algorithm mode
        const algorithmMap: Record<string, any> = {
            'nearest_neighbor': 'nearest_neighbor',
            'christofides': 'christofides',
            'genetic': 'genetic_algorithm',
            'dijkstra': 'dijkstra',
            'bmssp': 'bmssp',
            'auto': undefined,
        };

        optimizationInput.options!.method = options.algorithm
            ? algorithmMap[options.algorithm]
            : undefined;

        // Import and call the standard optimizer
        let optimizeRoute: (input: OptimizationInput) => Promise<any>;

        try {
            const enginePath = `../../../` + `src/lib/ai-engine/index.js`;
            const module = await import(enginePath);
            optimizeRoute = module.optimizeRoute;
        } catch (error) {
            logger.error('Failed to import AI engine', error, { requestId });
            throw new MCPError(
                ErrorCode.InternalError,
                'AI optimization engine not available. Ensure the main application is built.'
            );
        }

        // Call the optimizer with timeout
        const result = await Promise.race([
            optimizeRoute(optimizationInput),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Optimization timeout')), config.optimization.timeout)
            ),
        ]);

        const duration = Date.now() - startTime;
        logger.toolResult('optimize_route', true, duration, requestId);

        // Return formatted result
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        route: {
                            stops: result.primaryRoute.stops.map((stop: any, i: number) => ({
                                sequence: i + 1,
                                location: stop.location.name,
                                coordinates: { lat: stop.location.lat, lng: stop.location.lng },
                                arrivalTime: stop.arrivalTime,
                                departureTime: stop.departureTime,
                                distanceFromPrevious: stop.distanceFromPrevious,
                                durationFromPrevious: stop.durationFromPrevious,
                            })),
                            totalDistance: result.primaryRoute.totalDistance,
                            totalDuration: result.primaryRoute.totalDuration,
                            estimatedArrival: result.primaryRoute.estimatedArrival,
                        },
                        metrics: {
                            algorithmUsed: result.metrics.methodUsed,
                            optimizationTimeMs: duration,
                            improvementOverNaive: result.metrics.improvementOverNaive,
                            efficiencyScore: result.primaryRoute.efficiencyScore,
                        },
                        alternatives: result.alternativeRoutes?.map((alt: any) => ({
                            description: alt.description,
                            totalDistance: alt.totalDistance,
                            totalDuration: alt.totalDuration,
                        })),
                    }, null, 2),
                },
            ],
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.toolResult('optimize_route', false, duration, requestId);

        if (error instanceof MCPError) {
            throw error;
        }

        logger.error('Route optimization failed', error, { requestId });
        throw new MCPError(
            ErrorCode.InternalError,
            error instanceof Error ? error.message : 'Unknown error occurred'
        );
    }
}

/**
 * Handle optimize_multi_cluster tool call
 */
export async function handleOptimizeMultiCluster(args: any, requestId: string): Promise<any> {
    const startTime = Date.now();

    try {
        const input = requireObject(args, 'arguments');
        const employees = requireArray(input.employees, 'employees');
        const cabs = requireArray(input.cabs, 'cabs');
        const clusterConfig = input.config === undefined ? {} : requireObject(input.config, 'config');

        if (employees.length === 0) {
            throw new MCPError(ErrorCode.InvalidParams, 'employees must contain at least one employee');
        }

        if (cabs.length === 0) {
            throw new MCPError(ErrorCode.InvalidParams, 'cabs must contain at least one cab');
        }

        // Validate limits
        if (employees.length > config.optimization.maxLocations) {
            throw new MCPError(
                ErrorCode.InvalidParams,
                `Too many employees. Maximum allowed: ${config.optimization.maxLocations}`
            );
        }

        if (cabs.length > config.optimization.maxCabs) {
            throw new MCPError(
                ErrorCode.InvalidParams,
                `Too many cabs. Maximum allowed: ${config.optimization.maxCabs}`
            );
        }

        logger.toolCall('optimize_multi_cluster', {
            employeeCount: employees.length,
            cabCount: cabs.length,
        }, requestId);

        // Import multi-cluster optimizer
        let optimizeMultiCluster: any;

        try {
            // @ts-ignore - Dynamic import resolved at runtime
            const clusterPath = `../../../` + `src/lib/multi-cluster-optimizer.js`;
            const module = await import(clusterPath);
            optimizeMultiCluster = module.optimizeMultiCluster;
        } catch (error) {
            logger.error('Failed to import multi-cluster optimizer', error, { requestId });
            throw new MCPError(
                ErrorCode.InternalError,
                'Multi-cluster optimizer not available'
            );
        }

        // Execute clustering
        const result = optimizeMultiCluster(
            employees,
            cabs,
            clusterConfig
        );

        const duration = Date.now() - startTime;
        logger.toolResult('optimize_multi_cluster', true, duration, requestId);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        clusters: result.assignments.map((assignment: any) => ({
                            cabId: assignment.cab.id,
                            cabName: assignment.cab.name,
                            employeeCount: assignment.cluster.employees.length,
                            employees: assignment.cluster.employees.map((e: any) => e.name || e.id),
                            // Note: Individual route optimization would happen in a second step
                        })),
                        metrics: {
                            totalCabs: result.assignments.length,
                            totalEmployees: employees.length,
                            unassignedEmployees: result.unassignedEmployees.length,
                        },
                        warnings: result.warnings,
                    }, null, 2),
                },
            ],
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.toolResult('optimize_multi_cluster', false, duration, requestId);

        if (error instanceof MCPError) {
            throw error;
        }

        logger.error('Multi-cluster optimization failed', error, { requestId });
        throw new MCPError(
            ErrorCode.InternalError,
            error instanceof Error ? error.message : 'Unknown error occurred'
        );
    }
}

/**
 * Handle calculate_distance_matrix tool call
 */
export async function handleCalculateDistanceMatrix(args: any, requestId: string): Promise<any> {
    const startTime = Date.now();

    try {
        const input = requireObject(args, 'arguments');
        const coordinates = requireArray(input.coordinates, 'coordinates');

        if (coordinates.length < 2) {
            throw new MCPError(ErrorCode.InvalidParams, 'coordinates must contain at least two points');
        }

        if (coordinates.length > config.optimization.maxLocations) {
            throw new MCPError(
                ErrorCode.InvalidParams,
                `Too many coordinates. Maximum allowed: ${config.optimization.maxLocations}`
            );
        }

        logger.toolCall('calculate_distance_matrix', {
            coordinateCount: coordinates.length,
            useRealRoads: input.useRealRoads ?? true,
        }, requestId);

        // Import distance calculation
        let getDistanceMatrix: any;
        let haversineDistance: any;

        try {
            // @ts-ignore - Dynamic imports resolved at runtime
            const osrmPath = `../../../` + `src/lib/ai-engine/osrm-client.js`;
            const tspPath = `../../../` + `src/lib/ai-engine/tsp-christofides.js`;
            const osrmModule = await import(osrmPath);
            // @ts-ignore
            const tspModule = await import(tspPath);
            getDistanceMatrix = osrmModule.getDistanceMatrix;
            haversineDistance = tspModule.haversineDistance;
        } catch (error) {
            logger.error('Failed to import distance calculation modules', error, { requestId });
            throw new MCPError(
                ErrorCode.InternalError,
                'Distance calculation not available'
            );
        }

        let distanceMatrix: number[][];
        let durationMatrix: number[][] | undefined;
        const method = (input.useRealRoads ?? true) ? 'osrm' : 'haversine';
        const normalizedCoordinates = coordinates.map((coordinate, i) =>
            requireCoordinate(coordinate, `coordinates[${i}]`)
        );

        if (method === 'osrm') {
            // Use OSRM for real road distances
            const result = await getDistanceMatrix(normalizedCoordinates);
            distanceMatrix = result.distances;
            durationMatrix = result.durations;
        } else {
            // Use haversine formula for straight-line distances
            const n = normalizedCoordinates.length;
            distanceMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (i !== j) {
                        distanceMatrix[i][j] = haversineDistance(
                            normalizedCoordinates[i].lat,
                            normalizedCoordinates[i].lng,
                            normalizedCoordinates[j].lat,
                            normalizedCoordinates[j].lng
                        );
                    }
                }
            }
        }

        const duration = Date.now() - startTime;
        logger.toolResult('calculate_distance_matrix', true, duration, requestId);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        method,
                        distances: distanceMatrix,
                        durations: durationMatrix,
                        unit: {
                            distance: 'kilometers',
                            duration: 'minutes',
                        },
                    }, null, 2),
                },
            ],
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.toolResult('calculate_distance_matrix', false, duration, requestId);

        if (error instanceof MCPError) {
            throw error;
        }

        logger.error('Distance matrix calculation failed', error, { requestId });
        throw new MCPError(
            ErrorCode.InternalError,
            error instanceof Error ? error.message : 'Unknown error occurred'
        );
    }
}
