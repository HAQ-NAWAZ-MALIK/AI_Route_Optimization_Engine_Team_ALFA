/**
 * Distribution Analyzer - Intelligent Cab Assignment
 * 
 * Features:
 * - Hard constraints (must satisfy) vs Soft constraints (optimize)
 * - Multi-strategy generation and holistic evaluation
 * - Conflict resolution with priority hierarchy
 * - Robustness scoring to avoid fragile assignments
 * - Actionable suggestions for critical cases
 * - AI Auto mode (default) + Manual mode
 */

import type { EmployeeLocation } from './types';
import type { Vehicle, Driver, RouteGroup, VehicleAssignment } from './cab-distribution';
import { distributeToVehicles } from './cab-distribution';

// ============================================================================
// TYPES
// ============================================================================

export type ConstraintType = 'hard' | 'soft';
export type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low';
export type DistributionMode = 'auto' | 'manual';
export type FeaturePriority = 'mandatory' | 'high' | 'medium' | 'low';

// ============================================================================
// FEATURE CONFIGURATION
// ============================================================================

export interface FeatureConfig {
    // MANDATORY - Always ON, cannot be disabled
    // These are enforced automatically, no toggle needed

    // HIGH PRIORITY - ON by default, can be disabled
    seatUtilization: boolean;       // Optimize seat fill rate
    driverAvailability: boolean;    // Check if drivers are available
    vehicleAvailability: boolean;   // Only use available vehicles

    // MEDIUM PRIORITY - ON by default, can be disabled  
    driverShiftCheck: boolean;      // Check departure time vs driver shift
    driverVehicleMatch: boolean;    // Match driver license to vehicle type
    routeEfficiency: boolean;       // Consider route distance/time

    // LOW PRIORITY - Optional, OFF by default in custom mode
    balanceDistribution: boolean;   // Even distribution across vehicles
    robustnessScoring: boolean;     // Prefer assignments with backup options
    fuelEfficiency: boolean;        // Prefer fuel-efficient vehicles
    preferSmallerVehicles: boolean; // Use smallest vehicle that fits
}

export interface FeatureDefinition {
    id: keyof FeatureConfig;
    name: string;
    description: string;
    priority: FeaturePriority;
    defaultEnabled: boolean;
    aiRecommended: boolean;
    weight: number;  // Scoring weight when enabled (0-1)
}

// All features with their definitions
export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
    // HIGH PRIORITY
    {
        id: 'seatUtilization',
        name: 'Seat Utilization',
        description: 'Optimize vehicle seat fill rate (aim for 70-90%)',
        priority: 'high',
        defaultEnabled: true,
        aiRecommended: true,
        weight: 0.25,
    },
    {
        id: 'driverAvailability',
        name: 'Driver Availability',
        description: 'Only assign available drivers',
        priority: 'high',
        defaultEnabled: true,
        aiRecommended: true,
        weight: 0.20,
    },
    {
        id: 'vehicleAvailability',
        name: 'Vehicle Availability',
        description: 'Only use vehicles marked as available',
        priority: 'high',
        defaultEnabled: true,
        aiRecommended: true,
        weight: 0.20,
    },

    // MEDIUM PRIORITY
    {
        id: 'driverShiftCheck',
        name: 'Driver Shift Check',
        description: 'Match departure time with driver shift hours',
        priority: 'medium',
        defaultEnabled: true,
        aiRecommended: true,
        weight: 0.15,
    },
    {
        id: 'driverVehicleMatch',
        name: 'Driver-Vehicle Matching',
        description: 'Match driver license to vehicle type (sedan, van, etc.)',
        priority: 'medium',
        defaultEnabled: true,
        aiRecommended: true,
        weight: 0.10,
    },
    {
        id: 'routeEfficiency',
        name: 'Route Efficiency',
        description: 'Consider route distance and travel time',
        priority: 'medium',
        defaultEnabled: true,
        aiRecommended: true,
        weight: 0.10,
    },

    // LOW PRIORITY
    {
        id: 'balanceDistribution',
        name: 'Balance Distribution',
        description: 'Distribute employees evenly across vehicles',
        priority: 'low',
        defaultEnabled: false,
        aiRecommended: true,
        weight: 0.05,
    },
    {
        id: 'robustnessScoring',
        name: 'Robustness Scoring',
        description: 'Prefer assignments with backup vehicle options',
        priority: 'low',
        defaultEnabled: false,
        aiRecommended: true,
        weight: 0.05,
    },
    {
        id: 'fuelEfficiency',
        name: 'Fuel Efficiency',
        description: 'Prefer vehicles with better fuel economy',
        priority: 'low',
        defaultEnabled: false,
        aiRecommended: false,
        weight: 0.03,
    },
    {
        id: 'preferSmallerVehicles',
        name: 'Prefer Smaller Vehicles',
        description: 'Use smallest vehicle that fits the group',
        priority: 'low',
        defaultEnabled: false,
        aiRecommended: false,
        weight: 0.02,
    },
];

