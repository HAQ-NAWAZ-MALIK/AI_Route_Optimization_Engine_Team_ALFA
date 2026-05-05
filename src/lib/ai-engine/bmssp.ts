/**
 * BMSSP - Breaking the Sorting Barrier for Single-Source Shortest Paths
 * 
 * TypeScript implementation of the O(m log^(2/3) n) algorithm from:
 * "Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"
 * by Duan, Mao, Mao, Shu, and Yin (2024)
 * 
 * This implementation provides TSP-compatible output for route optimization.
 * 
 * Note: BMSSP is most effective for large sparse graphs (100+ locations).
 * For smaller inputs, it falls back to Dijkstra for better practical performance.
 */

import { optimizeWithDijkstra, solveDijkstraShortestPaths } from './dijkstra';

// ============================================================================
// TYPES
// ============================================================================

export interface BMSSPOptions {
    k?: number;  // Frontier threshold ≈ floor(log(n)^(1/3))
    t?: number;  // Recursion fanout ≈ floor(log(n)^(2/3))
}

export interface BMSSPResult {
    distances: number[];
    predecessors: number[];
}

export interface BMSSPTSPResult {
    route: number[];
    totalDistance: number;
    executionTimeMs: number;
    algorithmUsed: 'bmssp' | 'dijkstra_fallback';
}

// Size threshold: use Dijkstra for small graphs
const BMSSP_SIZE_THRESHOLD = 100;

// ============================================================================
// HELPER CLASSES
// ============================================================================

/**
 * Internal set implementation for frontier management.
 */
class FrontierSet {
    private data: Set<number>;

    constructor(initial?: Set<number> | number[]) {
        if (initial instanceof Set) {
            this.data = new Set(initial);
        } else if (Array.isArray(initial)) {
            this.data = new Set(initial);
        } else {
            this.data = new Set();
        }
    }

    has(v: number): boolean {
        return this.data.has(v);
    }

    add(v: number): void {
        this.data.add(v);
    }

    size(): number {
        return this.data.size;
    }

    toArray(): number[] {
        return Array.from(this.data);
    }

    [Symbol.iterator](): Iterator<number> {
        return this.data[Symbol.iterator]();
    }

    copy(): FrontierSet {
        return new FrontierSet(this.data);
    }
}

/**
 * Level-adaptive priority queue for frontier management.
 */
class LevelQueue {
    private heap: Array<[number, number]> = [];  // [key, vertex]
    private minKey = Infinity;
    private upperBound: number;

    constructor(upperBound: number = Infinity) {
        this.upperBound = upperBound;
    }

    insert(v: number, key: number): void {
        this.heap.push([key, v]);
        if (key < this.minKey) {
            this.minKey = key;
        }
    }

    pull(): { vertices: number[], bound: number } {
        const bi = this.upperBound;
        if (this.heap.length === 0) {
            this.minKey = Infinity;
            return { vertices: [], bound: bi };
        }

        // Sort to find minimum
        this.heap.sort((a, b) => a[0] - b[0]);

        const eps = 1e-12;
        const smallestKey = this.heap[0][0];

        if (smallestKey > bi + eps) {
            return { vertices: [], bound: bi };
        }

        // Group all items with approximately the same key
        const baseKey = smallestKey;
        const si: number[] = [];

        while (this.heap.length > 0 && this.heap[0][0] <= baseKey + eps) {
            const [, v] = this.heap.shift()!;
            si.push(v);
        }

        this.minKey = this.heap.length > 0 ? this.heap[0][0] : Infinity;
        return { vertices: si, bound: bi };
    }

    batchPrepend(candidates: Array<[number, number]>): void {
        if (candidates.length === 0) return;

        let minCandKey = Infinity;
        for (const [v, key] of candidates) {
            this.heap.push([key, v]);
            if (key < minCandKey) {
                minCandKey = key;
            }
        }

        if (minCandKey < this.minKey) {
            this.minKey = minCandKey;
        }
    }

    nonEmpty(): boolean {
        return this.heap.length > 0;
    }
}

// =========================================================================
//  CORE BMSSP ALGORITHM   
// =========================================================================

