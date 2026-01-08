/**
 * TSP Christofides Algorithm
 * 
 * Implements the Christofides algorithm for solving the Traveling Salesman Problem.
 * This algorithm guarantees a solution within 1.5x of optimal for metric TSP.
 * 
 * Steps:
 * 1. Build Minimum Spanning Tree (MST) using Prim's algorithm
 * 2. Find vertices with odd degree in MST
 * 3. Find minimum-weight perfect matching on odd-degree vertices
 * 4. Combine MST edges + matching edges (creates multigraph)
 * 5. Find Eulerian circuit in the multigraph
 * 6. Convert to Hamiltonian path by skipping visited vertices
 */

import type { Coordinate } from './types';

// ============================================================================
// CHRISTOFIDES MAIN ALGORITHM
// ============================================================================

/**
 * Solve TSP using Christofides algorithm
 * @param distanceMatrix - NxN matrix of distances between all pairs
 * @param startIndex - Index of the starting node (default 0)
 * @returns Ordered indices representing the optimal tour
 */
export function solveTSPChristofides(
    distanceMatrix: number[][],
    startIndex: number = 0
): number[] {
    const n = distanceMatrix.length;

    if (n <= 2) {
        return Array.from({ length: n }, (_, i) => i);
    }

    if (n <= 3) {
        // For 3 or fewer nodes, just return them in order
        const tour = Array.from({ length: n }, (_, i) => i);
        // Ensure start index is first
        const startPos = tour.indexOf(startIndex);
        return [...tour.slice(startPos), ...tour.slice(0, startPos)];
    }

    // Step 1: Build Minimum Spanning Tree
    const mstEdges = buildMST(distanceMatrix);

    // Step 2: Find odd-degree vertices
    const oddVertices = findOddDegreeVertices(mstEdges, n);

    // Step 3: Find minimum-weight perfect matching on odd vertices
    const matchingEdges = findMinWeightMatching(oddVertices, distanceMatrix);

    // Step 4: Combine MST + matching to create multigraph
    const multigraph = combineGraphs(mstEdges, matchingEdges, n);

    // Step 5: Find Eulerian circuit
    const eulerianCircuit = findEulerianCircuit(multigraph, startIndex);

    // Step 6: Convert to Hamiltonian path (skip repeated vertices)
    const hamiltonianPath = createHamiltonianPath(eulerianCircuit, startIndex);

    return hamiltonianPath;
}

// ============================================================================
// STEP 1: MINIMUM SPANNING TREE (PRIM'S ALGORITHM)
// ============================================================================

interface Edge {
    from: number;
    to: number;
    weight: number;
}

function buildMST(distanceMatrix: number[][]): Edge[] {
    const n = distanceMatrix.length;
    const inMST = new Array(n).fill(false);
    const edges: Edge[] = [];
    const minEdge = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);

    minEdge[0] = 0;

    for (let i = 0; i < n; i++) {
        // Find minimum edge to add to MST
        let minWeight = Infinity;
        let u = -1;

        for (let v = 0; v < n; v++) {
            if (!inMST[v] && minEdge[v] < minWeight) {
                minWeight = minEdge[v];
                u = v;
            }
        }

        if (u === -1) break;

        inMST[u] = true;

        // Add edge to MST (except for the first vertex)
        if (parent[u] !== -1) {
            edges.push({
                from: parent[u],
                to: u,
                weight: distanceMatrix[parent[u]][u],
            });
        }

        // Update minimum edges for adjacent vertices
        for (let v = 0; v < n; v++) {
            if (!inMST[v] && distanceMatrix[u][v] < minEdge[v]) {
                minEdge[v] = distanceMatrix[u][v];
                parent[v] = u;
            }
        }
    }

    return edges;
}

// ============================================================================
// STEP 2: FIND ODD DEGREE VERTICES
// ============================================================================

function findOddDegreeVertices(edges: Edge[], n: number): number[] {
    const degree = new Array(n).fill(0);

    for (const edge of edges) {
        degree[edge.from]++;
        degree[edge.to]++;
    }

    const oddVertices: number[] = [];
    for (let i = 0; i < n; i++) {
        if (degree[i] % 2 === 1) {
            oddVertices.push(i);
        }
    }

    return oddVertices;
}

// ============================================================================
// STEP 3: MINIMUM WEIGHT PERFECT MATCHING (GREEDY APPROXIMATION)
// ============================================================================

/**
 * Find minimum weight perfect matching on odd-degree vertices
 * Uses a greedy approximation for simplicity (O(n²) instead of O(n³) Blossom)
 */
function findMinWeightMatching(
    oddVertices: number[],
    distanceMatrix: number[][]
): Edge[] {
    if (oddVertices.length === 0) return [];
    if (oddVertices.length % 2 !== 0) {
        throw new Error('Number of odd vertices must be even');
    }

    // Create all possible edges between odd vertices
    const edges: Edge[] = [];
    for (let i = 0; i < oddVertices.length; i++) {
        for (let j = i + 1; j < oddVertices.length; j++) {
            edges.push({
                from: oddVertices[i],
                to: oddVertices[j],
                weight: distanceMatrix[oddVertices[i]][oddVertices[j]],
            });
        }
    }

    // Sort edges by weight
    edges.sort((a, b) => a.weight - b.weight);

    // Greedy matching
    const matched = new Set<number>();
    const matchingEdges: Edge[] = [];

    for (const edge of edges) {
        if (!matched.has(edge.from) && !matched.has(edge.to)) {
            matchingEdges.push(edge);
            matched.add(edge.from);
            matched.add(edge.to);
        }

        if (matched.size === oddVertices.length) break;
    }

    return matchingEdges;
}

