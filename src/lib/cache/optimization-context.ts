/**
 * Optimization Context
 * 
 * Provides explicit state passing for stateless architecture.
 * Enables horizontal scaling by avoiding module-level state.
 */

import type { Coordinate } from '../ai-engine/types';

// ============================================================================
// CONTEXT INTERFACE
// ============================================================================

/**
 * OptimizationContext for stateless function calls
 * All state is passed explicitly through this context
 */
export interface OptimizationContext {
    /** Unique request identifier for tracking */
    requestId: string;

    /** Pre-computed distance matrix (km) - avoid recalculation */
    distanceMatrix?: number[][];

    /** Pre-computed duration matrix (minutes) */
    durationMatrix?: number[][];

    /** Cache reference for reuse across calls */
    cache?: OptimizationCache;

    /** Timestamp when the request started */
    startTime?: number;

    /** Maximum allowed processing time (ms) */
    timeout?: number;
}

/**
 * Cache interface for optimization data
 */
export interface OptimizationCache {
    /** Get cached distance matrix */
    getDistanceMatrix(coordinates: Coordinate[]): Promise<number[][] | null>;

    /** Cache distance matrix */
    setDistanceMatrix(coordinates: Coordinate[], matrix: number[][]): Promise<void>;

    /** Get cached route segment */
    getRouteSegment(from: Coordinate, to: Coordinate): Promise<CachedSegment | null>;

    /** Cache route segment */
    setRouteSegment(from: Coordinate, to: Coordinate, segment: CachedSegment): Promise<void>;
}

/**
 * Cached route segment data
 */
export interface CachedSegment {
    geometry: string;
    distance: number;  // km
    duration: number;  // minutes
}

// ============================================================================
// CONTEXT FACTORY
// ============================================================================

/**
 * Create a new optimization context with a unique request ID
 */
export function createOptimizationContext(
    options: Partial<OptimizationContext> = {}
): OptimizationContext {
    return {
        requestId: options.requestId || generateRequestId(),
        distanceMatrix: options.distanceMatrix,
        durationMatrix: options.durationMatrix,
        cache: options.cache,
        startTime: options.startTime || Date.now(),
        timeout: options.timeout,
    };
}

/**
 * Check if the context has timed out
 */
export function isContextTimedOut(context: OptimizationContext): boolean {
    if (!context.timeout || !context.startTime) return false;
    return Date.now() - context.startTime > context.timeout;
}

/**
 * Get remaining time in the context before timeout
 */
export function getRemainingTime(context: OptimizationContext): number {
    if (!context.timeout || !context.startTime) return Infinity;
    return Math.max(0, context.timeout - (Date.now() - context.startTime));
}

// ============================================================================
// HELPERS
// ============================================================================

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
