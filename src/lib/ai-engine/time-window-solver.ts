/**
 * Time Window Constraint Solver
 * 
 * Handles employee pickup time preferences and constraints:
 * - Preferred pickup times
 * - Time window ranges (earliest/latest acceptable)
 * - Penalty calculation for constraint violations
 */

import type { TimeWindow, TimeConstraints, RouteStop, EmployeeLocation } from './types';

// ============================================================================
// TIME PARSING UTILITIES
// ============================================================================

/**
 * Parse "HH:mm" time string to minutes from midnight
 */
export function parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

/**
 * Format minutes from midnight to "HH:mm" string
 */
export function formatMinutesToTime(minutes: number): string {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutes: number): string {
    const totalMinutes = parseTimeToMinutes(time) + minutes;
    return formatMinutesToTime(totalMinutes);
}

// ============================================================================
// TIME WINDOW GENERATION
// ============================================================================

/**
 * Generate time windows from employee preferences
 */
export function generateTimeWindows(
    employees: EmployeeLocation[],
    defaultWindowMinutes: number = 30
): Map<string, TimeWindow> {
    const windows = new Map<string, TimeWindow>();

    for (const emp of employees) {
        if (!emp.preferredPickupTime && !emp.timeWindowStart && !emp.timeWindowEnd) {
            continue; // No time preference
        }

        const preferred = emp.preferredPickupTime
            ? parseTimeToMinutes(emp.preferredPickupTime)
            : undefined;

        const start = emp.timeWindowStart
            ? parseTimeToMinutes(emp.timeWindowStart)
            : preferred ? preferred - defaultWindowMinutes / 2 : undefined;

        const end = emp.timeWindowEnd
            ? parseTimeToMinutes(emp.timeWindowEnd)
            : preferred ? preferred + defaultWindowMinutes / 2 : undefined;

        if (start !== undefined && end !== undefined) {
            windows.set(emp.id, {
                start,
                end,
                preferred,
                penalty: 1.0, // Default penalty weight
            });
        }
    }

    return windows;
}

// ============================================================================
// CONSTRAINT VALIDATION
// ============================================================================

export interface TimeWindowViolation {
    employeeId: string;
    expectedArrival: number;
    windowStart: number;
    windowEnd: number;
    violationMinutes: number;
    violationType: 'early' | 'late';
    penaltyScore: number;
}

/**
 * Validate a route against time window constraints
 */
export function validateTimeWindows(
    route: number[],
    employees: EmployeeLocation[],
    distanceMatrix: number[][],
    startIndex: number,
    constraints: TimeConstraints,
    timeWindows: Map<string, TimeWindow>
): TimeWindowViolation[] {
    const violations: TimeWindowViolation[] = [];

    let currentTime = parseTimeToMinutes(constraints.departureTime);
    let currentNode = startIndex;
    const bufferPerStop = constraints.bufferPerStop ?? 2;
    const avgSpeedKmh = 30; // Average speed for time estimation

    for (const nodeIndex of route) {
        if (nodeIndex === startIndex) continue;

        const emp = employees[nodeIndex - 1]; // Adjust for office at index 0
        if (!emp) continue;

        // Calculate travel time
        const distance = distanceMatrix[currentNode][nodeIndex];
        const travelTime = (distance / avgSpeedKmh) * 60;
        currentTime += travelTime;

        // Check time window
        const tw = timeWindows.get(emp.id);
        if (tw) {
            if (currentTime < tw.start) {
                // Arrived early
                const violationMinutes = tw.start - currentTime;
                violations.push({
                    employeeId: emp.id,
                    expectedArrival: currentTime,
                    windowStart: tw.start,
                    windowEnd: tw.end,
                    violationMinutes,
                    violationType: 'early',
                    penaltyScore: violationMinutes * 0.5 * (tw.penalty ?? 1.0),
                });
                // Wait until window opens (optional)
                // currentTime = tw.start;
            } else if (currentTime > tw.end) {
                // Arrived late
                const violationMinutes = currentTime - tw.end;
                violations.push({
                    employeeId: emp.id,
                    expectedArrival: currentTime,
                    windowStart: tw.start,
                    windowEnd: tw.end,
                    violationMinutes,
                    violationType: 'late',
                    penaltyScore: violationMinutes * 2.0 * (tw.penalty ?? 1.0), // Higher penalty for late
                });
            }
        }

        // Add buffer for pickup
        currentTime += bufferPerStop;
        currentNode = nodeIndex;
    }

    return violations;
}

