/**
 * Rate Limiter
 * 
 * Sliding window rate limiting with dynamic tier support.
 * Limits are passed in from the caller (loaded from DB config).
 */

import type { TierLimits } from './api-keys';

// ============================================================================
// TYPES
// ============================================================================

interface RateLimitEntry {
    timestamps: number[];
    dailyCount: number;
    dailyResetAt: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
    private store = new Map<string, RateLimitEntry>();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor() {
        // Cleanup old entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if a request is allowed and update counters.
     * Limits are passed in dynamically (from DB config or defaults).
     */
    check(key: string, limits: TierLimits): RateLimitResult {
        const now = Date.now();
        const minuteAgo = now - 60000;
        const dayStart = new Date().setHours(0, 0, 0, 0);

        // Get or create entry
        let entry = this.store.get(key);
        if (!entry || entry.dailyResetAt < dayStart) {
            entry = {
                timestamps: [],
                dailyCount: 0,
                dailyResetAt: dayStart + 86400000, // Tomorrow
            };
            this.store.set(key, entry);
        }

        // Clean old timestamps (older than 1 minute)
        entry.timestamps = entry.timestamps.filter(t => t > minuteAgo);

        // Check minute limit
        if (entry.timestamps.length >= limits.requestsPerMinute) {
            const oldestInWindow = entry.timestamps[0];
            const retryAfter = Math.ceil((oldestInWindow + 60000 - now) / 1000);
            return {
                allowed: false,
                remaining: 0,
                resetAt: oldestInWindow + 60000,
                retryAfter,
            };
        }

        // Check daily limit
        if (entry.dailyCount >= limits.requestsPerDay) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.dailyResetAt,
                retryAfter: Math.ceil((entry.dailyResetAt - now) / 1000),
            };
        }

        // Allow request and record
        entry.timestamps.push(now);
        entry.dailyCount++;

        return {
            allowed: true,
            remaining: Math.min(
                limits.requestsPerMinute - entry.timestamps.length,
                limits.requestsPerDay - entry.dailyCount
            ),
            resetAt: entry.dailyResetAt,
        };
    }

    /**
     * Get current usage for a key
     */
    getUsage(key: string): { minuteCount: number; dailyCount: number } | null {
        const entry = this.store.get(key);
        if (!entry) return null;

        const minuteAgo = Date.now() - 60000;
        const recentTimestamps = entry.timestamps.filter(t => t > minuteAgo);

        return {
            minuteCount: recentTimestamps.length,
            dailyCount: entry.dailyCount,
        };
    }

    /**
     * Reset limits for a key
     */
    reset(key: string): void {
        this.store.delete(key);
    }

    /**
     * Cleanup old entries
     */
    private cleanup(): void {
        const dayStart = new Date().setHours(0, 0, 0, 0);
        for (const [key, entry] of this.store.entries()) {
            if (entry.dailyResetAt < dayStart) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Destroy the rate limiter
     */
    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
    if (!rateLimiter) {
        rateLimiter = new RateLimiter();
    }
    return rateLimiter;
}

export type { RateLimitResult };
