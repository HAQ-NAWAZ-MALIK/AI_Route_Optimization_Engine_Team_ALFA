/**
 * Auto Optimizer - Parallel Algorithm Comparison
 * 
 * When algorithm is set to "auto" or not specified, this module:
 * 1. Runs ALL optimization algorithms in parallel
 * 2. Compares results and selects the best
 * 3. Returns the best route along with comparison data
 * 
 * This ensures the user always gets the optimal result across all algorithms.
 */

import type {
    Coordinate,
    EmployeeLocation,
    Location,
    RouteOptimizationInput,
    OptimizedRoute,
    OptimizationMethod,
    OptimizationOptions,
    TimeWindow,
    TimeConstraints,
    RouteStop,
} from './types';

import { solveTSPChristofides, buildDistanceMatrixFromCoordinates, improve2Opt } from './tsp-christofides';
import { optimizeWithGeneticAlgorithm } from './genetic-algorithm';
import { testAllRoutes, estimateExhaustiveTime } from './exhaustive-testing';
import { optimizeWithDijkstra } from './dijkstra';
import { optimizeWithBMSSP } from './bmssp';
import { getDistanceMatrix, checkOSRMHealth, getRoute, extractNavigationSteps } from './osrm-client';
import { generateTimeWindows, calculateRouteTiming, validateTimeWindows, calculateTimeWindowScore, parseTimeToMinutes, formatMinutesToTime } from './time-window-solver';
import { applyDefaultTrafficAdjustment, isTrafficApiAvailable } from './traffic-integration';

// ============================================================================
// TYPES
// ============================================================================

export interface AlgorithmResult {
    algorithm: OptimizationMethod | 'exhaustive';
    route: OptimizedRoute | null;
    distance: number;
    duration: number;
    executionTimeMs: number;
    success: boolean;
    error?: string;
    note?: string;
}

export interface AutoOptimizeResult {
    bestRoute: OptimizedRoute;
    winner: OptimizationMethod | 'exhaustive';
    comparison: AlgorithmResult[];
    totalExecutionTimeMs: number;
    summary: string;
}

// ============================================================================
// MAIN AUTO-OPTIMIZE FUNCTION
// ============================================================================

/**
 * Optimize a route by running ALL algorithms in parallel and returning the best
 */
