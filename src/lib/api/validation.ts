/**
 * API Input Validation
 * 
 * Validation utilities for API request payloads.
 */

import type { Coordinate, OptimizeRouteRequest, MultiClusterRequest, DistanceMatrixRequest } from './api-schemas';

// ============================================================================
// VALIDATION RESULT TYPE
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ============================================================================
// COORDINATE VALIDATION
// ============================================================================

export function isValidCoordinate(coord: unknown): coord is Coordinate {
    if (!coord || typeof coord !== 'object') return false;
    const c = coord as Record<string, unknown>;
    return (
        typeof c.lat === 'number' &&
        typeof c.lng === 'number' &&
        c.lat >= -90 && c.lat <= 90 &&
        c.lng >= -180 && c.lng <= 180
    );
}

export function validateCoordinate(coord: unknown, fieldName: string): string[] {
    const errors: string[] = [];
    if (!coord || typeof coord !== 'object') {
        errors.push(`${fieldName} must be an object with lat and lng properties`);
        return errors;
    }

    const c = coord as Record<string, unknown>;

    if (typeof c.lat !== 'number') {
        errors.push(`${fieldName}.lat must be a number`);
    } else if (c.lat < -90 || c.lat > 90) {
        errors.push(`${fieldName}.lat must be between -90 and 90`);
    }

    if (typeof c.lng !== 'number') {
        errors.push(`${fieldName}.lng must be a number`);
    } else if (c.lng < -180 || c.lng > 180) {
        errors.push(`${fieldName}.lng must be between -180 and 180`);
    }

    return errors;
}

// ============================================================================
// LOCATION VALIDATION
// ============================================================================

export function validateLocation(loc: unknown, fieldName: string): string[] {
    const errors = validateCoordinate(loc, fieldName);
    if (!loc || typeof loc !== 'object') return errors;

    const l = loc as Record<string, unknown>;

    if (typeof l.id !== 'string' || l.id.trim() === '') {
        errors.push(`${fieldName}.id must be a non-empty string`);
    }

    return errors;
}

// ============================================================================
// TIME STRING VALIDATION
// ============================================================================