/**
 * Get default feature config for AI Auto mode (all AI-recommended ON)
 */
export function getDefaultFeatures(mode: DistributionMode = 'auto'): FeatureConfig {
    if (mode === 'auto') {
        // AI Auto: All AI-recommended features enabled
        return {
            seatUtilization: true,
            driverAvailability: true,
            vehicleAvailability: true,
            driverShiftCheck: true,
            driverVehicleMatch: true,
            routeEfficiency: true,
            balanceDistribution: true,
            robustnessScoring: true,
            fuelEfficiency: false,
            preferSmallerVehicles: false,
        };
    } else {
        // Manual/Custom: Only high priority by default
        return {
            seatUtilization: true,
            driverAvailability: true,
            vehicleAvailability: true,
            driverShiftCheck: false,
            driverVehicleMatch: false,
            routeEfficiency: false,
            balanceDistribution: false,
            robustnessScoring: false,
            fuelEfficiency: false,
            preferSmallerVehicles: false,
        };
    }
}

/**
 * Calculate scoring weights based on enabled features
 */
export function calculateWeightsFromFeatures(features: FeatureConfig): Record<string, number> {
    const enabledFeatures = FEATURE_DEFINITIONS.filter(f => features[f.id]);
    const totalWeight = enabledFeatures.reduce((sum, f) => sum + f.weight, 0);

    // Normalize weights to sum to 1
    const weights: Record<string, number> = {};
    FEATURE_DEFINITIONS.forEach(f => {
        if (features[f.id]) {
            weights[f.id] = f.weight / totalWeight;
        } else {
            weights[f.id] = 0;
        }
    });

    return weights;
}

// ============================================================================
// ANALYZER INPUT
// ============================================================================

export interface AnalyzerInput {
    routes: RouteGroup[];
    vehicles: Vehicle[];
    drivers: Driver[];
    departureTime: string;
    mode: DistributionMode;
    features?: FeatureConfig;  // NEW: Feature configuration
    preferences?: DistributionPreferences;
}

export interface DistributionPreferences {
    prioritizeUtilization?: boolean;     // Fill vehicles fully
    prioritizeDriverMatch?: boolean;     // Perfect driver-vehicle match
    allowShiftOvertime?: boolean;        // Allow 1hr overtime
    minimizeVehicles?: boolean;          // Use fewer vehicles
    preferSmallerVehicles?: boolean;     // Save fuel
    maxWaitTimeMinutes?: number;         // Max wait for employees
}

export interface AnalysisResult {
    mode: DistributionMode;
    status: 'optimal' | 'feasible' | 'degraded' | 'infeasible';
    recommended: DistributionStrategy | null;
    alternatives: DistributionStrategy[];
    constraintStatus: ConstraintStatus;
    warnings: Warning[];
    criticalIssues: CriticalIssue[];
    suggestions: Suggestion[];
    canProceed: boolean;
    confidence: number;  // 0-100, how confident we are in the recommendation
}

export interface DistributionStrategy {
    id: string;
    name: string;
    assignments: VehicleAssignment[];
    score: CompositeScore;
    hardConstraintsSatisfied: boolean;
    robustnessScore: number;  // 0-100, how resilient to changes
    backupOptions: number;     // Number of alternative assignments available
}

export interface CompositeScore {
    total: number;           // 0-100
    breakdown: {
        seatUtilization: number;      // 0-100
        driverVehicleMatch: number;   // 0-100
        shiftCompatibility: number;   // 0-100
        routeEfficiency: number;      // 0-100
        balance: number;              // 0-100
        robustness: number;           // 0-100
    };
    weights: {
        seatUtilization: number;
        driverVehicleMatch: number;
        shiftCompatibility: number;
        routeEfficiency: number;
        balance: number;
        robustness: number;
    };
}

export interface ConstraintStatus {
    hardConstraints: Constraint[];
    softConstraints: Constraint[];
    allHardSatisfied: boolean;
    softSatisfactionPercent: number;
}

export interface Constraint {
    id: string;
    name: string;
    type: ConstraintType;
    satisfied: boolean;
    value?: number;
    threshold?: number;
    message?: string;
}

export interface Warning {
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    affectedRoutes?: string[];
    affectedVehicles?: string[];
}

export interface CriticalIssue {
    code: string;
    title: string;
    description: string;
    impact: string;
    blocksProceeding: boolean;
}

