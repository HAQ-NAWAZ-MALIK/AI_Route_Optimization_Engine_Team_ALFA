/**
 * Enhanced Route Optimizer
 * 
 * Production-grade route optimization combining:
 * - TSP Christofides algorithm (1.5x optimal)
 * - Genetic Algorithm for complex routes
 * - OSRM integration for real road routing
 * - Traffic-aware travel times
 * - Time window constraints
 * - Turn-by-turn navigation
 * - Alternative routes generation
 */

import type {
    Coordinate,
    EmployeeLocation,
    Location,
    RouteOptimizationInput,
    RouteOptimizationOutput,
    OptimizedRoute,
    AlternativeRoute,
    OptimizationMetrics,
    OptimizationMethod,
    NavigationStep,
    TimeWindow,
    TimeConstraints,
} from './types';

import { solveTSPChristofides, buildDistanceMatrixFromCoordinates, improve2Opt } from './tsp-christofides';
import { optimizeWithGeneticAlgorithm } from './genetic-algorithm';
import { getRoute, getDistanceMatrix, getOptimizedTrip, extractNavigationSteps, checkOSRMHealth } from './osrm-client';
import { generateTimeWindows, calculateRouteTiming, validateTimeWindows, calculateTimeWindowScore, parseTimeToMinutes, formatMinutesToTime } from './time-window-solver';
import { applyDefaultTrafficAdjustment, isTrafficApiAvailable } from './traffic-integration';

// ============================================================================
// MAIN OPTIMIZATION FUNCTION
// ============================================================================

/**
 * Optimize a route using the best available algorithm
 */