export async function optimizeRouteAuto(
    input: RouteOptimizationInput
): Promise<AutoOptimizeResult> {
    const startTime = Date.now();
    const { origin, destinations, tripType, constraints, options = {} } = input;

    // Handle empty input
    if (destinations.length === 0) {
        const emptyRoute = createEmptyRoute(origin, constraints, startTime);
        return {
            bestRoute: emptyRoute,
            winner: 'nearest_neighbor',
            comparison: [],
            totalExecutionTimeMs: Date.now() - startTime,
            summary: 'No destinations provided',
        };
    }

    // Check available services
    const osrmAvailable = options.useOSRM !== false && await checkOSRMHealth();
    const trafficAvailable = options.useTraffic !== false && isTrafficApiAvailable();

    // Build coordinate array (origin + destinations)
    const allLocations: (Location | EmployeeLocation)[] = [origin, ...destinations];
    const coordinates: Coordinate[] = allLocations.map(l => ({ lat: l.lat, lng: l.lng }));

    // Build distance matrix ONCE (shared by all algorithms)
    let distanceMatrix: number[][];
    let durationMatrix: number[][];

    if (osrmAvailable) {
        try {
            const tableResult = await getDistanceMatrix(coordinates);
            distanceMatrix = tableResult.distances!.map(row =>
                row.map(d => d / 1000) // Convert to km
            );
            durationMatrix = tableResult.durations.map(row =>
                row.map(d => d / 60) // Convert to minutes
            );
        } catch (error) {
            console.warn('OSRM table failed, falling back to Haversine:', error);
            distanceMatrix = buildDistanceMatrixFromCoordinates(coordinates);
            durationMatrix = estimateDurationMatrix(distanceMatrix);
        }
    } else {
        distanceMatrix = buildDistanceMatrixFromCoordinates(coordinates);
        durationMatrix = estimateDurationMatrix(distanceMatrix);
    }

    // Generate time windows
    const timeWindows = generateTimeWindows(destinations);
    const hasTimeWindows = timeWindows.size > 0;

    // Prepare time windows for genetic algorithm
    const gaTimeWindows = hasTimeWindows
        ? Array.from({ length: allLocations.length }, (_, i) => {
            if (i === 0) return undefined;
            const emp = destinations[i - 1];
            return timeWindows.get(emp.id);
        }).filter(Boolean) as TimeWindow[]
        : undefined;

    // Define algorithm runners - each returns the optimized order
    const runChristofides = async (): Promise<{ order: number[], time: number }> => {
        const start = Date.now();
        let order = solveTSPChristofides(distanceMatrix, 0);
        order = improve2Opt(order, distanceMatrix, 200);
        return { order, time: Date.now() - start };
    };

    const runGenetic = async (): Promise<{ order: number[], time: number }> => {
        const start = Date.now();
        const result = optimizeWithGeneticAlgorithm(
            distanceMatrix,
            0,
            gaTimeWindows,
            { generations: Math.min(100, destinations.length * 5) }
        );
        return { order: result.route, time: Date.now() - start };
    };

    const runNearestNeighbor = async (): Promise<{ order: number[], time: number }> => {
        const start = Date.now();
        const order = nearestNeighborRoute(distanceMatrix);
        return { order, time: Date.now() - start };
    };

    const runExhaustive = async (): Promise<{ order: number[], time: number } | null> => {
        // Only run exhaustive for small problems (≤8 stops, excluding origin)
        if (destinations.length > 8) {
            return null;
        }
        const start = Date.now();
        const result = testAllRoutes(origin as Location, destinations, {});
        // Convert the destination order back to full order including origin
        const destOrder = result.optimalRoute.order.map(i => i + 1); // Convert to 1-indexed for full locations array
        return { order: [0, ...destOrder], time: Date.now() - start };
    };

    const runDijkstra = async (): Promise<{ order: number[], time: number }> => {
        const start = Date.now();
        const result = optimizeWithDijkstra(distanceMatrix, 0);
        return { order: result.route, time: Date.now() - start };
    };

    const runBMSSP = async (): Promise<{ order: number[], time: number }> => {
        const start = Date.now();
        const result = optimizeWithBMSSP(distanceMatrix, 0);
        return { order: result.route, time: Date.now() - start };
    };

    // Run ALL algorithms in parallel using Promise.allSettled
    const algorithmPromises = [
        runChristofides().then(r => ({ ...r, algorithm: 'christofides' as const })),
        runGenetic().then(r => ({ ...r, algorithm: 'genetic_algorithm' as const })),
        runNearestNeighbor().then(r => ({ ...r, algorithm: 'nearest_neighbor' as const })),
        runExhaustive().then(r => r ? { ...r, algorithm: 'exhaustive' as const } : null),
        runDijkstra().then(r => ({ ...r, algorithm: 'dijkstra' as const })),
        runBMSSP().then(r => ({ ...r, algorithm: 'bmssp' as const })),
    ];

    const settledResults = await Promise.allSettled(algorithmPromises);

    // Process results and build routes
    const algorithmResults: AlgorithmResult[] = [];

    for (const result of settledResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
            const { order, time, algorithm } = result.value;

            // Adjust order for drop trips
            let finalOrder = order;
            if (tripType === 'drop') {
                const withoutOrigin = order.filter(i => i !== 0);
                finalOrder = [0, ...withoutOrigin.reverse()];
            }

            try {
                // Build the full route
                const route = await buildOptimizedRoute(
                    finalOrder,
                    allLocations,
                    destinations,
                    distanceMatrix,
                    durationMatrix,
                    constraints,
                    timeWindows,
                    osrmAvailable,
                    trafficAvailable,
                    algorithm === 'exhaustive' ? 'christofides' : algorithm, // Use valid OptimizationMethod
                    startTime
                );

                algorithmResults.push({
                    algorithm,
                    route,
                    distance: route.totalDistance,
                    duration: route.totalDuration,
                    executionTimeMs: time,
                    success: true,
                    note: algorithm === 'exhaustive' ? `Guaranteed optimal (${destinations.length} stops)` : undefined,
                });
            } catch (error) {
                algorithmResults.push({
                    algorithm,
                    route: null,
                    distance: Infinity,
                    duration: Infinity,
                    executionTimeMs: time,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        } else if (result.status === 'rejected') {
            // Log failed algorithm
            console.error('Algorithm failed:', result.reason);
        }
    }

    // Find the winner (best by distance, then duration)
    const successfulResults = algorithmResults.filter(r => r.success && r.route);
    successfulResults.sort((a, b) => {
        const distDiff = a.distance - b.distance;
        if (Math.abs(distDiff) > 0.1) return distDiff; // More than 100m difference
        return a.duration - b.duration;
    });

    const winner = successfulResults[0];
    if (!winner || !winner.route) {
        throw new Error('All algorithms failed');
    }

    // Calculate summary
    const worstDistance = Math.max(...successfulResults.map(r => r.distance));
    const improvement = Math.round((1 - winner.distance / worstDistance) * 100);
    const summary = improvement > 0
        ? `${formatAlgorithmName(winner.algorithm)} produced the best route (${winner.distance.toFixed(1)} km), ${improvement}% better than the worst algorithm`
        : `${formatAlgorithmName(winner.algorithm)} produced the optimal route (${winner.distance.toFixed(1)} km)`;

    return {
        bestRoute: winner.route,
        winner: winner.algorithm,
        comparison: algorithmResults.map(r => ({
            ...r,
            route: null, // Don't include full route in comparison to save space
        })),
        totalExecutionTimeMs: Date.now() - startTime,
        summary,
    };
}

// ============================================================================
// HELPER FUNCTIONS (copied from enhanced-route-optimizer.ts for independence)
// ============================================================================

function estimateDurationMatrix(distanceMatrix: number[][]): number[][] {
    const avgSpeedKmh = 30;
    return distanceMatrix.map(row =>
        row.map(distance => (distance / avgSpeedKmh) * 60)
    );
}

function nearestNeighborRoute(distanceMatrix: number[][]): number[] {
    const n = distanceMatrix.length;
    const visited = new Set([0]);
    const route = [0];
    let current = 0;

    while (visited.size < n) {
        let nearest = -1;
        let nearestDist = Infinity;

        for (let i = 0; i < n; i++) {
            if (!visited.has(i) && distanceMatrix[current][i] < nearestDist) {
                nearestDist = distanceMatrix[current][i];
                nearest = i;
            }
        }

        if (nearest !== -1) {
            route.push(nearest);
            visited.add(nearest);
            current = nearest;
        }
    }

    return route;
}

async function buildOptimizedRoute(
    order: number[],
    allLocations: (Location | EmployeeLocation)[],
    employees: EmployeeLocation[],
    distanceMatrix: number[][],
    durationMatrix: number[][],
    constraints: TimeConstraints,
    timeWindows: Map<string, TimeWindow>,
    useOSRM: boolean,
    useTraffic: boolean,
    method: OptimizationMethod,
    startTime: number
): Promise<OptimizedRoute> {
    const stops = calculateRouteTiming(
        order,
        employees,
        distanceMatrix,
        0,
        constraints
    );

    let totalDistance = 0;
    let totalDuration = 0;
    let lastIndex = 0;

    for (const idx of order) {
        if (idx !== 0) {
            totalDistance += distanceMatrix[lastIndex][idx];
            totalDuration += durationMatrix[lastIndex][idx];
            lastIndex = idx;
        }
    }

    // Add return to origin
    totalDistance += distanceMatrix[lastIndex][0];
    totalDuration += durationMatrix[lastIndex][0];

    // Apply traffic adjustment
    if (useTraffic) {
        totalDuration = applyDefaultTrafficAdjustment(totalDuration);
    }

    // Validate time windows
    const violations = validateTimeWindows(
        order,
        employees,
        distanceMatrix,
        0,
        constraints,
        timeWindows
    );
    const timeWindowScore = calculateTimeWindowScore(violations, stops.length);

    // Get navigation if OSRM available
    let geometry: string | undefined;

    if (useOSRM && stops.length > 0) {
        try {
            const routeCoords: Coordinate[] = [
                { lat: allLocations[0].lat, lng: allLocations[0].lng },
                ...stops.map(s => ({ lat: s.location.lat, lng: s.location.lng })),
                { lat: allLocations[0].lat, lng: allLocations[0].lng },
            ];
            const osrmRoute = await getRoute(routeCoords, { steps: false });
            geometry = osrmRoute.routes[0]?.geometry;
        } catch (error) {
            console.warn('Failed to get OSRM geometry:', error);
        }
    }

    // Calculate efficiency score
    const avgDistPerStop = stops.length > 0 ? totalDistance / stops.length : 0;
    const optimalAvgDist = 3;
    const distanceScore = Math.min(100, (optimalAvgDist / Math.max(avgDistPerStop, 0.1)) * 100);
    const timeScore = totalDuration < stops.length * 10
        ? 100
        : Math.max(50, 100 - (totalDuration - stops.length * 10));
    const efficiencyScore = Math.round(distanceScore * 0.5 + timeScore * 0.3 + timeWindowScore * 0.2);

    // Calculate savings
    const naiveDistance = calculateNaiveDistance(employees, allLocations[0]);
    const savingsPercent = Math.round((1 - totalDistance / Math.max(naiveDistance, 1)) * 100);

    const departureMinutes = parseTimeToMinutes(constraints.departureTime);
    const arrivalMinutes = departureMinutes + totalDuration;

    return {
        id: generateRouteId(),
        stops,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalDuration: Math.round(totalDuration),
        estimatedArrival: formatMinutesToTime(arrivalMinutes),
        efficiencyScore: Math.min(100, Math.max(50, efficiencyScore)),
        savingsPercent: Math.max(0, savingsPercent),
        timeWindowScore,
        geometry,
        optimizationMethod: method,
        optimizationDuration: Date.now() - startTime,
    };
}

function calculateNaiveDistance(
    employees: EmployeeLocation[],
    origin: Location | EmployeeLocation
): number {
    let total = 0;
    for (const emp of employees) {
        const dist = haversineDistance(
            origin.lat, origin.lng,
            emp.lat, emp.lng
        );
        total += dist * 2;
    }
    return total;
}

function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

function generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyRoute(
    origin: Location,
    constraints: TimeConstraints,
    startTime: number
): OptimizedRoute {
    return {
        id: generateRouteId(),
        stops: [],
        totalDistance: 0,
        totalDuration: 0,
        estimatedArrival: constraints.departureTime,
        efficiencyScore: 100,
        savingsPercent: 0,
        timeWindowScore: 100,
        optimizationMethod: 'nearest_neighbor',
        optimizationDuration: Date.now() - startTime,
    };
}

function formatAlgorithmName(algorithm: OptimizationMethod | 'exhaustive'): string {
    const names: Record<string, string> = {
        'nearest_neighbor': 'Nearest Neighbor',
        'christofides': 'Christofides',
        'genetic_algorithm': 'Genetic Algorithm',
        'exhaustive': 'Exhaustive Search',
        'dijkstra': 'Dijkstra',
        'bmssp': 'BMSSP',
        'two_opt': '2-Opt',
        'hybrid': 'Hybrid',
    };
    return names[algorithm] || algorithm;
}
