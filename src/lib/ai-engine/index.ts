/**
 * AI Engine - Route Optimization
 * 
 * Production-grade route optimization for Routify
 * 
 * Features:
 * - TSP Christofides algorithm (1.5x optimal guarantee)
 * - Genetic Algorithm for complex routes
 * - OSRM integration for real road network
 * - Traffic-aware travel times (via TomTom API)
 * - Time window constraints
 * - Turn-by-turn navigation
 * - Alternative routes generation
 */

// Main optimizer
export { optimizeRoute } from './enhanced-route-optimizer';
export type {
    RouteOptimizationInput,
    RouteOptimizationOutput,
    OptimizedRoute,
    OptimizationMetrics,
} from './enhanced-route-optimizer';

// Auto Optimizer (parallel algorithm comparison)
export { optimizeRouteAuto } from './auto-optimizer';
export type {
    AlgorithmResult,
    AutoOptimizeResult,
} from './auto-optimizer';

// Types
export type {
    Coordinate,
    Location,
    EmployeeLocation,
    TimeWindow,
    TimeConstraints,
    RouteStop,
    NavigationStep,
    AlternativeRoute,
    OptimizationMethod,
    OptimizationOptions,
    TrafficData,
    TrafficSegment,
    TrafficIncident,
    CongestionLevel,
    GeneticAlgorithmConfig,
} from './types';

// TSP Christofides
export {
    solveTSPChristofides,
    improve2Opt,
    calculateTourDistance,
    buildDistanceMatrixFromCoordinates,
    haversineDistance,
} from './tsp-christofides';

// Genetic Algorithm
export {
    optimizeWithGeneticAlgorithm,
    getEvolutionStats,
} from './genetic-algorithm';

// OSRM Client
export {
    getRoute,
    getDistanceMatrix,
    getOptimizedTrip,
    getNearestPoint,
    extractNavigationSteps,
    decodePolyline,
    encodePolyline,
    checkOSRMHealth,
} from './osrm-client';

// Time Window Solver
export {
    parseTimeToMinutes,
    formatMinutesToTime,
    addMinutesToTime,
    generateTimeWindows,
    validateTimeWindows,
    calculateTimeWindowPenalty,
    calculateTimeWindowScore,
    calculateRouteTiming,
    sortByTimeWindows,
} from './time-window-solver';

// Traffic Integration
export {
    isTrafficApiAvailable,
    getTrafficFlow,
    getRouteTrafficData,
    getTrafficIncidents,
    adjustTravelTime,
    applyDefaultTrafficAdjustment,
} from './traffic-integration';

// Exhaustive Route Testing
export {
    testAllRoutes,
    estimateExhaustiveTime,
    analyzeRouteSegments,
    calculateRouteStats,
    factorial,
    generatePermutations,
} from './exhaustive-testing';

export type {
    TestedRoute,
    ExhaustiveResult,
    RouteSegment,
    RouteStats,
} from './exhaustive-testing';

// Dijkstra Algorithm
export {
    solveDijkstraShortestPaths,
    optimizeWithDijkstra,
    findShortestPath,
    optimizeWithDijkstraDistanceOrder,
} from './dijkstra';

export type {
    DijkstraResult,
    DijkstraTSPResult,
} from './dijkstra';

// BMSSP Algorithm (Breaking the Sorting Barrier)
export {
    solveBMSSP,
    optimizeWithBMSSP,
    benchmarkBMSSP,
} from './bmssp';

export type {
    BMSSPOptions,
    BMSSPResult,
    BMSSPTSPResult,
} from './bmssp';

// Cab Distribution
export {
    distributeToVehicles,
    optimizeUtilization,
    validateDistribution,
    calculateAdditionalVehiclesNeeded,
    estimateRouteDuration,
} from './cab-distribution';

export type {
    Vehicle,
    Driver,
    RouteGroup,
    VehicleAssignment,
    DistributionInput,
    DistributionOptions,
    DistributionResult,
    DistributionMetrics,
    OverflowInfo,
    ValidationResult,
} from './cab-distribution';

// Distribution Analyzer
export {
    analyzeDistribution,
    applyManualOverrides,
    validateManualConfiguration,
    getAISuggestionForManual,
    getDefaultFeatures,
    calculateWeightsFromFeatures,
    FEATURE_DEFINITIONS,
} from './distribution-analyzer';

export type {
    AnalyzerInput,
    AnalysisResult,
    DistributionStrategy,
    CompositeScore,
    ConstraintStatus,
    Constraint,
    Warning,
    CriticalIssue,
    Suggestion,
    SuggestionType,
    ManualOverride,
    DistributionPreferences,
    DistributionMode,
    SuggestionPriority,
    ConstraintType,
    FeatureConfig,
    FeatureDefinition,
    FeaturePriority,
} from './distribution-analyzer';
