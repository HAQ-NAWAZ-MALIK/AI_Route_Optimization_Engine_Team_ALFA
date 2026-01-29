/**
 * Cab Distribution System
 * 
 * Production-grade vehicle assignment for optimized routes.
 * Features:
 * - First-Fit Decreasing Bin Packing algorithm
 * - Driver shift constraints (toggleable)
 * - Vehicle capacity optimization
 * - Overflow handling (error + suggestion)
 * - Stateless for multi-org parallelism
 */

import type { EmployeeLocation, OptimizedRoute, Coordinate } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface Vehicle {
    id: string;
    name: string;               // e.g., "Cab #12", "KA-01-AB-1234"
    capacity: number;           // Seating capacity (excluding driver)
    type: 'sedan' | 'suv' | 'van' | 'mini_bus';
    available: boolean;
    currentLocation?: Coordinate;
    fuelEfficiency?: number;    // km per liter
    features?: string[];        // ['ac', 'wifi', 'wheelchair_accessible']
}

export interface Driver {
    id: string;
    name: string;
    phone?: string;
    shiftStart?: string;        // "08:00"
    shiftEnd?: string;          // "18:00"
    available: boolean;
    assignedVehicleId?: string;
    licensedFor?: ('sedan' | 'suv' | 'van' | 'mini_bus')[];
}

export interface RouteGroup {
    routeId: string;
    employees: EmployeeLocation[];
    optimizedRoute: OptimizedRoute;
    totalDistance: number;
    totalDuration: number;
}

export interface VehicleAssignment {
    vehicleId: string;
    vehicleName: string;
    vehicleType: Vehicle['type'];
    capacity: number;
    driverId?: string;
    driverName?: string;
    employees: EmployeeLocation[];
    employeeCount: number;
    utilization: number;        // 0-100%
    route: OptimizedRoute;
    routeId: string;
    estimatedStartTime?: string;
    estimatedEndTime?: string;
}

export interface DistributionInput {
    vehicles: Vehicle[];
    drivers?: Driver[];
    routeGroups: RouteGroup[];
    departureTime?: string;     // "08:00"
    options?: DistributionOptions;
}

export interface DistributionOptions {
    considerDriverShifts?: boolean;     // Default: true
    preferHigherUtilization?: boolean;  // Default: true
    allowOverflow?: boolean;            // Default: false
    minUtilizationPercent?: number;     // Default: 50
    targetUtilizationPercent?: number;  // Default: 80
}

export interface DistributionResult {
    success: boolean;
    assignments: VehicleAssignment[];
    metrics: DistributionMetrics;
    warnings: string[];
    errors: string[];
    overflow?: OverflowInfo;
}

export interface DistributionMetrics {
    totalVehiclesUsed: number;
    totalVehiclesAvailable: number;
    totalEmployeesAssigned: number;
    totalCapacity: number;
    overallUtilization: number;         // 0-100%
    averageUtilization: number;
    vehicleBreakdown: {
        vehicleId: string;
        utilization: number;
        employeeCount: number;
    }[];
}

