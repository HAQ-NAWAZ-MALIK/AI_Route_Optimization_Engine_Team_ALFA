/**
 * Dijkstra's Algorithm for Route Optimization
 * 
 * Classic single-source shortest path algorithm using binary heap.
 * Time Complexity: O(m + n log n)
 * 
 * This implementation provides TSP-compatible output by converting
 * shortest path results into a visit order based on distance from origin.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DijkstraResult {
    distances: number[];      // Shortest distance from source to each vertex
    predecessors: number[];   // Previous vertex on shortest path (-1 if none)
}

export interface DijkstraTSPResult {
    route: number[];          // Visit order (TSP-compatible)
    totalDistance: number;    // Total route distance
    executionTimeMs: number;  // Algorithm execution time
}

// ============================================================================
// CORE DIJKSTRA ALGORITHM
// ============================================================================

/**
 * Dijkstra's algorithm using binary heap priority queue.
 * Finds shortest paths from source to all other vertices.
 * 
 * @param distanceMatrix - N×N matrix where [i][j] = distance from i to j
 * @param source - Source vertex index
 * @returns Object with distances and predecessors arrays
 */
export function solveDijkstraShortestPaths(
    distanceMatrix: number[][],
    source: number
): DijkstraResult {
    const n = distanceMatrix.length;
    const INF = Infinity;

    // Initialize arrays
    const distances: number[] = new Array(n).fill(INF);
    const predecessors: number[] = new Array(n).fill(-1);
    distances[source] = 0;

    // Priority queue: [distance, vertex]
    // JavaScript doesn't have a built-in heap, so we use a simple array-based approach
    // For production, consider using a proper heap library
    const heap: Array<[number, number]> = [[0, source]];
    const processed: boolean[] = new Array(n).fill(false);

    while (heap.length > 0) {
        // Find minimum (simple O(n) approach - sufficient for small n)
        let minIdx = 0;
        for (let i = 1; i < heap.length; i++) {
            if (heap[i][0] < heap[minIdx][0]) {
                minIdx = i;
            }
        }

        const [d, u] = heap[minIdx];
        heap.splice(minIdx, 1);

        // Skip if already processed or outdated
        if (processed[u] || d > distances[u]) {
            continue;
        }

        processed[u] = true;

        // Relax all outgoing edges
        for (let v = 0; v < n; v++) {
            if (v === u) continue;

            const weight = distanceMatrix[u][v];
            if (weight > 0 && weight < INF) {
                const candidate = d + weight;
                if (candidate < distances[v]) {
                    distances[v] = candidate;
                    predecessors[v] = u;
                    heap.push([candidate, v]);
                }
            }
        }
    }

    return { distances, predecessors };
}

/**
 * Find shortest path between two vertices.
 * 
 * @param distanceMatrix - N×N distance matrix
 * @param source - Start vertex
 * @param target - End vertex
 * @returns Path array and total distance
 */
export function findShortestPath(
    distanceMatrix: number[][],
    source: number,
    target: number
): { path: number[], distance: number } {
    const { distances, predecessors } = solveDijkstraShortestPaths(distanceMatrix, source);

    if (distances[target] === Infinity) {
        return { path: [], distance: Infinity };
    }

    // Reconstruct path
    const path: number[] = [];
    let current = target;
    while (current !== -1) {
        path.push(current);
        current = predecessors[current];
    }
    path.reverse();

    return { path, distance: distances[target] };
}

// ============================================================================
// TSP-COMPATIBLE OPTIMIZATION
// ============================================================================

/**
 * Optimize route using Dijkstra-based greedy approach.
 * 
 * This creates a TSP-compatible tour by:
 * 1. Starting at the origin
 * 2. Greedily selecting the nearest unvisited vertex using Dijkstra distances
 * 3. Repeating until all vertices are visited
 * 
 * This is essentially an enhanced nearest-neighbor using shortest-path distances
 * rather than direct distances, which can be better for road networks.
 * 
 * @param distanceMatrix - N×N distance matrix
 * @param startIndex - Starting vertex (typically 0 for origin)
 * @returns TSP-compatible route with total distance
 */
export function optimizeWithDijkstra(
    distanceMatrix: number[][],
    startIndex: number = 0
): DijkstraTSPResult {
    const startTime = Date.now();
    const n = distanceMatrix.length;

    if (n === 0) {
        return { route: [], totalDistance: 0, executionTimeMs: 0 };
    }

    if (n === 1) {
        return { route: [0], totalDistance: 0, executionTimeMs: Date.now() - startTime };
    }

    // Build route using Dijkstra-enhanced greedy selection
    const visited = new Set<number>([startIndex]);
    const route: number[] = [startIndex];
    let current = startIndex;
    let totalDistance = 0;

    while (visited.size < n) {
        // Get shortest paths from current vertex
        const { distances } = solveDijkstraShortestPaths(distanceMatrix, current);

        // Find nearest unvisited vertex
        let nearest = -1;
        let nearestDist = Infinity;

        for (let v = 0; v < n; v++) {
            if (!visited.has(v) && distances[v] < nearestDist) {
                nearest = v;
                nearestDist = distances[v];
            }
        }

        if (nearest === -1) break;

        visited.add(nearest);
        route.push(nearest);
        totalDistance += nearestDist;
        current = nearest;
    }

    // Add return to origin distance
    if (route.length > 1) {
        totalDistance += distanceMatrix[current][startIndex];
    }

    return {
        route,
        totalDistance: Math.round(totalDistance * 100) / 100,
        executionTimeMs: Date.now() - startTime,
    };
}

/**
 * Alternative: Use Dijkstra for distance-ordered visiting.
 * Visits vertices in order of their distance from origin.
 * Good for "radiating outward" patterns.
 * 
 * @param distanceMatrix - N×N distance matrix
 * @param startIndex - Starting vertex
 * @returns TSP-compatible route
 */
export function optimizeWithDijkstraDistanceOrder(
    distanceMatrix: number[][],
    startIndex: number = 0
): DijkstraTSPResult {
    const startTime = Date.now();
    const n = distanceMatrix.length;

    if (n <= 1) {
        return { route: [startIndex], totalDistance: 0, executionTimeMs: 0 };
    }

    // Get distances from origin to all vertices
    const { distances } = solveDijkstraShortestPaths(distanceMatrix, startIndex);

    // Create indexed pairs and sort by distance
    const indexed: Array<[number, number]> = distances.map((d, i) => [d, i]);
    indexed.sort((a, b) => a[0] - b[0]);

    // Build route in distance order (closest first)
    const route = indexed.map(pair => pair[1]);

    // Calculate actual tour distance
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        totalDistance += distanceMatrix[route[i]][route[i + 1]];
    }
    totalDistance += distanceMatrix[route[route.length - 1]][startIndex];

    return {
        route,
        totalDistance: Math.round(totalDistance * 100) / 100,
        executionTimeMs: Date.now() - startTime,
    };
}
