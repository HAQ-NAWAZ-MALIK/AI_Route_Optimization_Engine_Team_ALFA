/**
 * AI Engine Types
 * Shared TypeScript interfaces for route optimization
 */

// ============================================================================
// COORDINATE & LOCATION TYPES
// ============================================================================


export interface Coordinate {
    lat: number;
    lng: number;
}

export interface Location extends Coordinate {
    id: string;
    name: string;
    address: string;
}

export interface EmployeeLocation extends Location {
    employeeId?: string;           // Optional - falls back to Location.id
    preferredPickupTime?: string; // "HH:mm" format
    timeWindowStart?: string;     // Earliest acceptable pickup
    timeWindowEnd?: string;       // Latest acceptable pickup
    specialInstructions?: string;
}

// ============================================================================
// TIME WINDOW TYPES
// ============================================================================

export interface TimeWindow {
    start: number; // Minutes from midnight
    end: number;   // Minutes from midnight
    preferred?: number; // Preferred time in minutes from midnight
    penalty?: number;   // Penalty for missing window (0-1)
}

export interface TimeConstraints {
    departureTime: string;     // "HH:mm" - when route starts
    maxTotalDuration?: number; // Max total trip time in minutes
    maxWaitTime?: number;      // Max wait at any stop in minutes
    bufferPerStop?: number;    // Time spent at each stop (default 2 min)
}

// ============================================================================
// ROUTE TYPES
// ============================================================================

export interface RouteStop {
    location: EmployeeLocation;
    sequence: number;
    arrivalTime: string;
    departureTime: string;
    waitTime: number;           // Minutes waiting
    distanceFromPrevious: number; // km
    durationFromPrevious: number; // minutes
    cumulativeDistance: number;
    cumulativeDuration: number;
    timeWindowViolation?: number; // Minutes early/late
}

export interface NavigationStep {
    instruction: string;
    distance: number;      // meters
    duration: number;      // seconds
    type: NavigationManeuver;
    modifier?: string;     // 'left', 'right', 'straight', etc.
    name?: string;         // Road/street name
    bearing?: number;      // Direction in degrees
}

export type NavigationManeuver =
    | 'depart'
    | 'arrive'
    | 'turn'
    | 'continue'
    | 'merge'
    | 'roundabout'
    | 'fork'
    | 'end_of_road'
    | 'new_name'
    | 'notification';

export interface OptimizedRoute {
    id: string;
    stops: RouteStop[];
    totalDistance: number;     // km
    totalDuration: number;     // minutes
    estimatedArrival: string;  // Final arrival time

    // Metrics
    efficiencyScore: number;   // 0-100
    savingsPercent: number;    // vs naive approach
    timeWindowScore: number;   // 0-100, penalty for violations

    // Navigation
    geometry?: string;         // Encoded polyline
    turnByTurn?: NavigationStep[];

    // Metadata
    optimizationMethod: OptimizationMethod;
    optimizationDuration: number; // ms
}

export type OptimizationMethod =
    | 'nearest_neighbor'
    | 'two_opt'
    | 'christofides'
    | 'genetic_algorithm'
    | 'dijkstra'
    | 'bmssp'
    | 'hybrid';

export interface AlternativeRoute extends OptimizedRoute {
    description: string;       // e.g., "Fastest", "Shortest", "Avoid highways"
    comparisonToMain: {
        distanceDiff: number;  // km
        durationDiff: number;  // minutes
    };
}

// ============================================================================
// OSRM TYPES
// ============================================================================

export interface OSRMRouteRequest {
    coordinates: Coordinate[];
    alternatives?: boolean;
    steps?: boolean;
    geometries?: 'polyline' | 'polyline6' | 'geojson';
    overview?: 'full' | 'simplified' | 'false';
    annotations?: boolean;
}

export interface OSRMRouteResponse {
    code: 'Ok' | string;
    routes: OSRMRoute[];
    waypoints: OSRMWaypoint[];
}

