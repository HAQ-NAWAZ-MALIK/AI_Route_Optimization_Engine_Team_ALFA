/**
 * Exhaustive Route Testing
 * Tests all possible route permutations for small employee counts
 * Provides provably optimal routes for ≤8 employees
 */

import { haversineDistance, buildDistanceMatrixFromCoordinates } from './tsp-christofides';
import type { Coordinate, Location, EmployeeLocation } from './types';

// ============================================================================
// PERMUTATION GENERATOR
// ============================================================================

/**
 * Generate all permutations of an array
 * Uses Heap's algorithm for efficiency
 */
export function* generatePermutations<T>(array: T[]): Generator<T[]> {
    const n = array.length;
    const c = new Array(n).fill(0);
    const result = [...array];

    yield [...result];

    let i = 0;
    while (i < n) {
        if (c[i] < i) {
            if (i % 2 === 0) {
                [result[0], result[i]] = [result[i], result[0]];
            } else {
                [result[c[i]], result[i]] = [result[i], result[c[i]]];
            }
            yield [...result];
            c[i]++;
            i = 0;
        } else {
            c[i] = 0;
            i++;
        }
    }
}

/**
 * Calculate factorial (for estimating permutation count)
 */
export function factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

// ============================================================================
// EXHAUSTIVE ROUTE TESTING
// ============================================================================

export interface TestedRoute {
    order: number[];           // Indices of destinations in visit order
    distance: number;          // Total route distance in km
    isOptimal: boolean;        // True if this is the best found
}

export interface ExhaustiveResult {
    totalRoutesTested: number;
    optimalRoute: TestedRoute;
    topRoutes: TestedRoute[];  // Top 5 best routes
    worstRoute: TestedRoute;
    allRoutes?: TestedRoute[]; // All routes if small enough
    exhaustive: boolean;       // Was exhaustive search done
    confidenceScore: number;   // 0-100, 100 = exhaustive
    timeTakenMs: number;
    estimatedPermutations: number;
}

/**
 * Test all possible route orderings exhaustively
 * Only recommended for ≤8 destinations (40,320 permutations)
 */
export function testAllRoutes(
    origin: Location,
    destinations: EmployeeLocation[],
    options: {
        maxPermutations?: number;
        returnAllRoutes?: boolean;
    } = {}
): ExhaustiveResult {
    const startTime = performance.now();
    const n = destinations.length;
    const maxPerms = options.maxPermutations ?? 50000;
    const estimatedPerms = factorial(n);

    // Build all coordinates (origin at index 0)
    const allLocations = [origin, ...destinations];
    const coords: Coordinate[] = allLocations.map(l => ({ lat: l.lat, lng: l.lng }));

    // Build distance matrix
    const distMatrix = buildDistanceMatrixFromCoordinates(coords);

    // Track all tested routes
    const testedRoutes: TestedRoute[] = [];
    let bestRoute: TestedRoute | null = null;
    let worstRoute: TestedRoute | null = null;
    let routeCount = 0;

    // Create destination indices (0 is origin, so destinations are 1 to n)
    const destIndices = destinations.map((_, i) => i + 1);

    // Test all permutations
    const exhaustive = estimatedPerms <= maxPerms;

    for (const permutation of generatePermutations(destIndices)) {
        if (routeCount >= maxPerms) break;

        // Calculate total distance for this route
        // Origin -> first destination -> ... -> last destination -> Origin
        let totalDistance = distMatrix[0][permutation[0]]; // Origin to first
        for (let i = 0; i < permutation.length - 1; i++) {
            totalDistance += distMatrix[permutation[i]][permutation[i + 1]];
        }
        totalDistance += distMatrix[permutation[permutation.length - 1]][0]; // Last to origin

        const route: TestedRoute = {
            order: permutation.map(i => i - 1), // Convert to 0-based destination indices
            distance: Math.round(totalDistance * 100) / 100,
            isOptimal: false,
        };

        if (options.returnAllRoutes || testedRoutes.length < 100) {
            testedRoutes.push(route);
        }

        if (!bestRoute || totalDistance < bestRoute.distance) {
            if (bestRoute) bestRoute.isOptimal = false;
            route.isOptimal = true;
            bestRoute = route;
        }

        if (!worstRoute || totalDistance > worstRoute.distance) {
            worstRoute = route;
        }

        routeCount++;
    }

    const endTime = performance.now();

    // Sort to get top routes
    testedRoutes.sort((a, b) => a.distance - b.distance);
    const topRoutes = testedRoutes.slice(0, 5);

    // Mark optimal
    if (topRoutes.length > 0) {
        topRoutes[0].isOptimal = true;
    }

    return {
        totalRoutesTested: routeCount,
        optimalRoute: bestRoute!,
        topRoutes,
        worstRoute: worstRoute!,
        allRoutes: options.returnAllRoutes ? testedRoutes : undefined,
        exhaustive,
        confidenceScore: exhaustive ? 100 : Math.round((routeCount / estimatedPerms) * 100),
        timeTakenMs: Math.round(endTime - startTime),
        estimatedPermutations: estimatedPerms,
    };
}

