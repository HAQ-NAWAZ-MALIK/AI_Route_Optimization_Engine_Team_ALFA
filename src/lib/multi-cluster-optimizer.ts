/**
 * Multi-Cluster Optimizer
 * 
 * Handles:
 * 1. Employee clustering based on geography and cab capacity
 * 2. Cab-to-cluster assignment using cost optimization
 * 3. Overflow handling when employees exceed total capacity
 */

import type { Employee, Cab, Config } from './csv-parser';
import type { Coordinate } from './ai-engine';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate haversine distance between two coordinates (in km)
 */
function getDistance(a: Coordinate, b: Coordinate): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const calc = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// ============================================================================
// TYPES
// ============================================================================

export interface Cluster {
    id: string;
    employees: Employee[];
    centroid: Coordinate;
    totalCapacity: number;
}

export interface CabAssignment {
    cab: Cab;
    cluster: Cluster;
    distance: number; // Distance from cab start to cluster centroid
}

export interface ClusterResult {
    assignments: CabAssignment[];
    unassignedEmployees: Employee[];
    unassignedCabs: Cab[];
    warnings: string[];
}

// ============================================================================
// CLUSTERING ALGORITHM
// ============================================================================

/**
 * Cluster employees geographically while respecting total cab capacity
 */
export function clusterEmployees(
    employees: Employee[],
    cabs: Cab[],
    config: Config
): { clusters: Cluster[]; overflow: Employee[] } {
    if (employees.length === 0) {
        return { clusters: [], overflow: [] };
    }

    if (cabs.length === 0) {
        return { clusters: [], overflow: employees };
    }

    const totalCapacity = cabs.reduce((sum, cab) => sum + cab.seats, 0);
    const targetClusters = cabs.length;

    // If more employees than capacity, we'll handle overflow later
    let employeesToCluster = [...employees];
    let overflow: Employee[] = [];

    if (employees.length > totalCapacity) {
        // Sort by distance from office, prioritize closest
        employeesToCluster = [...employees].sort((a, b) => {
            const distA = getDistance({ lat: a.lat, lng: a.lng }, { lat: config.officeLat, lng: config.officeLng });
            const distB = getDistance({ lat: b.lat, lng: b.lng }, { lat: config.officeLat, lng: config.officeLng });
            return distA - distB;
        });
        overflow = employeesToCluster.slice(totalCapacity);
        employeesToCluster = employeesToCluster.slice(0, totalCapacity);
    }

    // Use K-means style clustering
    const clusters = kMeansCluster(employeesToCluster, targetClusters, cabs);

    return { clusters, overflow };
}

/**
 * K-means clustering with capacity awareness
 */
function kMeansCluster(employees: Employee[], k: number, cabs: Cab[]): Cluster[] {
    if (employees.length === 0 || k === 0) return [];

    // Actual number of clusters (can't have more clusters than employees)
    const numClusters = Math.min(k, employees.length);

    // Initialize centroids using K-means++ style (spread out initial points)
    const centroids: Coordinate[] = [];

    // First centroid: random employee
    const firstIdx = Math.floor(Math.random() * employees.length);
    centroids.push({ lat: employees[firstIdx].lat, lng: employees[firstIdx].lng });

    // Subsequent centroids: choose points far from existing centroids
    while (centroids.length < numClusters) {
        let maxDist = -1;
        let bestIdx = 0;

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const minDistToCentroid = Math.min(...centroids.map(c =>
                getDistance({ lat: emp.lat, lng: emp.lng }, c)
            ));
            if (minDistToCentroid > maxDist) {
                maxDist = minDistToCentroid;
                bestIdx = i;
            }
        }
        centroids.push({ lat: employees[bestIdx].lat, lng: employees[bestIdx].lng });
    }

    // Run K-means iterations
    const maxIterations = 20;
    let assignments: number[] = new Array(employees.length).fill(-1);

    for (let iter = 0; iter < maxIterations; iter++) {
        // Assign each employee to nearest centroid
        const newAssignments: number[] = employees.map(emp => {
            let minDist = Infinity;
            let bestCluster = 0;
            for (let c = 0; c < centroids.length; c++) {
                const dist = getDistance({ lat: emp.lat, lng: emp.lng }, centroids[c]);
                if (dist < minDist) {
                    minDist = dist;
                    bestCluster = c;
                }
            }
            return bestCluster;
        });

        // Check for convergence
        const converged = newAssignments.every((a, i) => a === assignments[i]);
        assignments = newAssignments;

        if (converged) break;

        // Update centroids
        for (let c = 0; c < centroids.length; c++) {
            const clusterEmps = employees.filter((_, i) => assignments[i] === c);
            if (clusterEmps.length > 0) {
                centroids[c] = {
                    lat: clusterEmps.reduce((s, e) => s + e.lat, 0) / clusterEmps.length,
                    lng: clusterEmps.reduce((s, e) => s + e.lng, 0) / clusterEmps.length,
                };
            }
        }
    }

    // Build cluster objects
    const clusters: Cluster[] = [];
    for (let c = 0; c < numClusters; c++) {
        const clusterEmps = employees.filter((_, i) => assignments[i] === c);
        if (clusterEmps.length > 0) {
            clusters.push({
                id: `cluster-${c + 1}`,
                employees: clusterEmps,
                centroid: centroids[c],
                totalCapacity: 0, // Will be set during assignment
            });
        }
    }

    // Balance clusters to match cab capacities (greedy approach)
    return balanceClusters(clusters, cabs);
}

/**
 * Balance clusters so each cluster size ≤ corresponding cab capacity
 */