// ============================================================================
// STEP 4: COMBINE GRAPHS
// ============================================================================

function combineGraphs(
    mstEdges: Edge[],
    matchingEdges: Edge[],
    n: number
): Map<number, number[]> {
    const adjacency = new Map<number, number[]>();

    // Initialize all vertices
    for (let i = 0; i < n; i++) {
        adjacency.set(i, []);
    }

    // Add MST edges (undirected)
    for (const edge of mstEdges) {
        adjacency.get(edge.from)!.push(edge.to);
        adjacency.get(edge.to)!.push(edge.from);
    }

    // Add matching edges (undirected)
    for (const edge of matchingEdges) {
        adjacency.get(edge.from)!.push(edge.to);
        adjacency.get(edge.to)!.push(edge.from);
    }

    return adjacency;
}

// ============================================================================
// STEP 5: EULERIAN CIRCUIT (HIERHOLZER'S ALGORITHM)
// ============================================================================

function findEulerianCircuit(
    graph: Map<number, number[]>,
    startVertex: number
): number[] {
    // Create a copy of the adjacency list (we'll modify it)
    const adjCopy = new Map<number, number[]>();
    for (const [vertex, neighbors] of graph) {
        adjCopy.set(vertex, [...neighbors]);
    }

    const circuit: number[] = [];
    const stack: number[] = [startVertex];

    while (stack.length > 0) {
        const v = stack[stack.length - 1];
        const neighbors = adjCopy.get(v)!;

        if (neighbors.length > 0) {
            // Get next neighbor
            const u = neighbors.pop()!;

            // Remove the edge from u to v (undirected graph)
            const uNeighbors = adjCopy.get(u)!;
            const idx = uNeighbors.indexOf(v);
            if (idx !== -1) {
                uNeighbors.splice(idx, 1);
            }

            stack.push(u);
        } else {
            circuit.push(stack.pop()!);
        }
    }

    return circuit.reverse();
}

// ============================================================================
// STEP 6: HAMILTONIAN PATH FROM EULERIAN CIRCUIT
// ============================================================================

function createHamiltonianPath(
    eulerianCircuit: number[],
    startVertex: number
): number[] {
    const visited = new Set<number>();
    const hamiltonianPath: number[] = [];

    // Ensure we start from the correct vertex
    let startIdx = eulerianCircuit.indexOf(startVertex);
    if (startIdx === -1) startIdx = 0;

    // Traverse circuit, skipping visited vertices
    for (let i = 0; i < eulerianCircuit.length; i++) {
        const idx = (startIdx + i) % eulerianCircuit.length;
        const vertex = eulerianCircuit[idx];

        if (!visited.has(vertex)) {
            visited.add(vertex);
            hamiltonianPath.push(vertex);
        }
    }

    return hamiltonianPath;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate total tour distance
 */
export function calculateTourDistance(
    tour: number[],
    distanceMatrix: number[][],
    returnToStart: boolean = true
): number {
    if (tour.length <= 1) return 0;

    let total = 0;
    for (let i = 0; i < tour.length - 1; i++) {
        total += distanceMatrix[tour[i]][tour[i + 1]];
    }

    if (returnToStart && tour.length > 1) {
        total += distanceMatrix[tour[tour.length - 1]][tour[0]];
    }

    return total;
}

/**
 * Build distance matrix from coordinates using Haversine formula
 */
export function buildDistanceMatrixFromCoordinates(
    coordinates: Coordinate[]
): number[][] {
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

/**
 * Haversine distance between two points in kilometers
 */
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Apply 2-opt improvement to Christofides solution
 * This can further improve the tour quality
 */
export function improve2Opt(
    tour: number[],
    distanceMatrix: number[][],
    maxIterations: number = 100
): number[] {
    let improved = true;
    let iterations = 0;
    let bestTour = [...tour];

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < bestTour.length - 1; i++) {
            for (let j = i + 2; j < bestTour.length; j++) {
                const delta = calculate2OptDelta(bestTour, i, j, distanceMatrix);

                if (delta < -0.001) {
                    // Reverse segment between i+1 and j
                    bestTour = [
                        ...bestTour.slice(0, i + 1),
                        ...bestTour.slice(i + 1, j + 1).reverse(),
                        ...bestTour.slice(j + 1),
                    ];
                    improved = true;
                }
            }
        }
    }

    return bestTour;
}

function calculate2OptDelta(
    tour: number[],
    i: number,
    j: number,
    distanceMatrix: number[][]
): number {
    const n = tour.length;
    const a = tour[i];
    const b = tour[i + 1];
    const c = tour[j];
    const d = tour[(j + 1) % n];

    const oldDist = distanceMatrix[a][b] + distanceMatrix[c][d];
    const newDist = distanceMatrix[a][c] + distanceMatrix[b][d];

    return newDist - oldDist;
}