export interface Suggestion {
    id: string;
    type: SuggestionType;
    priority: SuggestionPriority;
    title: string;
    description: string;
    actionLabel: string;
    impact: string;
    estimatedImprovement?: number;  // Score improvement
    autoApplicable: boolean;        // Can system apply automatically?
}

export type SuggestionType =
    | 'add_vehicle'
    | 'remove_vehicle'
    | 'swap_vehicle'
    | 'add_driver'
    | 'swap_driver'
    | 'adjust_shift'
    | 'split_route'
    | 'merge_routes'
    | 'reassign_employees'
    | 'delay_departure'
    | 'use_backup';

export interface ManualOverride {
    routeId: string;
    vehicleId?: string;
    driverId?: string;
    excludeEmployees?: string[];
    addEmployees?: EmployeeLocation[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_WEIGHTS = {
    seatUtilization: 0.20,
    driverVehicleMatch: 0.20,
    shiftCompatibility: 0.20,
    routeEfficiency: 0.15,
    balance: 0.10,
    robustness: 0.15,
};

// Hard constraints (for reference)
// - VEHICLE_CAPACITY: Can't exceed vehicle capacity
// - VEHICLE_AVAILABLE: Vehicle must be available
// - DRIVER_AVAILABLE: If assigned, driver must be available
// - NO_DUPLICATE_ASSIGN: Employee can't be in multiple vehicles

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Analyze distribution and find optimal strategy
 */
export function analyzeDistribution(input: AnalyzerInput): AnalysisResult {
    const { routes, vehicles, drivers, departureTime, mode, preferences } = input;

    // Step 1: Validate input and check hard constraints
    const constraintStatus = evaluateConstraints(routes, vehicles, drivers, departureTime);

    // Step 2: Detect critical issues
    const criticalIssues = detectCriticalIssues(routes, vehicles, drivers, departureTime);
    const blockers = criticalIssues.filter(i => i.blocksProceeding);

    // Step 3: Generate suggestions for issues
    const suggestions = generateSuggestions(routes, vehicles, drivers, criticalIssues, preferences);

    // Step 4: Generate distribution strategies
    const strategies = generateStrategies(routes, vehicles, drivers, departureTime, preferences);

    // Step 5: Score and rank strategies
    const scoredStrategies = strategies.map(s => scoreStrategy(s, vehicles, drivers, departureTime, preferences));
    scoredStrategies.sort((a, b) => {
        // First by hard constraints satisfied
        if (a.hardConstraintsSatisfied !== b.hardConstraintsSatisfied) {
            return a.hardConstraintsSatisfied ? -1 : 1;
        }
        // Then by total score
        if (a.score.total !== b.score.total) {
            return b.score.total - a.score.total;
        }
        // Tiebreaker: robustness
        return b.robustnessScore - a.robustnessScore;
    });

    // Step 6: Determine status and confidence
    const recommended = scoredStrategies.length > 0 ? scoredStrategies[0] : null;
    const alternatives = scoredStrategies.slice(1, 4); // Top 3 alternatives

    let status: AnalysisResult['status'] = 'infeasible';
    let confidence = 0;

    if (recommended) {
        if (recommended.hardConstraintsSatisfied && recommended.score.total >= 80) {
            status = 'optimal';
            confidence = Math.min(95, recommended.score.total);
        } else if (recommended.hardConstraintsSatisfied && recommended.score.total >= 50) {
            status = 'feasible';
            confidence = Math.min(80, recommended.score.total);
        } else if (recommended.hardConstraintsSatisfied) {
            status = 'degraded';
            confidence = Math.min(60, recommended.score.total);
        }
    }

    // Step 7: Generate warnings
    const warnings = generateWarnings(recommended, constraintStatus, criticalIssues);

    return {
        mode,
        status,
        recommended,
        alternatives,
        constraintStatus,
        warnings,
        criticalIssues,
        suggestions,
        canProceed: blockers.length === 0 && recommended !== null && recommended.hardConstraintsSatisfied,
        confidence,
    };
}

// ============================================================================
// CONSTRAINT EVALUATION
// ============================================================================

function evaluateConstraints(
    routes: RouteGroup[],
    vehicles: Vehicle[],
    drivers: Driver[],
    departureTime: string
): ConstraintStatus {
    const hardConstraints: Constraint[] = [];
    const softConstraints: Constraint[] = [];

    // Hard: Total capacity must be >= total employees
    const totalEmployees = routes.reduce((sum, r) => sum + r.employees.length, 0);
    const totalCapacity = vehicles.filter(v => v.available).reduce((sum, v) => sum + v.capacity, 0);

    hardConstraints.push({
        id: 'SUFFICIENT_CAPACITY',
        name: 'Sufficient Vehicle Capacity',
        type: 'hard',
        satisfied: totalCapacity >= totalEmployees,
        value: totalCapacity,
        threshold: totalEmployees,
        message: totalCapacity >= totalEmployees
            ? `${totalCapacity} seats for ${totalEmployees} employees`
            : `Need ${totalEmployees - totalCapacity} more seats`,
    });

    // Hard: At least one vehicle available
    const availableVehicles = vehicles.filter(v => v.available).length;
    hardConstraints.push({
        id: 'VEHICLES_AVAILABLE',
        name: 'Vehicles Available',
        type: 'hard',
        satisfied: availableVehicles > 0,
        value: availableVehicles,
        threshold: 1,
        message: availableVehicles > 0 ? `${availableVehicles} vehicles available` : 'No vehicles available',
    });

    // Soft: Drivers available for departure time
    const driversInShift = filterDriversByDepartureTime(drivers, departureTime);
    softConstraints.push({
        id: 'DRIVERS_IN_SHIFT',
        name: 'Drivers Available for Shift',
        type: 'soft',
        satisfied: driversInShift.length >= routes.length,
        value: driversInShift.length,
        threshold: routes.length,
        message: `${driversInShift.length}/${routes.length} drivers in shift`,
    });

    // Soft: Utilization target (80%)
    const expectedUtilization = totalCapacity > 0 ? (totalEmployees / totalCapacity) * 100 : 0;
    softConstraints.push({
        id: 'UTILIZATION_TARGET',
        name: 'Utilization Target 80%',
        type: 'soft',
        satisfied: expectedUtilization >= 70,
        value: Math.round(expectedUtilization),
        threshold: 80,
        message: `Expected ${Math.round(expectedUtilization)}% utilization`,
    });

    return {
        hardConstraints,
        softConstraints,
        allHardSatisfied: hardConstraints.every(c => c.satisfied),
        softSatisfactionPercent: Math.round(
            (softConstraints.filter(c => c.satisfied).length / softConstraints.length) * 100
        ),
    };
}

function filterDriversByDepartureTime(drivers: Driver[], departureTime: string): Driver[] {
    const [depHour, depMin] = departureTime.split(':').map(Number);
    const depMinutes = depHour * 60 + depMin;

    return drivers.filter(d => {
        if (!d.available) return false;
        if (!d.shiftStart || !d.shiftEnd) return true;

        const [startH, startM] = d.shiftStart.split(':').map(Number);
        const [endH, endM] = d.shiftEnd.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        if (endMin < startMin) {
            return depMinutes >= startMin || depMinutes <= endMin;
        }
        return depMinutes >= startMin && depMinutes <= endMin;
    });
}

// ============================================================================
// CRITICAL ISSUE DETECTION
// ============================================================================

function detectCriticalIssues(
    routes: RouteGroup[],
    vehicles: Vehicle[],
    drivers: Driver[],
    _departureTime: string
): CriticalIssue[] {
    const issues: CriticalIssue[] = [];

    const totalEmployees = routes.reduce((sum, r) => sum + r.employees.length, 0);
    const totalCapacity = vehicles.filter(v => v.available).reduce((sum, v) => sum + v.capacity, 0);
    const availableDrivers = drivers.filter(d => d.available).length;

    // Critical: No capacity
    if (totalCapacity === 0) {
        issues.push({
            code: 'NO_CAPACITY',
            title: 'No Vehicle Capacity Available',
            description: 'All vehicles are either unavailable or have no capacity.',
            impact: 'Cannot transport any employees.',
            blocksProceeding: true,
        });
    }

    // Critical: Insufficient capacity
    if (totalCapacity > 0 && totalCapacity < totalEmployees) {
        issues.push({
            code: 'INSUFFICIENT_CAPACITY',
            title: 'Insufficient Vehicle Capacity',
            description: `Need ${totalEmployees} seats but only ${totalCapacity} available.`,
            impact: `${totalEmployees - totalCapacity} employees cannot be transported.`,
            blocksProceeding: true,
        });
    }

    // Warning: No drivers
    if (availableDrivers === 0) {
        issues.push({
            code: 'NO_DRIVERS',
            title: 'No Drivers Available',
            description: 'All drivers are marked as unavailable.',
            impact: 'Vehicles will be assigned without drivers.',
            blocksProceeding: false, // Can proceed, just warn
        });
    }

    // Warning: Routes > Vehicles
    const availableVehicleCount = vehicles.filter(v => v.available).length;
    if (routes.length > availableVehicleCount) {
        issues.push({
            code: 'MORE_ROUTES_THAN_VEHICLES',
            title: 'More Routes Than Vehicles',
            description: `${routes.length} routes but only ${availableVehicleCount} vehicles.`,
            impact: 'Some routes will need to share vehicles or be combined.',
            blocksProceeding: false,
        });
    }

    return issues;
}

// ============================================================================
// SUGGESTION GENERATION
// ============================================================================

function generateSuggestions(
    routes: RouteGroup[],
    vehicles: Vehicle[],
    drivers: Driver[],
    _criticalIssues: CriticalIssue[],
    _preferences?: DistributionPreferences
): Suggestion[] {
    const suggestions: Suggestion[] = [];
    let suggestionId = 1;

    const totalEmployees = routes.reduce((sum, r) => sum + r.employees.length, 0);
    const totalCapacity = vehicles.filter(v => v.available).reduce((sum, v) => sum + v.capacity, 0);
    const availableDrivers = drivers.filter(d => d.available);
    const unavailableVehicles = vehicles.filter(v => !v.available);

    // Suggestion for insufficient capacity
    if (totalCapacity < totalEmployees) {
        const shortfall = totalEmployees - totalCapacity;

        suggestions.push({
            id: `sug-${suggestionId++}`,
            type: 'add_vehicle',
            priority: 'critical',
            title: 'Add More Vehicles',
            description: `Add ${Math.ceil(shortfall / 4)} vehicles with 4+ seats each.`,
            actionLabel: 'Request Additional Vehicles',
            impact: `Will accommodate ${shortfall} more employees.`,
            estimatedImprovement: 30,
            autoApplicable: false,
        });

        // Enable unavailable vehicles
        if (unavailableVehicles.length > 0) {
            const potentialCapacity = unavailableVehicles.reduce((sum, v) => sum + v.capacity, 0);
            suggestions.push({
                id: `sug-${suggestionId++}`,
                type: 'use_backup',
                priority: 'critical',
                title: 'Enable Unavailable Vehicles',
                description: `${unavailableVehicles.length} vehicles are marked unavailable (${potentialCapacity} seats).`,
                actionLabel: 'Review & Enable Vehicles',
                impact: `Could add ${potentialCapacity} seats.`,
                estimatedImprovement: 25,
                autoApplicable: false,
            });
        }

        // Split into trips
        suggestions.push({
            id: `sug-${suggestionId++}`,
            type: 'split_route',
            priority: 'high',
            title: 'Multiple Trips',
            description: 'Split employees into multiple trip batches.',
            actionLabel: 'Configure Multi-Trip',
            impact: 'All employees transported in 2+ trips.',
            estimatedImprovement: 20,
            autoApplicable: true,
        });
    }

    // Suggestion for no drivers
    if (availableDrivers.length === 0) {
        const unavailableDrivers = drivers.filter(d => !d.available);

        suggestions.push({
            id: `sug-${suggestionId++}`,
            type: 'add_driver',
            priority: 'high',
            title: 'Enable Available Drivers',
            description: `${unavailableDrivers.length} drivers marked as unavailable.`,
            actionLabel: 'Review Driver Availability',
            impact: 'Vehicles can depart with assigned drivers.',
            autoApplicable: false,
        });
    }

    // Suggestion for low utilization
    if (totalCapacity > 0 && totalEmployees > 0) {
        const utilization = (totalEmployees / totalCapacity) * 100;
        if (utilization < 50) {
            suggestions.push({
                id: `sug-${suggestionId++}`,
                type: 'remove_vehicle',
                priority: 'medium',
                title: 'Reduce Fleet Size',
                description: `Only ${Math.round(utilization)}% capacity utilized. Consider using fewer vehicles.`,
                actionLabel: 'Optimize Fleet',
                impact: 'Better utilization, lower costs.',
                estimatedImprovement: 15,
                autoApplicable: true,
            });

            suggestions.push({
                id: `sug-${suggestionId++}`,
                type: 'swap_vehicle',
                priority: 'medium',
                title: 'Use Smaller Vehicles',
                description: 'Switch to smaller capacity vehicles for better efficiency.',
                actionLabel: 'Swap to Sedan',
                impact: 'Higher utilization percentage.',
                estimatedImprovement: 10,
                autoApplicable: true,
            });
        }
    }

    // Suggestion for driver shift mismatch
    const driversInShift = availableDrivers.filter(d => !d.shiftStart || !d.shiftEnd);
    if (driversInShift.length < routes.length && availableDrivers.length >= routes.length) {
        suggestions.push({
            id: `sug-${suggestionId++}`,
            type: 'adjust_shift',
            priority: 'medium',
            title: 'Adjust Departure Time',
            description: 'Some drivers not available at departure time.',
            actionLabel: 'View Shift Conflicts',
            impact: 'Better driver-route matching.',
            autoApplicable: false,
        });
    }

    return suggestions.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

// ============================================================================
// STRATEGY GENERATION
// ============================================================================

function generateStrategies(
    routes: RouteGroup[],
    vehicles: Vehicle[],
    drivers: Driver[],
    departureTime: string,
    _preferences?: DistributionPreferences
): DistributionStrategy[] {
    const strategies: DistributionStrategy[] = [];
    const availableVehicles = vehicles.filter(v => v.available);

    if (availableVehicles.length === 0 || routes.length === 0) {
        return strategies;
    }

    // Strategy 1: Maximize Utilization
    const utilizationResult = distributeToVehicles({
        vehicles,
        drivers,
        routeGroups: routes,
        departureTime,
        options: {
            preferHigherUtilization: true,
            considerDriverShifts: true,
            allowOverflow: false,
        },
    });

    if (utilizationResult.assignments.length > 0) {
        strategies.push({
            id: 'max-utilization',
            name: 'Maximum Utilization',
            assignments: utilizationResult.assignments,
            score: getEmptyScore(),
            hardConstraintsSatisfied: utilizationResult.success,
            robustnessScore: 70,
            backupOptions: countBackupOptions(utilizationResult.assignments, availableVehicles),
        });
    }

    // Strategy 2: Balanced Distribution
    const balancedResult = distributeToVehicles({
        vehicles,
        drivers,
        routeGroups: [...routes].sort((a, b) => a.employees.length - b.employees.length),
        departureTime,
        options: {
            preferHigherUtilization: false,
            considerDriverShifts: true,
            allowOverflow: false,
        },
    });

    if (balancedResult.assignments.length > 0) {
        strategies.push({
            id: 'balanced',
            name: 'Balanced Distribution',
            assignments: balancedResult.assignments,
            score: getEmptyScore(),
            hardConstraintsSatisfied: balancedResult.success,
            robustnessScore: 85,
            backupOptions: countBackupOptions(balancedResult.assignments, availableVehicles),
        });
    }

    // Strategy 3: Minimum Vehicles
    const minVehiclesResult = distributeToVehicles({
        vehicles: [...vehicles].sort((a, b) => b.capacity - a.capacity),
        drivers,
        routeGroups: [...routes].sort((a, b) => b.employees.length - a.employees.length),
        departureTime,
        options: {
            preferHigherUtilization: true,
            considerDriverShifts: false,
            allowOverflow: true,
        },
    });

    if (minVehiclesResult.assignments.length > 0) {
        strategies.push({
            id: 'min-vehicles',
            name: 'Minimum Vehicles',
            assignments: minVehiclesResult.assignments,
            score: getEmptyScore(),
            hardConstraintsSatisfied: minVehiclesResult.success,
            robustnessScore: 50,
            backupOptions: countBackupOptions(minVehiclesResult.assignments, availableVehicles),
        });
    }

    // Strategy 4: Driver-Optimized (prefer licensed drivers)
    const driverOptResult = distributeToVehicles({
        vehicles,
        drivers: drivers.filter(d => d.available && d.licensedFor && d.licensedFor.length > 0),
        routeGroups: routes,
        departureTime,
        options: {
            preferHigherUtilization: false,
            considerDriverShifts: true,
            allowOverflow: false,
        },
    });

    if (driverOptResult.assignments.length > 0) {
        strategies.push({
            id: 'driver-optimized',
            name: 'Driver-Optimized',
            assignments: driverOptResult.assignments,
            score: getEmptyScore(),
            hardConstraintsSatisfied: driverOptResult.success,
            robustnessScore: 80,
            backupOptions: countBackupOptions(driverOptResult.assignments, availableVehicles),
        });
    }

    return strategies;
}

function countBackupOptions(assignments: VehicleAssignment[], allVehicles: Vehicle[]): number {
    const usedVehicleIds = new Set(assignments.map(a => a.vehicleId));
    const backupVehicles = allVehicles.filter(v => v.available && !usedVehicleIds.has(v.id));
    return backupVehicles.length;
}

// ============================================================================
// STRATEGY SCORING
// ============================================================================

function scoreStrategy(
    strategy: DistributionStrategy,
    vehicles: Vehicle[],
    drivers: Driver[],
    departureTime: string,
    preferences?: DistributionPreferences
): DistributionStrategy {
    const weights = { ...DEFAULT_WEIGHTS };

    // Adjust weights based on preferences
    if (preferences?.prioritizeUtilization) {
        weights.seatUtilization = 0.30;
        weights.robustness = 0.10;
    }
    if (preferences?.prioritizeDriverMatch) {
        weights.driverVehicleMatch = 0.30;
        weights.balance = 0.05;
    }

    // Calculate individual scores
    const breakdown = {
        seatUtilization: calculateUtilizationScore(strategy.assignments),
        driverVehicleMatch: calculateDriverMatchScore(strategy.assignments, vehicles),
        shiftCompatibility: calculateShiftScore(strategy.assignments, drivers, departureTime),
        routeEfficiency: calculateEfficiencyScore(strategy.assignments),
        balance: calculateBalanceScore(strategy.assignments),
        robustness: strategy.robustnessScore,
    };

    // Calculate weighted total
    const total = Math.round(
        breakdown.seatUtilization * weights.seatUtilization +
        breakdown.driverVehicleMatch * weights.driverVehicleMatch +
        breakdown.shiftCompatibility * weights.shiftCompatibility +
        breakdown.routeEfficiency * weights.routeEfficiency +
        breakdown.balance * weights.balance +
        breakdown.robustness * weights.robustness
    );

    return {
        ...strategy,
        score: {
            total,
            breakdown,
            weights,
        },
    };
}

function calculateUtilizationScore(assignments: VehicleAssignment[]): number {
    if (assignments.length === 0) return 0;

    const avgUtil = assignments.reduce((sum, a) => sum + a.utilization, 0) / assignments.length;

    // Bonus for 70-90% utilization (sweet spot)
    if (avgUtil >= 70 && avgUtil <= 90) return Math.min(100, avgUtil + 10);
    if (avgUtil > 90) return 95; // Slightly penalize over-packing
    return avgUtil;
}

function calculateDriverMatchScore(assignments: VehicleAssignment[], vehicles: Vehicle[]): number {
    if (assignments.length === 0) return 0;

    let matchCount = 0;
    let totalWithDrivers = 0;

    assignments.forEach(a => {
        if (a.driverId) {
            totalWithDrivers++;
            const vehicle = vehicles.find(v => v.id === a.vehicleId);
            // For now, assume match if driver is assigned
            if (vehicle) matchCount++;
        }
    });

    if (totalWithDrivers === 0) return 50; // Neutral if no drivers assigned
    return Math.round((matchCount / totalWithDrivers) * 100);
}

function calculateShiftScore(assignments: VehicleAssignment[], drivers: Driver[], departureTime: string): number {
    if (assignments.length === 0) return 0;

    const driversInShift = filterDriversByDepartureTime(drivers, departureTime);
    const driverIds = new Set(driversInShift.map(d => d.id));

    let inShiftCount = 0;
    let totalWithDrivers = 0;

    assignments.forEach(a => {
        if (a.driverId) {
            totalWithDrivers++;
            if (driverIds.has(a.driverId)) inShiftCount++;
        }
    });

    if (totalWithDrivers === 0) return 70; // Neutral if no drivers
    return Math.round((inShiftCount / totalWithDrivers) * 100);
}

function calculateEfficiencyScore(assignments: VehicleAssignment[]): number {
    if (assignments.length === 0) return 0;

    // Use the efficiency scores from routes
    const avgEfficiency = assignments.reduce((sum, a) => sum + (a.route.efficiencyScore || 80), 0) / assignments.length;
    return Math.round(avgEfficiency);
}

function calculateBalanceScore(assignments: VehicleAssignment[]): number {
    if (assignments.length <= 1) return 100;

    const counts = assignments.map(a => a.employeeCount);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = more balanced
    const balanceScore = Math.max(0, 100 - (stdDev * 15));
    return Math.round(balanceScore);
}

function getEmptyScore(): CompositeScore {
    return {
        total: 0,
        breakdown: {
            seatUtilization: 0,
            driverVehicleMatch: 0,
            shiftCompatibility: 0,
            routeEfficiency: 0,
            balance: 0,
            robustness: 0,
        },
        weights: DEFAULT_WEIGHTS,
    };
}

// ============================================================================
// WARNING GENERATION
// ============================================================================

function generateWarnings(
    strategy: DistributionStrategy | null,
    constraintStatus: ConstraintStatus,
    _criticalIssues: CriticalIssue[]
): Warning[] {
    const warnings: Warning[] = [];

    if (!strategy) return warnings;

    // Low utilization warning
    const avgUtil = strategy.assignments.length > 0
        ? strategy.assignments.reduce((s, a) => s + a.utilization, 0) / strategy.assignments.length
        : 0;

    if (avgUtil < 50) {
        warnings.push({
            code: 'LOW_UTILIZATION',
            message: `Average seat utilization is only ${Math.round(avgUtil)}%. Consider using fewer or smaller vehicles.`,
            severity: 'medium',
        });
    }

    // No drivers assigned
    const unassignedDrivers = strategy.assignments.filter(a => !a.driverId);
    if (unassignedDrivers.length > 0) {
        warnings.push({
            code: 'NO_DRIVERS_ASSIGNED',
            message: `${unassignedDrivers.length} vehicle(s) have no driver assigned.`,
            severity: 'high',
            affectedVehicles: unassignedDrivers.map(a => a.vehicleId),
        });
    }

    // Soft constraints not satisfied
    const failedSoft = constraintStatus.softConstraints.filter(c => !c.satisfied);
    failedSoft.forEach(c => {
        warnings.push({
            code: c.id,
            message: c.message || `${c.name} not satisfied`,
            severity: 'low',
        });
    });

    return warnings;
}

// ============================================================================
// MANUAL MODE SUPPORT
// ============================================================================

/**
 * Apply manual overrides to a strategy
 */
export function applyManualOverrides(
    strategy: DistributionStrategy,
    overrides: ManualOverride[],
    vehicles: Vehicle[],
    drivers: Driver[]
): DistributionStrategy {
    const newAssignments = [...strategy.assignments];

    overrides.forEach(override => {
        const assignmentIdx = newAssignments.findIndex(a => a.routeId === override.routeId);
        if (assignmentIdx === -1) return;

        const assignment = { ...newAssignments[assignmentIdx] };

        // Override vehicle
        if (override.vehicleId) {
            const vehicle = vehicles.find(v => v.id === override.vehicleId);
            if (vehicle) {
                assignment.vehicleId = vehicle.id;
                assignment.vehicleName = vehicle.name;
                assignment.vehicleType = vehicle.type;
                assignment.capacity = vehicle.capacity;
                assignment.utilization = Math.round((assignment.employeeCount / vehicle.capacity) * 100);
            }
        }

        // Override driver
        if (override.driverId) {
            const driver = drivers.find(d => d.id === override.driverId);
            if (driver) {
                assignment.driverId = driver.id;
                assignment.driverName = driver.name;
            }
        } else if (override.driverId === null) {
            assignment.driverId = undefined;
            assignment.driverName = undefined;
        }

        newAssignments[assignmentIdx] = assignment;
    });

    return {
        ...strategy,
        id: 'manual-override',
        name: 'Manual Override',
        assignments: newAssignments,
    };
}

/**
 * Validate a manual configuration
 */
export function validateManualConfiguration(
    assignments: VehicleAssignment[],
    vehicles: Vehicle[],
    drivers: Driver[]
): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate vehicle assignments
    const vehicleIds = assignments.map(a => a.vehicleId);
    const duplicateVehicles = vehicleIds.filter((id, idx) => vehicleIds.indexOf(id) !== idx);
    if (duplicateVehicles.length > 0) {
        errors.push(`Vehicle(s) assigned to multiple routes: ${duplicateVehicles.join(', ')}`);
    }

    // Check for over-capacity
    assignments.forEach(a => {
        if (a.employeeCount > a.capacity) {
            errors.push(`${a.vehicleName} is over capacity: ${a.employeeCount}/${a.capacity}`);
        }
    });

    // Check vehicle availability
    assignments.forEach(a => {
        const vehicle = vehicles.find(v => v.id === a.vehicleId);
        if (vehicle && !vehicle.available) {
            warnings.push(`${vehicle.name} is marked as unavailable`);
        }
    });

    // Check driver availability
    assignments.forEach(a => {
        if (a.driverId) {
            const driver = drivers.find(d => d.id === a.driverId);
            if (driver && !driver.available) {
                warnings.push(`Driver ${driver.name} is marked as unavailable`);
            }
        }
    });

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Get AI suggestion for a partial manual configuration
 */
export function getAISuggestionForManual(
    partialAssignments: VehicleAssignment[],
    remainingRoutes: RouteGroup[],
    vehicles: Vehicle[],
    drivers: Driver[],
    departureTime: string
): DistributionStrategy | null {
    // Find unused vehicles
    const usedVehicleIds = new Set(partialAssignments.map(a => a.vehicleId));
    const availableVehicles = vehicles.filter(v => v.available && !usedVehicleIds.has(v.id));

    // Find unused drivers
    const usedDriverIds = new Set(partialAssignments.filter(a => a.driverId).map(a => a.driverId));
    const availableDrivers = drivers.filter(d => d.available && !usedDriverIds.has(d.id));

    if (remainingRoutes.length === 0 || availableVehicles.length === 0) {
        return null;
    }

    // Run distribution for remaining
    const result = distributeToVehicles({
        vehicles: availableVehicles,
        drivers: availableDrivers,
        routeGroups: remainingRoutes,
        departureTime,
        options: { preferHigherUtilization: true, considerDriverShifts: true },
    });

    if (!result.success) return null;

    return {
        id: 'ai-suggestion',
        name: 'AI Suggestion for Remaining',
        assignments: [...partialAssignments, ...result.assignments],
        score: getEmptyScore(),
        hardConstraintsSatisfied: true,
        robustnessScore: 75,
        backupOptions: 0,
    };
}