function balanceClusters(clusters: Cluster[], cabs: Cab[]): Cluster[] {
    if (clusters.length === 0) return [];

    // Sort cabs by capacity (largest first) and clusters by size (largest first)
    const sortedCabs = [...cabs].sort((a, b) => b.seats - a.seats);
    const sortedClusters = [...clusters].sort((a, b) => b.employees.length - a.employees.length);

    // Simple greedy assignment: largest cluster gets largest cab
    sortedClusters.forEach((cluster, i) => {
        if (i < sortedCabs.length) {
            cluster.totalCapacity = sortedCabs[i].seats;
        }
    });

    // If any cluster exceeds its capacity, redistribute
    for (let i = 0; i < sortedClusters.length; i++) {
        const cluster = sortedClusters[i];
        while (cluster.employees.length > cluster.totalCapacity && cluster.totalCapacity > 0) {
            // Find the employee furthest from centroid
            let maxDist = -1;
            let furthestIdx = 0;
            for (let j = 0; j < cluster.employees.length; j++) {
                const emp = cluster.employees[j];
                const dist = getDistance({ lat: emp.lat, lng: emp.lng }, cluster.centroid);
                if (dist > maxDist) {
                    maxDist = dist;
                    furthestIdx = j;
                }
            }

            // Move to nearest cluster with capacity
            const movingEmp = cluster.employees[furthestIdx];
            let bestCluster: Cluster | null = null;
            let bestDist = Infinity;

            for (let j = 0; j < sortedClusters.length; j++) {
                if (j === i) continue;
                const other = sortedClusters[j];
                if (other.employees.length < other.totalCapacity) {
                    const dist = getDistance(
                        { lat: movingEmp.lat, lng: movingEmp.lng },
                        other.centroid
                    );
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestCluster = other;
                    }
                }
            }

            if (bestCluster) {
                cluster.employees.splice(furthestIdx, 1);
                bestCluster.employees.push(movingEmp);
                // Recalculate centroids
                cluster.centroid = calculateCentroid(cluster.employees);
                bestCluster.centroid = calculateCentroid(bestCluster.employees);
            } else {
                break; // No capacity left anywhere
            }
        }
    }

    return sortedClusters.filter(c => c.employees.length > 0);
}

function calculateCentroid(employees: Employee[]): Coordinate {
    if (employees.length === 0) return { lat: 0, lng: 0 };
    return {
        lat: employees.reduce((s, e) => s + e.lat, 0) / employees.length,
        lng: employees.reduce((s, e) => s + e.lng, 0) / employees.length,
    };
}

// ============================================================================
// CAB ASSIGNMENT (Hungarian-style greedy)
// ============================================================================

/**
 * Assign cabs to clusters to minimize total travel distance
 */
export function assignCabsToClusters(
    clusters: Cluster[],
    cabs: Cab[],
    config: Config
): ClusterResult {
    const warnings: string[] = [];

    if (clusters.length === 0) {
        return {
            assignments: [],
            unassignedEmployees: [],
            unassignedCabs: cabs,
            warnings: ['No clusters to assign'],
        };
    }

    // Build cost matrix: cost[cabIdx][clusterIdx] = distance
    const costMatrix: number[][] = cabs.map(cab =>
        clusters.map(cluster => {
            const cabStart: Coordinate = { lat: cab.lat, lng: cab.lng };
            const dist = getDistance(cabStart, cluster.centroid);

            // Add penalty if cab capacity < cluster size
            const capacityPenalty = cluster.employees.length > cab.seats ? 1000 : 0;

            return dist + capacityPenalty;
        })
    );

    // Greedy assignment (for simplicity - could use Hungarian for optimal)
    const usedCabs = new Set<number>();
    const usedClusters = new Set<number>();
    const assignments: CabAssignment[] = [];

    // Sort assignments by cost
    const allPairs: { cabIdx: number; clusterIdx: number; cost: number }[] = [];
    for (let i = 0; i < cabs.length; i++) {
        for (let j = 0; j < clusters.length; j++) {
            allPairs.push({ cabIdx: i, clusterIdx: j, cost: costMatrix[i][j] });
        }
    }
    allPairs.sort((a, b) => a.cost - b.cost);

    // Assign greedily
    for (const pair of allPairs) {
        if (usedCabs.has(pair.cabIdx) || usedClusters.has(pair.clusterIdx)) continue;

        const cab = cabs[pair.cabIdx];
        const cluster = clusters[pair.clusterIdx];

        // Check capacity
        if (cluster.employees.length > cab.seats) {
            warnings.push(`Cab ${cab.name} (${cab.seats} seats) assigned to cluster with ${cluster.employees.length} employees`);
        }

        assignments.push({
            cab,
            cluster,
            distance: pair.cost < 1000 ? pair.cost : pair.cost - 1000, // Remove penalty from display
        });

        usedCabs.add(pair.cabIdx);
        usedClusters.add(pair.clusterIdx);
    }

    // Find unassigned
    const unassignedCabs = cabs.filter((_, i) => !usedCabs.has(i));
    const unassignedEmployees = clusters
        .filter((_, i) => !usedClusters.has(i))
        .flatMap(c => c.employees);

    return { assignments, unassignedEmployees, unassignedCabs, warnings };
}

// ============================================================================
// MAIN OPTIMIZATION FUNCTION
// ============================================================================

/**
 * Run full multi-cluster optimization
 */
export function optimizeMultiCluster(
    employees: Employee[],
    cabs: Cab[],
    config: Config
): ClusterResult {
    // Step 1: Cluster employees
    const { clusters, overflow } = clusterEmployees(employees, cabs, config);

    // Step 2: Assign cabs to clusters
    const result = assignCabsToClusters(clusters, cabs, config);

    // Add overflow to unassigned
    result.unassignedEmployees.push(...overflow);

    if (overflow.length > 0) {
        result.warnings.push(`${overflow.length} employees exceed total cab capacity and are unassigned`);
    }

    return result;
}