export function isValidTimeString(time: string): boolean {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

export function validateTimeString(time: unknown, fieldName: string): string[] {
    const errors: string[] = [];
    if (typeof time !== 'string') {
        errors.push(`${fieldName} must be a string in HH:mm format`);
    } else if (!isValidTimeString(time)) {
        errors.push(`${fieldName} must be in HH:mm format (e.g., "08:00")`);
    }
    return errors;
}

// ============================================================================
// OPTIMIZE ROUTE REQUEST VALIDATION
// ============================================================================

export function validateOptimizeRouteRequest(input: unknown): ValidationResult {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
        return { valid: false, errors: ['Request body must be a JSON object'] };
    }

    const req = input as Record<string, unknown>;

    // Validate origin
    if (!req.origin) {
        errors.push('origin is required');
    } else {
        errors.push(...validateLocation(req.origin, 'origin'));
    }

    // Validate destinations
    if (!req.destinations) {
        errors.push('destinations is required');
    } else if (!Array.isArray(req.destinations)) {
        errors.push('destinations must be an array');
    } else if (req.destinations.length === 0) {
        errors.push('destinations must have at least one item');
    } else if (req.destinations.length > 500) {
        errors.push('destinations cannot exceed 500 items');
    } else {
        req.destinations.forEach((dest, i) => {
            errors.push(...validateLocation(dest, `destinations[${i}]`));
        });
    }

    // Validate tripType
    if (req.tripType && !['pickup', 'drop'].includes(req.tripType as string)) {
        errors.push('tripType must be "pickup" or "drop"');
    }

    // Validate constraints
    if (!req.constraints) {
        errors.push('constraints is required');
    } else if (typeof req.constraints !== 'object') {
        errors.push('constraints must be an object');
    } else {
        const constraints = req.constraints as Record<string, unknown>;

        if (!constraints.departureTime) {
            errors.push('constraints.departureTime is required');
        } else {
            errors.push(...validateTimeString(constraints.departureTime, 'constraints.departureTime'));
        }

        if (constraints.maxTotalDuration !== undefined) {
            if (typeof constraints.maxTotalDuration !== 'number' || constraints.maxTotalDuration <= 0) {
                errors.push('constraints.maxTotalDuration must be a positive number');
            }
        }

        if (constraints.bufferPerStop !== undefined) {
            if (typeof constraints.bufferPerStop !== 'number' || constraints.bufferPerStop < 0) {
                errors.push('constraints.bufferPerStop must be a non-negative number');
            }
        }
    }

    // Validate options (if provided)
    if (req.options !== undefined) {
        if (typeof req.options !== 'object') {
            errors.push('options must be an object');
        } else {
            const options = req.options as Record<string, unknown>;

            const validAlgorithms = ['nearest_neighbor', 'christofides', 'genetic', 'exhaustive', 'auto'];
            if (options.algorithm && !validAlgorithms.includes(options.algorithm as string)) {
                errors.push(`options.algorithm must be one of: ${validAlgorithms.join(', ')}`);
            }

            if (options.timeout !== undefined) {
                if (typeof options.timeout !== 'number' || options.timeout < 1000 || options.timeout > 300000) {
                    errors.push('options.timeout must be between 1000 and 300000 ms');
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

// ============================================================================
// MULTI-CLUSTER REQUEST VALIDATION
// ============================================================================

export function validateMultiClusterRequest(input: unknown): ValidationResult {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
        return { valid: false, errors: ['Request body must be a JSON object'] };
    }

    const req = input as Record<string, unknown>;

    // Validate office
    if (!req.office) {
        errors.push('office is required');
    } else {
        errors.push(...validateLocation(req.office, 'office'));
    }

    // Validate employees
    if (!req.employees) {
        errors.push('employees is required');
    } else if (!Array.isArray(req.employees)) {
        errors.push('employees must be an array');
    } else if (req.employees.length === 0) {
        errors.push('employees must have at least one item');
    } else {
        req.employees.forEach((emp, i) => {
            errors.push(...validateLocation(emp, `employees[${i}]`));
        });
    }

    // Validate cabs
    if (!req.cabs) {
        errors.push('cabs is required');
    } else if (!Array.isArray(req.cabs)) {
        errors.push('cabs must be an array');
    } else if (req.cabs.length === 0) {
        errors.push('cabs must have at least one item');
    } else {
        req.cabs.forEach((cab, i) => {
            const c = cab as Record<string, unknown>;
            if (!c.id || typeof c.id !== 'string') {
                errors.push(`cabs[${i}].id must be a non-empty string`);
            }
            if (typeof c.capacity !== 'number' || c.capacity <= 0) {
                errors.push(`cabs[${i}].capacity must be a positive number`);
            }
        });
    }

    return { valid: errors.length === 0, errors };
}

// ============================================================================
// DISTANCE MATRIX REQUEST VALIDATION
// ============================================================================

export function validateDistanceMatrixRequest(input: unknown): ValidationResult {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
        return { valid: false, errors: ['Request body must be a JSON object'] };
    }

    const req = input as Record<string, unknown>;

    // Validate coordinates
    if (!req.coordinates) {
        errors.push('coordinates is required');
    } else if (!Array.isArray(req.coordinates)) {
        errors.push('coordinates must be an array');
    } else if (req.coordinates.length < 2) {
        errors.push('coordinates must have at least 2 items');
    } else if (req.coordinates.length > 100) {
        errors.push('coordinates cannot exceed 100 items');
    } else {
        req.coordinates.forEach((coord, i) => {
            errors.push(...validateCoordinate(coord, `coordinates[${i}]`));
        });
    }

    return { valid: errors.length === 0, errors };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