export async function optimizeRoute(
    input: RouteOptimizationInput
): Promise<RouteOptimizationOutput> {
    const startTime = Date.now();
    const { origin, destinations, tripType, constraints, options = {} } = input;

    // Validate input
    if (destinations.length === 0) {
        return createEmptyResult(origin, constraints, startTime);
    }

    // Check available services
    const osrmAvailable = options.useOSRM !== false && await checkOSRMHealth();
    const trafficAvailable = options.useTraffic !== false && isTrafficApiAvailable();

    // Build coordinate array (origin + destinations)
    const allLocations: (Location | EmployeeLocation)[] = [origin, ...destinations];
    const coordinates: Coordinate[] = allLocations.map(l => ({ lat: l.lat, lng: l.lng }));

    // Get distance matrix
    let distanceMatrix: number[][];
    let durationMatrix: number[][];

    if (osrmAvailable) {
        try {
            const tableResult = await getDistanceMatrix(coordinates);
            // OSRM returns distances in meters and durations in seconds
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

    // Choose optimization method
    const method = selectOptimizationMethod(
        destinations.length,
        timeWindows.size > 0,
        options.method
    );

    // Optimize route
    let optimizedOrder: number[];

    switch (method) {
        case 'genetic_algorithm': {
            const gaTimeWindows = timeWindows.size > 0
                ? Array.from({ length: allLocations.length }, (_, i) => {
                    if (i === 0) return undefined;
                    const emp = destinations[i - 1];
                    return timeWindows.get(emp.id);
                }).filter(Boolean) as TimeWindow[]
                : undefined;

            const gaResult = optimizeWithGeneticAlgorithm(
                distanceMatrix,
                0, // Start index
                gaTimeWindows,
                { generations: Math.min(100, destinations.length * 5) }
            );
            optimizedOrder = gaResult.route;
            break;
        }

        case 'christofides':
            optimizedOrder = solveTSPChristofides(distanceMatrix, 0);
            // Apply 2-opt improvement
            optimizedOrder = improve2Opt(optimizedOrder, distanceMatrix, 200);
            break;

        default:
            // Use OSRM trip service if available (built-in TSP)
            if (osrmAvailable) {
                try {
                    const tripResult = await getOptimizedTrip(coordinates, false);
                    optimizedOrder = tripResult.waypoints
                        .map(wp => wp.waypoint_index)
                        .filter((idx): idx is number => idx !== undefined);
                } catch {
                    optimizedOrder = solveTSPChristofides(distanceMatrix, 0);
                    optimizedOrder = improve2Opt(optimizedOrder, distanceMatrix, 200);
                }
            } else {
                optimizedOrder = solveTSPChristofides(distanceMatrix, 0);
                optimizedOrder = improve2Opt(optimizedOrder, distanceMatrix, 200);
            }
    }

    // For drop trips, reverse the order (office -> employees)
    if (tripType === 'drop') {
        // Keep origin first, reverse the rest
        const withoutOrigin = optimizedOrder.filter(i => i !== 0);
        optimizedOrder = [0, ...withoutOrigin.reverse()];
    }

    // Build optimized route with timing
    const primaryRoute = await buildOptimizedRoute(
        optimizedOrder,
        allLocations,
        destinations,
        distanceMatrix,
        durationMatrix,
        constraints,
        timeWindows,
        osrmAvailable,
        trafficAvailable,
        method,
        startTime
    );

    // Generate alternative routes if requested
    let alternativeRoutes: AlternativeRoute[] | undefined;
    if (options.generateAlternatives && destinations.length > 2) {
        alternativeRoutes = await generateAlternativeRoutes(
            optimizedOrder,
            allLocations,
            destinations,
            distanceMatrix,
            durationMatrix,
            constraints,
            timeWindows,
            osrmAvailable,
            trafficAvailable,
            primaryRoute,
            options.maxAlternatives ?? 2
        );
    }

    // Calculate metrics
    const naiveDistance = calculateNaiveDistance(destinations, origin);
    const metrics: OptimizationMetrics = {
        inputSize: destinations.length,
        optimizationDuration: Date.now() - startTime,
        methodUsed: method,
        osrmUsed: osrmAvailable,
        trafficConsidered: trafficAvailable,
        improvementOverNaive: Math.round((1 - primaryRoute.totalDistance / naiveDistance) * 100),
    };

    return {
        primaryRoute,
        alternativeRoutes,
        metrics,
    };
}

// ============================================================================
// ROUTE BUILDING
// ============================================================================

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
        0, // Origin index
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
    let turnByTurn: NavigationStep[] | undefined;
    let geometry: string | undefined;

    if (useOSRM && stops.length > 0) {
        try {
            const routeCoords: Coordinate[] = [
                { lat: allLocations[0].lat, lng: allLocations[0].lng },
                ...stops.map(s => ({ lat: s.location.lat, lng: s.location.lng })),
                { lat: allLocations[0].lat, lng: allLocations[0].lng }, // Return to origin
            ];
            const osrmRoute = await getRoute(routeCoords, { steps: true });
            turnByTurn = extractNavigationSteps(osrmRoute);
            geometry = osrmRoute.routes[0]?.geometry;
        } catch (error) {
            console.warn('Failed to get OSRM navigation:', error);
        }
    }

    // Calculate efficiency score
    const avgDistPerStop = stops.length > 0 ? totalDistance / stops.length : 0;
    const optimalAvgDist = 3; // Optimal km per stop in city
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
        turnByTurn,
        optimizationMethod: method,
        optimizationDuration: Date.now() - startTime,
    };
}

// ============================================================================
// ALTERNATIVE ROUTES
// ============================================================================

