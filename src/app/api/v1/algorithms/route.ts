/**
 * Algorithms API Endpoint
 * 
 * GET /api/v1/algorithms
 * Returns list of available optimization algorithms with metadata.
 */

import { NextResponse } from 'next/server';
import type { AlgorithmInfo, AlgorithmsResponse } from '@/lib/api/api-schemas';

const ALGORITHMS: AlgorithmInfo[] = [
    {
        id: 'auto',
        name: 'Automatic Selection',
        description: 'Automatically selects the best algorithm based on problem size and complexity.',
        timeComplexity: 'Varies',
        qualityGuarantee: 'Best available',
        maxEfficient: 10000,
        supportsTimeWindows: true,
    },
    {
        id: 'exhaustive',
        name: 'Exhaustive Search',
        description: 'Evaluates all possible permutations to find the globally optimal solution. Only suitable for small datasets.',
        timeComplexity: 'O(n!)',
        qualityGuarantee: 'Optimal (100%)',
        maxEfficient: 8,
        supportsTimeWindows: true,
    },
    {
        id: 'christofides',
        name: 'Christofides Algorithm',
        description: 'Classic TSP approximation algorithm with guaranteed 1.5x optimal performance. Great balance of speed and quality.',
        timeComplexity: 'O(n³)',
        qualityGuarantee: '1.5x optimal',
        maxEfficient: 100,
        supportsTimeWindows: false,
    },
    {
        id: 'genetic',
        name: 'Genetic Algorithm',
        description: 'Evolutionary optimization using mutation, crossover, and selection. Excellent for complex routes with time windows.',
        timeComplexity: 'O(g × n²)',
        qualityGuarantee: 'Near-optimal',
        maxEfficient: 500,
        supportsTimeWindows: true,
    },
    {
        id: 'nearest_neighbor',
        name: 'Nearest Neighbor',
        description: 'Fast greedy heuristic that picks the closest unvisited location. Best for real-time applications with many stops.',
        timeComplexity: 'O(n²)',
        qualityGuarantee: '~25% worse than optimal',
        maxEfficient: 10000,
        supportsTimeWindows: false,
    },
];

export async function GET(): Promise<NextResponse<AlgorithmsResponse>> {
    return NextResponse.json({
        algorithms: ALGORITHMS,
    });
}