export interface OSRMRoute {
    distance: number;      // meters
    duration: number;      // seconds
    geometry: string;      // Encoded polyline
    legs: OSRMRouteLeg[];
    weight: number;
    weight_name: string;
}

export interface OSRMRouteLeg {
    distance: number;
    duration: number;
    steps: OSRMRouteStep[];
    summary: string;
}

export interface OSRMRouteStep {
    distance: number;
    duration: number;
    geometry: string;
    name: string;
    mode: string;
    maneuver: {
        type: string;
        modifier?: string;
        bearing_before: number;
        bearing_after: number;
        location: [number, number];
    };
    intersections: OSRMIntersection[];
}

export interface OSRMIntersection {
    location: [number, number];
    bearings: number[];
    entry: boolean[];
    out?: number;
    in?: number;
}

export interface OSRMWaypoint {
    name: string;
    location: [number, number];
    distance: number;
    hint: string;
    waypoint_index?: number; // Only present in trip response
}

export interface OSRMTableResponse {
    code: 'Ok' | string;
    durations: number[][];  // Duration matrix in seconds
    distances?: number[][]; // Distance matrix in meters (if annotations enabled)
    sources: OSRMWaypoint[];
    destinations: OSRMWaypoint[];
}

// ============================================================================
// TRAFFIC TYPES
// ============================================================================

export interface TrafficData {
    timestamp: Date;
    segments: TrafficSegment[];
    incidents?: TrafficIncident[];
}

export interface TrafficSegment {
    start: Coordinate;
    end: Coordinate;
    currentSpeed: number;      // km/h
    freeFlowSpeed: number;     // km/h
    congestionLevel: CongestionLevel;
    delay: number;             // Additional seconds due to traffic
}

export type CongestionLevel = 'free' | 'light' | 'moderate' | 'heavy' | 'severe';

export interface TrafficIncident {
    id: string;
    type: 'accident' | 'construction' | 'road_closure' | 'event' | 'weather';
    location: Coordinate;
    severity: 1 | 2 | 3 | 4 | 5;
    description: string;
    expectedDelay: number;     // Additional minutes
    startTime?: Date;
    endTime?: Date;
}

// ============================================================================
// GENETIC ALGORITHM TYPES
// ============================================================================

export interface GeneticAlgorithmConfig {
    populationSize: number;
    generations: number;
    crossoverRate: number;
    mutationRate: number;
    elitismCount: number;
    tournamentSize: number;
    maxStagnation?: number;    // Stop if no improvement for N generations
}

export interface Individual {
    chromosome: number[];      // Route order as indices
    fitness: number;
    distance: number;
    duration: number;
    timeWindowPenalty: number;
}



export interface Population {
    individuals: Individual[];
    generation: number;
    bestFitness: number;
    averageFitness: number;
}

// ============================================================================
// OPTIMIZATION INPUT/OUTPUT
// ============================================================================

export interface RouteOptimizationInput {
    origin: Location;                // Starting point (office/depot)
    destinations: EmployeeLocation[];
    tripType: 'pickup' | 'drop';
    constraints: TimeConstraints;
    options?: OptimizationOptions;
}

export interface OptimizationOptions {
    useOSRM?: boolean;              // Use real road routing
    useTraffic?: boolean;           // Consider traffic data
    generateAlternatives?: boolean; // Generate alternative routes
    maxAlternatives?: number;
    method?: OptimizationMethod;    // Force specific algorithm
    timeout?: number;               // Max optimization time in ms
}

export interface RouteOptimizationOutput {
    primaryRoute: OptimizedRoute;
    alternativeRoutes?: AlternativeRoute[];
    metrics: OptimizationMetrics;
}

export interface OptimizationMetrics {
    inputSize: number;
    optimizationDuration: number;   // ms
    methodUsed: OptimizationMethod;
    osrmUsed: boolean;
    trafficConsidered: boolean;
    improvementOverNaive: number;   // Percentage
}
