/**
 * API Schema Definitions
 * 
 * TypeScript interfaces for REST API requests and responses.
 * Based on SCALABILITY_AND_INTEGRATION_GUIDE.md specifications.
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface Coordinate {
    lat: number;
    lng: number;
}

export interface Location extends Coordinate {
    id: string;
    name?: string;
    address?: string;
}

export interface EmployeeInput extends Location {
    preferredPickupTime?: string;  // "HH:mm"
    timeWindowStart?: string;      // "HH:mm"
    timeWindowEnd?: string;        // "HH:mm"
}

// ============================================================================
// ROUTE OPTIMIZATION REQUEST/RESPONSE
// ============================================================================

export interface OptimizeRouteRequest {
    origin: Location;
    destinations: EmployeeInput[];
    tripType: 'pickup' | 'drop';
    constraints: {
        departureTime: string;         // "HH:mm"
        maxTotalDuration?: number;     // minutes
        bufferPerStop?: number;        // minutes per stop
    };
    options?: {
        algorithm?: 'nearest_neighbor' | 'christofides' | 'genetic' | 'exhaustive' | 'auto';
        useRealRoads?: boolean;        // Use OSRM/Mapbox
        considerTraffic?: boolean;     // Apply traffic data
        generateAlternatives?: boolean;
        maxAlternatives?: number;
        timeout?: number;              // Max processing time (ms)
    };
}

export interface RouteStopResponse {
    sequence: number;
    location: Location;
    arrivalTime: string;
    departureTime: string;
    distanceFromPrevious: number;
    durationFromPrevious: number;
    cumulativeDistance: number;
    cumulativeDuration: number;
}

export interface OptimizedRouteResponse {
    id: string;
    stops: RouteStopResponse[];
    totalDistance: number;       // km
    totalDuration: number;       // minutes
    estimatedArrival: string;
    geometry?: string;           // Encoded polyline
    optimizationMethod: string;
}

export interface OptimizationMetricsResponse {
    algorithmUsed: string;
    optimizationDuration: number;
    improvementOverNaive: number; // percentage
    efficiencyScore: number;      // 0-100
}

export interface AlternativeRouteResponse {
    route: OptimizedRouteResponse;
    description: string;
    comparisonToMain: {
        distanceDiff: number;
        durationDiff: number;
    };
}

export interface OptimizeRouteResponse {
    success: boolean;
    requestId: string;
    processingTimeMs: number;
    result: {
        route: OptimizedRouteResponse;
        metrics: OptimizationMetricsResponse;
        alternatives?: AlternativeRouteResponse[];
    };
    errors?: string[];
}

// ============================================================================
// MULTI-CLUSTER OPTIMIZATION REQUEST/RESPONSE
// ============================================================================

export interface CabInput {
    id: string;
    name: string;
    capacity: number;
    currentLocation?: Coordinate;
}

export interface MultiClusterRequest {
    office: Location;
    employees: EmployeeInput[];
    cabs: CabInput[];
    config?: {
        maxIterations?: number;
        routeOptimizationAlgorithm?: string;
    };
}

export interface ClusterAssignment {
    cabId: string;
    cabName: string;
    employees: EmployeeInput[];
    route: OptimizedRouteResponse;
}

export interface MultiClusterResponse {
    success: boolean;
    requestId: string;
    processingTimeMs: number;
    result: {
        clusters: ClusterAssignment[];
        totalCabs: number;
        totalEmployees: number;
        metrics: {
            averageLoadFactor: number;
            totalDistance: number;
            totalDuration: number;
        };
    };
    errors?: string[];
}

// ============================================================================
// DISTANCE MATRIX REQUEST/RESPONSE
// ============================================================================

export interface DistanceMatrixRequest {
    coordinates: Coordinate[];
    useRealRoads?: boolean;
}

export interface DistanceMatrixResponse {
    success: boolean;
    requestId: string;
    processingTimeMs: number;
    result: {
        distances: number[][];  // km
        durations: number[][];  // minutes
    };
    errors?: string[];
}

// ============================================================================
// HEALTH CHECK RESPONSE
// ============================================================================

export interface HealthResponse {
    status: 'ok' | 'degraded' | 'unhealthy';
    version: string;
    timestamp: string;
    uptime: number;
    services: {
        optimizer: boolean;
        osrm?: boolean;
        cache?: boolean;
    };
    // Extended monitoring info
    memory?: {
        heapUsed: number;  // MB
        heapTotal: number; // MB
        rss: number;       // MB
    };
    cache?: {
        entries: number;
        maxEntries: number;
    };
}

// ============================================================================
// ALGORITHM INFO
// ============================================================================

export interface AlgorithmInfo {
    id: string;
    name: string;
    description: string;
    timeComplexity: string;
    qualityGuarantee: string;
    maxEfficient: number;  // Max stops for efficient processing
    supportsTimeWindows: boolean;
}

export interface AlgorithmsResponse {
    algorithms: AlgorithmInfo[];
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export interface ErrorResponse {
    success: false;
    error: string;
    message: string;
    requestId?: string;
}