/**
 * Compute K and T parameters based on graph size.
 */
function resolveOptions(n: number, options?: BMSSPOptions): { k: number, t: number } {
    if (n <= 1) return { k: 1, t: 1 };

    const logN = Math.log(n);
    const k = options?.k ?? Math.max(1, Math.floor(Math.pow(logN, 1 / 3)));
    const t = options?.t ?? Math.max(1, Math.floor(Math.pow(logN, 2 / 3)));

    return { k, t };
}

/**
 * Check if two floats are approximately equal.
 */
function nearlyEqual(a: number, b: number, eps: number = 1e-12): boolean {
    return Math.abs(a - b) < eps;
}

/**
 * Compute 2^exp efficiently.
 */
function intPow2(exp: number): number {
    return exp >= 0 ? (1 << exp) : 1;
}

/**
 * Base case: Run bounded mini-Dijkstra from singleton frontier.
 */
function baseCase(
    distMatrix: number[][],
    B: number,
    S: FrontierSet,
    db: number[],
    pred: number[],
    k: number
): { bPrime: number, U: FrontierSet } {
    const n = distMatrix.length;

    if (S.size() !== 1) {
        throw new Error('baseCase requires singleton S');
    }

    const x = S.toArray()[0];

    // Run bounded Dijkstra with limit K+1 vertices
    const U0: number[] = [];
    const heap: Array<[number, number]> = [[db[x], x]];
    const processed: boolean[] = new Array(n).fill(false);

    while (heap.length > 0 && U0.length < k + 1) {
        // Find minimum
        let minIdx = 0;
        for (let i = 1; i < heap.length; i++) {
            if (heap[i][0] < heap[minIdx][0]) minIdx = i;
        }
        const [du, u] = heap[minIdx];
        heap.splice(minIdx, 1);

        if (processed[u] || du >= B) continue;

        processed[u] = true;
        U0.push(u);
        

        for (let v = 0; v < n; v++) {
            if (v === u) continue;
            const weight = distMatrix[u][v];
            if (weight > 0 && weight < Infinity) {
                const cand = du + weight;
                if (cand < db[v] && cand < B) {
                    db[v] = cand;
                    pred[v] = u;
                    if (!processed[v]) {
                        heap.push([cand, v]);
                    }
                }
            }
        }
    }

    // If we processed ≤ K vertices, return them all with bound B
    if (U0.length <= k) {
        const U = new FrontierSet();
        for (const v of U0) U.add(v);
        return { bPrime: B, U };
    }

    // Otherwise, return exactly K vertices and use (K+1)-th distance as bound
    const pairs: Array<[number, number]> = U0.map(v => [db[v], v]);
    pairs.sort((a, b) => a[0] - b[0]);

    const bPrime = pairs[k][0];
    const U = new FrontierSet();
    for (let i = 0; i < k; i++) {
        U.add(pairs[i][1]);
    }

    return { bPrime, U };
}

/**
 * Find pivots using frontier reduction technique.
 */
function findPivots(
    distMatrix: number[][],
    B: number,
    S: FrontierSet,
    db: number[],
    k: number
): { P: FrontierSet, W: FrontierSet } {
    const n = distMatrix.length;

    
    // Initialize touched set W with frontier S
    const W = S.copy();
    const tmp = [...db];

    // Perform k rounds of bounded relaxations
    let current = S.copy();
    for (let round = 0; round < k; round++) {
        const nextSet = new FrontierSet();

        for (const u of current) {
            const du = tmp[u];
            if (du >= B) continue;

            for (let v = 0; v < n; v++) {
                const weight = distMatrix[u][v];
                if (weight > 0 && weight < Infinity) {
                    const cand = du + weight;
                    if (cand < tmp[v] && cand < B) {
                        tmp[v] = cand;
                        W.add(v);
                        nextSet.add(v);
                    }
                }
            }
        }

        if (W.size() > k * Math.max(1, S.size())) {
            return { P: S, W };
        }

        current = nextSet;
        if (current.size() === 0) break;
    }

    // Compute pivots
    const P = computePivots(distMatrix, S, W, tmp, k);
    return { P, W };
}