/**
 * Calculate total penalty score for time window violations
 */
export function calculateTimeWindowPenalty(
    violations: TimeWindowViolation[]
): number {
    return violations.reduce((total, v) => total + v.penaltyScore, 0);
}

/**
 * Calculate time window compliance score (0-100)
 * 100 = no violations, 0 = severe violations
 */
export function calculateTimeWindowScore(
    violations: TimeWindowViolation[],
    totalStops: number
): number {
    if (totalStops === 0) return 100;
    if (violations.length === 0) return 100;

    // Calculate based on percentage of stops with violations and severity
    const violatedStops = violations.length;
    const avgViolationMinutes = violations.reduce((sum, v) => sum + v.violationMinutes, 0) / violations.length;

    // Compliance: fewer violations = higher score
    const complianceRatio = 1 - (violatedStops / totalStops);

    // Severity: smaller violations = higher score (normalized to 30 min max)
    const severityScore = Math.max(0, 1 - (avgViolationMinutes / 30));

    // Combined score
    const score = (complianceRatio * 0.6 + severityScore * 0.4) * 100;

    return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// ROUTE TIMING CALCULATION
// ============================================================================

/**
 * Calculate arrival times for each stop in a route
 */
export function calculateRouteTiming(
    route: number[],
    employees: EmployeeLocation[],
    distanceMatrix: number[][],
    startIndex: number,
    constraints: TimeConstraints
): RouteStop[] {
    const stops: RouteStop[] = [];

    let currentTime = parseTimeToMinutes(constraints.departureTime);
    let currentNode = startIndex;
    let cumulativeDistance = 0;
    let cumulativeDuration = 0;
    const bufferPerStop = constraints.bufferPerStop ?? 2;
    const avgSpeedKmh = 30;

    for (let i = 0; i < route.length; i++) {
        const nodeIndex = route[i];
        if (nodeIndex === startIndex) continue;

        const empIndex = nodeIndex - 1; // Adjust for office at index 0
        const emp = employees[empIndex];
        if (!emp) continue;

        // Calculate travel
        const distance = distanceMatrix[currentNode][nodeIndex];
        const travelTime = (distance / avgSpeedKmh) * 60;

        currentTime += travelTime;
        cumulativeDistance += distance;
        cumulativeDuration += travelTime;

        const arrivalTime = formatMinutesToTime(currentTime);
        const departureTime = formatMinutesToTime(currentTime + bufferPerStop);

        stops.push({
            location: emp,
            sequence: stops.length + 1,
            arrivalTime,
            departureTime,
            waitTime: 0, // Can be adjusted if we implement waiting for time windows
            distanceFromPrevious: Math.round(distance * 10) / 10,
            durationFromPrevious: Math.round(travelTime),
            cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
            cumulativeDuration: Math.round(cumulativeDuration),
        });

        currentTime += bufferPerStop;
        cumulativeDuration += bufferPerStop;
        currentNode = nodeIndex;
    }

    return stops;
}

// ============================================================================
// TIME WINDOW OPTIMIZATION HELPERS
// ============================================================================

/**
 * Sort stops to minimize time window violations
 * Uses a greedy approach prioritizing earliest windows
 */
export function sortByTimeWindows(
    employeeIndices: number[],
    timeWindows: Map<string, TimeWindow>,
    employees: EmployeeLocation[]
): number[] {
    return [...employeeIndices].sort((a, b) => {
        const empA = employees[a - 1]; // Adjust for office at index 0
        const empB = employees[b - 1];

        if (!empA || !empB) return 0;

        const twA = timeWindows.get(empA.id);
        const twB = timeWindows.get(empB.id);

        // Employees with time windows come first
        if (twA && !twB) return -1;
        if (!twA && twB) return 1;
        if (!twA && !twB) return 0;

        // Sort by window start time
        return (twA!.start || 0) - (twB!.start || 0);
    });
}

/**
 * Check if a route respects max total duration constraint
 */
export function checkMaxDuration(
    totalDuration: number,
    constraints: TimeConstraints
): boolean {
    if (!constraints.maxTotalDuration) return true;
    return totalDuration <= constraints.maxTotalDuration;
}

/**
 * Check if any wait time exceeds maximum allowed
 */
export function checkMaxWaitTime(
    stops: RouteStop[],
    constraints: TimeConstraints
): boolean {
    if (!constraints.maxWaitTime) return true;
    return stops.every(stop => stop.waitTime <= constraints.maxWaitTime!);
}