async function generateAlternativeRoutes(
    primaryOrder: number[],
    allLocations: (Location | EmployeeLocation)[],
    employees: EmployeeLocation[],
    distanceMatrix: number[][],
    durationMatrix: number[][],
    constraints: TimeConstraints,
    timeWindows: Map<string, TimeWindow>,
    useOSRM: boolean,
    useTraffic: boolean,
    primaryRoute: OptimizedRoute,
    maxAlternatives: number
): Promise<AlternativeRoute[]> {
    const alternatives: AlternativeRoute[] = [];
    const startTime = Date.now();

    // Alternative 1: Pure nearest neighbor (often different from optimized)
    if (maxAlternatives >= 1) {
        const nnOrder = nearestNeighborRoute(distanceMatrix);
        if (!arraysEqual(nnOrder, primaryOrder)) {
            const route = await buildOptimizedRoute(
                nnOrder,
                allLocations,
                employees,
                distanceMatrix,
                durationMatrix,
                constraints,
                timeWindows,
                useOSRM,
                useTraffic,
                'nearest_neighbor',
                startTime
            );
            alternatives.push({
                ...route,
                description: 'Nearest neighbor (quick)',
                comparisonToMain: {
                    distanceDiff: route.totalDistance - primaryRoute.totalDistance,
                    durationDiff: route.totalDuration - primaryRoute.totalDuration,
                },
            });
        }
    }

    // Alternative 2: Time window optimized order
    if (maxAlternatives >= 2 && timeWindows.size > 0) {
        const twOrder = timeWindowPriorityOrder(employees, timeWindows);
        if (!arraysEqual(twOrder, primaryOrder)) {
            const route = await buildOptimizedRoute(
                twOrder,
                allLocations,
                employees,
                distanceMatrix,
                durationMatrix,
                constraints,
                timeWindows,
                useOSRM,
                useTraffic,
                'nearest_neighbor',
                startTime
            );
            alternatives.push({
                ...route,
                description: 'Time window priority',
                comparisonToMain: {
                    distanceDiff: route.totalDistance - primaryRoute.totalDistance,
                    durationDiff: route.totalDuration - primaryRoute.totalDuration,
                },
            });
        }
    }

    return alternatives.slice(0, maxAlternatives);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function selectOptimizationMethod(
    stopCount: number,
    hasTimeWindows: boolean,
    preferred?: OptimizationMethod
): OptimizationMethod {
    if (preferred) return preferred;

    // For complex constraints, use genetic algorithm
    if (hasTimeWindows && stopCount > 5) {
        return 'genetic_algorithm';
    }

    // For medium-sized problems, use Christofides
    if (stopCount > 10) {
        return 'christofides';
    }

    // For small problems, Christofides is fast enough
    return 'christofides';
}

function estimateDurationMatrix(distanceMatrix: number[][]): number[][] {
    const avgSpeedKmh = 30; // Average city speed
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

function timeWindowPriorityOrder(
    employees: EmployeeLocation[],
    timeWindows: Map<string, TimeWindow>
): number[] {
    const order = [0]; // Start with origin

    // Sort by time window start
    const indices = employees
        .map((emp, idx) => ({ idx: idx + 1, emp }))
        .sort((a, b) => {
            const twA = timeWindows.get(a.emp.id);
            const twB = timeWindows.get(b.emp.id);

            if (!twA && !twB) return 0;
            if (!twA) return 1;
            if (!twB) return -1;

            return twA.start - twB.start;
        });

    order.push(...indices.map(i => i.idx));
    return order;
}

function calculateNaiveDistance(
    employees: EmployeeLocation[],
    origin: Location | EmployeeLocation
): number {
    // Naive: each employee picked up directly from origin (worst case)
    let total = 0;
    for (const emp of employees) {
        const dist = haversineDistance(
            origin.lat, origin.lng,
            emp.lat, emp.lng
        );
        total += dist * 2; // Round trip
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

function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
}

function generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyResult(
    origin: Location,
    constraints: TimeConstraints,
    startTime: number
): RouteOptimizationOutput {
    return {
        primaryRoute: {
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
        },
        metrics: {
            inputSize: 0,
            optimizationDuration: Date.now() - startTime,
            methodUsed: 'nearest_neighbor',
            osrmUsed: false,
            trafficConsidered: false,
            improvementOverNaive: 0,
        },
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { RouteOptimizationInput, RouteOptimizationOutput, OptimizedRoute, OptimizationMetrics };