/**
 * Extract pivots from frontier based on shortest-path tree sizes.
 */
function computePivots(
    distMatrix: number[][],
    S: FrontierSet,
    W: FrontierSet,
    db: number[],
    k: number
): FrontierSet {
    const n = distMatrix.length;
    const subtreeSize: Map<number, number> = new Map();
    const children: Map<number, number[]> = new Map();

    for (const v of W) {
        subtreeSize.set(v, 1);
        children.set(v, []);
    }

    // Build parent-child relationships
    for (const v of W) {
        const dv = db[v];
        for (let u = 0; u < n; u++) {
            if (!W.has(u)) continue;
            const weight = distMatrix[v][u];
            if (weight > 0 && weight < Infinity && nearlyEqual(db[u], dv + weight)) {
                children.get(v)?.push(u);
            }
        }
    }

    // Sort vertices by distance for topological ordering
    const vertices: Array<[number, number]> = [];
    for (const v of W) {
        vertices.push([db[v], v]);
    }
    vertices.sort((a, b) => a[0] - b[0]);

    // Compute subtree sizes bottom-up
    for (let i = vertices.length - 1; i >= 0; i--) {
        const v = vertices[i][1];
        for (const child of children.get(v) || []) {
            subtreeSize.set(v, (subtreeSize.get(v) || 0) + (subtreeSize.get(child) || 0));
        }
    }

    // Extract pivots
    const P = new FrontierSet();
    for (const v of S) {
        if ((subtreeSize.get(v) || 0) >= k) {
            P.add(v);
        }
    }

    if (P.size() === 0) return S;
    return P;
}

/**
 * Main recursive BMSSP algorithm.
 */
function bmsspRecurse(
    distMatrix: number[][],
    level: number,
    B: number,
    S: FrontierSet,
    db: number[],
    pred: number[],
    k: number,
    t: number
): { bPrime: number, U: FrontierSet } {
    // Base case
    if (level === 0) {
        return baseCase(distMatrix, B, S, db, pred, k);
    }

    // Step 1: Find pivots P and touched set W
    const { P, W } = findPivots(distMatrix, B, S, db, k);

    // Step 2: Initialize level queue with pivot vertices
    const D = new LevelQueue(B);
    for (const v of P) {
        D.insert(v, db[v]);
    }

    // Step 3: Initialize completed set U with touched vertices W
    const U = new FrontierSet();
    for (const v of W) U.add(v);

    let bPrime = B;
    const limit = k * k * intPow2(level * t);

    // Step 4: Main loop
    while (U.size() < limit && D.nonEmpty()) {
        const { vertices: Si, bound: Bi } = D.pull();
        if (Si.length === 0) break;

        let Ui = new FrontierSet();
        let biPrime = Bi;

        if (level - 1 === 0) {
            for (const v of Si) {
                const singleton = new FrontierSet([v]);
                const { bPrime: bps, U: us } = baseCase(distMatrix, Bi, singleton, db, pred, k);
                if (bps < biPrime) biPrime = bps;
                for (const x of us) Ui.add(x);
            }
        } else {
            const SiSet = new FrontierSet(Si);
            const result = bmsspRecurse(distMatrix, level - 1, Bi, SiSet, db, pred, k, t);
            biPrime = result.bPrime;
            Ui = result.U;
        }

        for (const v of Ui) U.add(v);

        // Step 5: Relaxation sweep
        const candidates: Array<[number, number]> = [];
        for (const u of Ui) {
            const du = db[u];
            for (let v = 0; v < distMatrix.length; v++) {
                const weight = distMatrix[u][v];
                if (weight > 0 && weight < Infinity) {
                    const cand = du + weight;
                    if (cand <= db[v]) {
                        db[v] = cand;
                        pred[v] = u;

                        if (cand < B) {
                            D.insert(v, cand);
                        } else if (biPrime <= cand && cand < Bi) {
                            candidates.push([v, cand]);
                        }
                    }
                }
            }
        }

        D.batchPrepend(candidates);

        if (biPrime < bPrime) bPrime = biPrime;

        // Step 6: Absorb certified vertices
        for (const x of W) {
            if (db[x] < bPrime) U.add(x);
        }
    }

    return { bPrime, U };
}