export interface OverflowInfo {
    unassignedEmployees: EmployeeLocation[];
    additionalVehiclesNeeded: number;
    suggestedCapacity: number;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// ============================================================================
// MAIN DISTRIBUTION FUNCTION
// ============================================================================

/**
 * Distribute employees to vehicles using First-Fit Decreasing algorithm
 * 
 * @param input - Vehicles, drivers, and route groups to distribute
 * @returns Distribution result with assignments and metrics
 */
export function distributeToVehicles(input: DistributionInput): DistributionResult {
    const options = {
        considerDriverShifts: true,
        preferHigherUtilization: true,
        allowOverflow: false,
        minUtilizationPercent: 50,
        targetUtilizationPercent: 80,
        ...input.options,
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate input
    const validation = validateInput(input);
    if (!validation.valid) {
        return {
            success: false,
            assignments: [],
            metrics: getEmptyMetrics(),
            warnings: validation.warnings,
            errors: validation.errors,
        };
    }
    warnings.push(...validation.warnings);

    // Get available vehicles
    let availableVehicles = input.vehicles.filter(v => v.available);

    // Get available drivers (if shift checking enabled)
    let availableDrivers = input.drivers?.filter(d => d.available) || [];
    if (options.considerDriverShifts && input.departureTime) {
        availableDrivers = filterDriversByShift(availableDrivers, input.departureTime);
    }

    // Sort vehicles by capacity (First-Fit Decreasing - largest first)
    availableVehicles = [...availableVehicles].sort((a, b) => b.capacity - a.capacity);

    // Sort route groups by employee count (largest first)
    const sortedGroups = [...input.routeGroups].sort(
        (a, b) => b.employees.length - a.employees.length
    );

    // Calculate total capacity and demand
    const totalCapacity = availableVehicles.reduce((sum, v) => sum + v.capacity, 0);
    const totalDemand = sortedGroups.reduce((sum, g) => sum + g.employees.length, 0);

    if (totalDemand > totalCapacity && !options.allowOverflow) {
        errors.push(`Insufficient capacity: ${totalDemand} employees need seats, only ${totalCapacity} available`);
        return {
            success: false,
            assignments: [],
            metrics: getEmptyMetrics(),
            warnings,
            errors,
            overflow: {
                unassignedEmployees: sortedGroups.flatMap(g => g.employees),
                additionalVehiclesNeeded: Math.ceil((totalDemand - totalCapacity) / 4), // Assume avg 4 seats
                suggestedCapacity: totalDemand - totalCapacity,
            },
        };
    }

    // Perform assignment
    const assignments: VehicleAssignment[] = [];
    const usedVehicleIds = new Set<string>();
    const usedDriverIds = new Set<string>();
    const unassignedEmployees: EmployeeLocation[] = [];

    for (const group of sortedGroups) {
        // Find suitable vehicle
        const vehicle = findBestVehicle(
            availableVehicles,
            usedVehicleIds,
            group.employees.length,
            options
        );

        if (!vehicle) {
            if (options.allowOverflow) {
                unassignedEmployees.push(...group.employees);
                warnings.push(`Route ${group.routeId}: No vehicle available, ${group.employees.length} employees unassigned`);
                continue;
            } else {
                errors.push(`No suitable vehicle for route ${group.routeId} with ${group.employees.length} employees`);
                continue;
            }
        }

        // Find suitable driver (if available and shift matches)
        const driver = findBestDriver(
            availableDrivers,
            usedDriverIds,
            vehicle,
            options
        );

        // Create assignment
        const utilization = Math.round((group.employees.length / vehicle.capacity) * 100);

        assignments.push({
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            vehicleType: vehicle.type,
            capacity: vehicle.capacity,
            driverId: driver?.id,
            driverName: driver?.name,
            employees: group.employees,
            employeeCount: group.employees.length,
            utilization,
            route: group.optimizedRoute,
            routeId: group.routeId,
        });

        usedVehicleIds.add(vehicle.id);
        if (driver) usedDriverIds.add(driver.id);

        // Low utilization warning
        if (utilization < options.minUtilizationPercent) {
            warnings.push(`Vehicle ${vehicle.name} only ${utilization}% utilized (${group.employees.length}/${vehicle.capacity})`);
        }
    }

    // Calculate metrics
    const metrics = calculateMetrics(assignments, availableVehicles.length, totalDemand);

    // Handle overflow
    const overflow = unassignedEmployees.length > 0 ? {
        unassignedEmployees,
        additionalVehiclesNeeded: Math.ceil(unassignedEmployees.length / 4),
        suggestedCapacity: unassignedEmployees.length,
    } : undefined;

    return {
        success: errors.length === 0,
        assignments,
        metrics,
        warnings,
        errors,
        overflow,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateInput(input: DistributionInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.vehicles || input.vehicles.length === 0) {
        errors.push('No vehicles provided');
    }

    if (!input.routeGroups || input.routeGroups.length === 0) {
        errors.push('No route groups provided');
    }

    const availableVehicles = input.vehicles?.filter(v => v.available) || [];
    if (availableVehicles.length === 0 && input.vehicles?.length > 0) {
        errors.push('No available vehicles (all vehicles are marked unavailable)');
    }

    // Check for empty route groups
    const emptyGroups = input.routeGroups?.filter(g => g.employees.length === 0) || [];
    if (emptyGroups.length > 0) {
        warnings.push(`${emptyGroups.length} route group(s) have no employees`);
    }

    // Check for vehicles with 0 capacity
    const zeroCapacity = input.vehicles?.filter(v => v.capacity <= 0) || [];
    if (zeroCapacity.length > 0) {
        warnings.push(`${zeroCapacity.length} vehicle(s) have 0 or negative capacity`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

function filterDriversByShift(drivers: Driver[], departureTime: string): Driver[] {
    const [depHour, depMin] = departureTime.split(':').map(Number);
    const depMinutes = depHour * 60 + depMin;

    return drivers.filter(driver => {
        if (!driver.shiftStart || !driver.shiftEnd) return true; // No shift = always available

        const [startHour, startMin] = driver.shiftStart.split(':').map(Number);
        const [endHour, endMin] = driver.shiftEnd.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        // Handle overnight shifts
        if (endMinutes < startMinutes) {
            return depMinutes >= startMinutes || depMinutes <= endMinutes;
        }

        return depMinutes >= startMinutes && depMinutes <= endMinutes;
    });
}

function findBestVehicle(
    vehicles: Vehicle[],
    usedIds: Set<string>,
    requiredSeats: number,
    options: DistributionOptions
): Vehicle | null {
    // Filter available and unused vehicles with enough capacity
    const candidates = vehicles.filter(v =>
        !usedIds.has(v.id) &&
        v.available &&
        v.capacity >= requiredSeats
    );

    if (candidates.length === 0) return null;

    if (options.preferHigherUtilization) {
        // Prefer vehicle with capacity closest to required (higher utilization)
        return candidates.reduce((best, current) => {
            const bestUtil = requiredSeats / best.capacity;
            const currentUtil = requiredSeats / current.capacity;
            return currentUtil > bestUtil ? current : best;
        });
    }

    // Otherwise return largest available (original FFD behavior)
    return candidates[0];
}

function findBestDriver(
    drivers: Driver[],
    usedIds: Set<string>,
    vehicle: Vehicle,
    _options: DistributionOptions
): Driver | null {
    // Filter available and unused drivers
    const candidates = drivers.filter(d =>
        !usedIds.has(d.id) &&
        d.available
    );

    if (candidates.length === 0) return null;

    // Prefer driver already assigned to this vehicle
    const assignedDriver = candidates.find(d => d.assignedVehicleId === vehicle.id);
    if (assignedDriver) return assignedDriver;

    // Prefer driver licensed for this vehicle type
    const licensedDriver = candidates.find(d =>
        d.licensedFor?.includes(vehicle.type)
    );
    if (licensedDriver) return licensedDriver;

    // Return first available
    return candidates[0];
}

function calculateMetrics(
    assignments: VehicleAssignment[],
    totalAvailable: number,
    _totalEmployees: number
): DistributionMetrics {
    const totalAssigned = assignments.reduce((sum, a) => sum + a.employeeCount, 0);
    const totalCapacityUsed = assignments.reduce((sum, a) => sum + a.capacity, 0);
    const avgUtil = assignments.length > 0
        ? assignments.reduce((sum, a) => sum + a.utilization, 0) / assignments.length
        : 0;

    return {
        totalVehiclesUsed: assignments.length,
        totalVehiclesAvailable: totalAvailable,
        totalEmployeesAssigned: totalAssigned,
        totalCapacity: totalCapacityUsed,
        overallUtilization: totalCapacityUsed > 0
            ? Math.round((totalAssigned / totalCapacityUsed) * 100)
            : 0,
        averageUtilization: Math.round(avgUtil),
        vehicleBreakdown: assignments.map(a => ({
            vehicleId: a.vehicleId,
            utilization: a.utilization,
            employeeCount: a.employeeCount,
        })),
    };
}

function getEmptyMetrics(): DistributionMetrics {
    return {
        totalVehiclesUsed: 0,
        totalVehiclesAvailable: 0,
        totalEmployeesAssigned: 0,
        totalCapacity: 0,
        overallUtilization: 0,
        averageUtilization: 0,
        vehicleBreakdown: [],
    };
}

// ============================================================================
// OPTIMIZATION FUNCTIONS
// ============================================================================

/**
 * Attempt to optimize existing assignments for better utilization
 * by combining underutilized vehicles
 */
export function optimizeUtilization(
    assignments: VehicleAssignment[],
    vehicles: Vehicle[],
    targetUtilization: number = 80
): { optimized: VehicleAssignment[]; vehiclesSaved: number } {
    // Find underutilized assignments
    const underutilized = assignments.filter(a => a.utilization < targetUtilization);
    const wellUtilized = assignments.filter(a => a.utilization >= targetUtilization);

    if (underutilized.length < 2) {
        return { optimized: assignments, vehiclesSaved: 0 };
    }

    // Try to combine underutilized assignments
    const combined: VehicleAssignment[] = [...wellUtilized];
    const processed = new Set<string>();
    let vehiclesSaved = 0;

    for (const assignment of underutilized) {
        if (processed.has(assignment.vehicleId)) continue;

        // Find another assignment to combine with
        for (const other of underutilized) {
            if (processed.has(other.vehicleId) || other.vehicleId === assignment.vehicleId) continue;

            const totalEmployees = assignment.employeeCount + other.employeeCount;

            // Find vehicle that can fit both groups
            const largerVehicle = vehicles.find(v =>
                v.capacity >= totalEmployees &&
                (v.id === assignment.vehicleId || v.id === other.vehicleId)
            );

            if (largerVehicle) {
                // Combine assignments
                combined.push({
                    ...assignment,
                    vehicleId: largerVehicle.id,
                    vehicleName: largerVehicle.name,
                    capacity: largerVehicle.capacity,
                    employees: [...assignment.employees, ...other.employees],
                    employeeCount: totalEmployees,
                    utilization: Math.round((totalEmployees / largerVehicle.capacity) * 100),
                });

                processed.add(assignment.vehicleId);
                processed.add(other.vehicleId);
                vehiclesSaved++;
                break;
            }
        }

        // If couldn't combine, keep original
        if (!processed.has(assignment.vehicleId)) {
            combined.push(assignment);
            processed.add(assignment.vehicleId);
        }
    }

    return { optimized: combined, vehiclesSaved };
}

/**
 * Validate a distribution result for consistency
 */
export function validateDistribution(result: DistributionResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate employee assignments
    const allEmployeeIds = new Set<string>();
    for (const assignment of result.assignments) {
        for (const emp of assignment.employees) {
            if (allEmployeeIds.has(emp.id)) {
                errors.push(`Employee ${emp.id} assigned to multiple vehicles`);
            }
            allEmployeeIds.add(emp.id);
        }
    }

    // Check for over-capacity assignments
    for (const assignment of result.assignments) {
        if (assignment.employeeCount > assignment.capacity) {
            errors.push(`Vehicle ${assignment.vehicleName} over capacity: ${assignment.employeeCount}/${assignment.capacity}`);
        }
    }

    // Check utilization warnings
    for (const assignment of result.assignments) {
        if (assignment.utilization < 50) {
            warnings.push(`Vehicle ${assignment.vehicleName} low utilization: ${assignment.utilization}%`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate how many additional vehicles are needed
 */
export function calculateAdditionalVehiclesNeeded(
    employees: EmployeeLocation[],
    vehicles: Vehicle[]
): { needed: number; suggestion: string } {
    const totalDemand = employees.length;
    const totalCapacity = vehicles.filter(v => v.available).reduce((sum, v) => sum + v.capacity, 0);

    if (totalDemand <= totalCapacity) {
        return { needed: 0, suggestion: 'Current fleet is sufficient' };
    }

    const shortfall = totalDemand - totalCapacity;
    const avgCapacity = vehicles.length > 0
        ? Math.ceil(vehicles.reduce((sum, v) => sum + v.capacity, 0) / vehicles.length)
        : 4;

    const needed = Math.ceil(shortfall / avgCapacity);

    return {
        needed,
        suggestion: `Add ${needed} vehicle(s) with capacity ${avgCapacity}+ to accommodate all ${totalDemand} employees`,
    };
}

/**
 * Estimate time needed for a route based on distance and stops
 */
export function estimateRouteDuration(
    route: OptimizedRoute,
    avgSpeedKmh: number = 25, // Urban average
    stopTimeMinutes: number = 2
): { durationMinutes: number; startTime?: string; endTime?: string } {
    const travelTime = (route.totalDistance / avgSpeedKmh) * 60;
    const stopTime = route.stops.length * stopTimeMinutes;
    const durationMinutes = Math.ceil(travelTime + stopTime);

    return { durationMinutes };
}