/**
 * Estimate time for exhaustive search
 */
export function estimateExhaustiveTime(n: number): { perms: number; estimatedMs: number; warning: string } {
    const perms = factorial(n);
    // Approximate: ~0.001ms per permutation
    const estimatedMs = perms * 0.001;

    let warning = '';
    if (n > 10) {
        warning = `⚠️ EXTREME: ${perms.toLocaleString()} permutations (~${Math.round(estimatedMs / 60000)} minutes)`;
    } else if (n > 8) {
        warning = `⚠️ SLOW: ${perms.toLocaleString()} permutations (~${Math.round(estimatedMs / 1000)} seconds)`;
    } else if (n > 6) {
        warning = `${perms.toLocaleString()} permutations (~${Math.round(estimatedMs)}ms)`;
    } else {
        warning = `Fast: ${perms} permutations`;
    }

    return { perms, estimatedMs, warning };
}

// ============================================================================
// ROUTE ANALYSIS
// ============================================================================

/**
 * Calculate route segment data for visualization
 */
export interface RouteSegment {
    from: Coordinate;
    to: Coordinate;
    distance: number;
    frequency: number;  // How often this segment appears in tested routes
}

/**
 * Analyze all tested routes for heatmap data
 */
export function analyzeRouteSegments(
    origin: Location,
    destinations: EmployeeLocation[],
    testedRoutes: TestedRoute[]
): RouteSegment[] {
    const allLocations = [origin, ...destinations];
    const segmentMap = new Map<string, RouteSegment>();

    for (const route of testedRoutes) {
        // Origin to first
        const firstDest = allLocations[route.order[0] + 1];
        addSegment(segmentMap, origin, firstDest);

        // Between destinations
        for (let i = 0; i < route.order.length - 1; i++) {
            const from = allLocations[route.order[i] + 1];
            const to = allLocations[route.order[i + 1] + 1];
            addSegment(segmentMap, from, to);
        }

        // Last to origin
        const lastDest = allLocations[route.order[route.order.length - 1] + 1];
        addSegment(segmentMap, lastDest, origin);
    }

    return Array.from(segmentMap.values());
}

function addSegment(
    map: Map<string, RouteSegment>,
    from: Location | Coordinate,
    to: Location | Coordinate
): void {
    // Create bidirectional key
    const key = [
        `${from.lat.toFixed(4)},${from.lng.toFixed(4)}`,
        `${to.lat.toFixed(4)},${to.lng.toFixed(4)}`,
    ].sort().join('|');

    const existing = map.get(key);
    if (existing) {
        existing.frequency++;
    } else {
        map.set(key, {
            from: { lat: from.lat, lng: from.lng },
            to: { lat: to.lat, lng: to.lng },
            distance: haversineDistance(from.lat, from.lng, to.lat, to.lng),
            frequency: 1,
        });
    }
}

/**
 * Get statistics on tested routes
 */
export interface RouteStats {
    minDistance: number;
    maxDistance: number;
    avgDistance: number;
    medianDistance: number;
    stdDev: number;
    savingsPercent: number;  // Best vs worst
}

export function calculateRouteStats(testedRoutes: TestedRoute[]): RouteStats {
    if (testedRoutes.length === 0) {
        return { minDistance: 0, maxDistance: 0, avgDistance: 0, medianDistance: 0, stdDev: 0, savingsPercent: 0 };
    }

    const distances = testedRoutes.map(r => r.distance).sort((a, b) => a - b);
    const min = distances[0];
    const max = distances[distances.length - 1];
    const sum = distances.reduce((a, b) => a + b, 0);
    const avg = sum / distances.length;
    const median = distances[Math.floor(distances.length / 2)];

    const squaredDiffs = distances.map(d => Math.pow(d - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / distances.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    const savingsPercent = max > 0 ? ((max - min) / max) * 100 : 0;

    return {
        minDistance: Math.round(min * 100) / 100,
        maxDistance: Math.round(max * 100) / 100,
        avgDistance: Math.round(avg * 100) / 100,
        medianDistance: Math.round(median * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
    };
}