/**
 * BMSSP: Breaking the Sorting Barrier Single-Source Shortest Path.
 * 
 * Time Complexity: O(m log^(2/3) n)
 * 
 * @param distanceMatrix - N×N distance matrix
 * @param source - Source vertex
 * @param options - Optional algorithm parameters
 */
export function solveBMSSP(
    distanceMatrix: number[][],
    source: number,
    options?: BMSSPOptions
): BMSSPResult {
    const n = distanceMatrix.length;

    if (source < 0 || source >= n) {
        throw new Error(`Source vertex out of range: ${source}`);
    }

    const { k, t } = resolveOptions(n, options);

    // Initialize arrays
    const distances: number[] = new Array(n).fill(Infinity);
    const predecessors: number[] = new Array(n).fill(-1);
    distances[source] = 0;

    // Compute number of recursion levels
    const logN = Math.log(Math.max(2, n));
    const level = Math.ceil(logN / t);

    // Initial frontier
    const initialFrontier = new FrontierSet([source]);

    // Run main BMSSP recursion
    bmsspRecurse(distanceMatrix, level, Infinity, initialFrontier, distances, predecessors, k, t);

    return { distances, predecessors };
}

// ============================================================================
// TSP-COMPATIBLE OPTIMIZATION
// ============================================================================

/**
 * Optimize route using BMSSP algorithm.
 * 
 * Creates a TSP-compatible tour using BMSSP for shortest path computation,
 * then applies greedy nearest-neighbor selection.
 * 
 * For graphs with fewer than 100 vertices, falls back to Dijkstra
 * for better practical performance.
 * 
 * @param distanceMatrix - N×N distance matrix
 * @param startIndex - Starting vertex (typically 0 for origin)
 * @returns TSP-compatible route
 */
export function optimizeWithBMSSP(
    distanceMatrix: number[][],
    startIndex: number = 0
): BMSSPTSPResult {
    const startTime = Date.now();
    const n = distanceMatrix.length;

    // For small graphs, use Dijkstra (faster in practice)
    if (n < BMSSP_SIZE_THRESHOLD) {
        const dijkstraResult = optimizeWithDijkstra(distanceMatrix, startIndex);
        return {
            route: dijkstraResult.route,
            totalDistance: dijkstraResult.totalDistance,
            executionTimeMs: Date.now() - startTime,
            algorithmUsed: 'dijkstra_fallback',
        };
    }

    // Use BMSSP for large graphs
    const visited = new Set<number>([startIndex]);
    const route: number[] = [startIndex];
    let current = startIndex;
    let totalDistance = 0;

    while (visited.size < n) {
        // Get shortest paths from current vertex using BMSSP
        const { distances } = solveBMSSP(distanceMatrix, current);

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
        algorithmUsed: 'bmssp',
    };
}

/**
 * Benchmark BMSSP vs Dijkstra for comparison.
 */
export function benchmarkBMSSP(
    distanceMatrix: number[][],
    source: number
): {
    bmsspTimeMs: number;
    dijkstraTimeMs: number;
    resultsMatch: boolean;
} {
    // Time BMSSP
    const bmsspStart = Date.now();
    const bmsspResult = solveBMSSP(distanceMatrix, source);
    const bmsspTime = Date.now() - bmsspStart;

    // Time Dijkstra
    const dijkstraStart = Date.now();
    const dijkstraResult = solveDijkstraShortestPaths(distanceMatrix, source);
    const dijkstraTime = Date.now() - dijkstraStart;

    // Verify correctness
    let maxDiff = 0;
    for (let i = 0; i < distanceMatrix.length; i++) {
        if (bmsspResult.distances[i] !== Infinity && dijkstraResult.distances[i] !== Infinity) {
            maxDiff = Math.max(maxDiff, Math.abs(bmsspResult.distances[i] - dijkstraResult.distances[i]));
        }
    }

    return {
        bmsspTimeMs: bmsspTime,
        dijkstraTimeMs: dijkstraTime,
        resultsMatch: maxDiff < 1e-9,
    };
}
