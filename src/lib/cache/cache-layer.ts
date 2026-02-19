/**
 * Multi-Tier Caching Layer
 * 
 * Provides caching for expensive operations:
 * - L1: In-memory cache with TTL (always available)
 * - L2: Optional Redis cache for distributed caching
 * 
 * Caches:
 * - Distance/duration matrices (expensive OSRM calls)
 * - Route segments (geometry, distance, duration)
 * - Optimization results (for identical inputs)
 */

import type { Coordinate } from '../ai-engine/types';
import type { OptimizationCache, CachedSegment } from './optimization-context';

// Simple hash function (no crypto dependency - works in browser/edge)
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface CacheConfig {
    /** Local cache TTL in seconds (default: 300 = 5 minutes) */
    localTTL?: number;

    /** Redis cache TTL in seconds (default: 86400 = 24 hours) */
    redisTTL?: number;

    /** Maximum entries in local cache (default: 1000) */
    maxLocalEntries?: number;

    /** Redis connection URL (optional) */
    redisUrl?: string;
}

// ============================================================================
// CACHE ENTRY
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiry: number;
}

// ============================================================================
// OPTIMIZATION CACHE IMPLEMENTATION
// ============================================================================

/**
 * Multi-tier cache for optimization data
 */
export class OptimizationCacheImpl implements OptimizationCache {
    private localCache = new Map<string, CacheEntry<unknown>>();
    private config: Required<Omit<CacheConfig, 'redisUrl'>> & { redisUrl?: string };
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor(config: CacheConfig = {}) {
        this.config = {
            localTTL: config.localTTL ?? 300,
            redisTTL: config.redisTTL ?? 86400,
            maxLocalEntries: config.maxLocalEntries ?? 1000,
            redisUrl: config.redisUrl,
        };

        // Start periodic cleanup
        this.startCleanup();
    }

    // ========================================================================
    // DISTANCE MATRIX CACHING
    // ========================================================================

    async getDistanceMatrix(coordinates: Coordinate[]): Promise<number[][] | null> {
        const key = this.matrixKey(coordinates);
        return this.get<number[][]>(key);
    }

    async setDistanceMatrix(coordinates: Coordinate[], matrix: number[][]): Promise<void> {
        const key = this.matrixKey(coordinates);
        await this.set(key, matrix);
    }

    // ========================================================================
    // ROUTE SEGMENT CACHING
    // ========================================================================

    async getRouteSegment(from: Coordinate, to: Coordinate): Promise<CachedSegment | null> {
        const key = this.segmentKey(from, to);
        return this.get<CachedSegment>(key);
    }

    async setRouteSegment(from: Coordinate, to: Coordinate, segment: CachedSegment): Promise<void> {
        const key = this.segmentKey(from, to);
        await this.set(key, segment);
    }

    // ========================================================================
    // GENERIC CACHE OPERATIONS
    // ========================================================================

    /**
     * Get value from cache (L1 first, then L2)
     */
    private async get<T>(key: string): Promise<T | null> {
        // L1: Local memory cache
        const local = this.localCache.get(key);
        if (local && local.expiry > Date.now()) {
            return local.data as T;
        }

        // L1 miss or expired - try L2 (Redis) if available
        // Note: Redis implementation would go here
        // For now, we only have L1 cache

        return null;
    }

    /**
     * Set value in cache (both L1 and L2)
     */
    private async set<T>(key: string, data: T): Promise<void> {
        // Enforce max entries (LRU eviction)
        if (this.localCache.size >= this.config.maxLocalEntries) {
            this.evictOldest();
        }

        // L1: Local memory cache
        this.localCache.set(key, {
            data,
            expiry: Date.now() + this.config.localTTL * 1000,
        });

        // L2: Redis (if available)
        // Note: Redis implementation would go here
    }

    // ========================================================================
    // KEY GENERATION
    // ========================================================================

    /**
     * Generate cache key for a distance matrix
     */
    private matrixKey(coordinates: Coordinate[]): string {
        const hash = this.hashCoordinates(coordinates);
        return `matrix:${hash}`;
    }

    /**
     * Generate cache key for a route segment
     */
    private segmentKey(from: Coordinate, to: Coordinate): string {
        const fromHash = this.hashCoordinate(from);
        const toHash = this.hashCoordinate(to);
        return `segment:${fromHash}:${toHash}`;
    }

    /**
     * Hash a single coordinate to a string
     */
    private hashCoordinate(coord: Coordinate): string {
        // Round to 5 decimal places (~1m precision) for cache hits
        const lat = coord.lat.toFixed(5);
        const lng = coord.lng.toFixed(5);
        return `${lat},${lng}`;
    }

    /**
     * Hash multiple coordinates to a string
     */
    private hashCoordinates(coordinates: Coordinate[]): string {
        const str = coordinates.map(c => this.hashCoordinate(c)).join('|');
        return simpleHash(str);
    }

    // ========================================================================
    // CACHE MANAGEMENT
    // ========================================================================

    /**
     * Start periodic cleanup of expired entries
     */
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Every minute
    }

    /**
     * Stop periodic cleanup
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.localCache.clear();
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.localCache.entries()) {
            if (entry.expiry <= now) {
                this.localCache.delete(key);
            }
        }
    }

    /**
     * Evict oldest entry (simple LRU approximation)
     */
    private evictOldest(): void {
        const oldestKey = this.localCache.keys().next().value;
        if (oldestKey) {
            this.localCache.delete(oldestKey);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): { entries: number; maxEntries: number } {
        return {
            entries: this.localCache.size,
            maxEntries: this.config.maxLocalEntries,
        };
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.localCache.clear();
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalCache: OptimizationCacheImpl | null = null;

/**
 * Get the global cache instance
 */
export function getGlobalCache(): OptimizationCacheImpl {
    if (!globalCache) {
        globalCache = new OptimizationCacheImpl({
            localTTL: parseInt(process.env.CACHE_LOCAL_TTL || '300'),
            redisTTL: parseInt(process.env.CACHE_REDIS_TTL || '86400'),
            maxLocalEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '1000'),
            redisUrl: process.env.REDIS_URL,
        });
    }
    return globalCache;
}

/**
 * Create a new cache instance with custom config
 */
export function createCache(config: CacheConfig = {}): OptimizationCacheImpl {
    return new OptimizationCacheImpl(config);
}
