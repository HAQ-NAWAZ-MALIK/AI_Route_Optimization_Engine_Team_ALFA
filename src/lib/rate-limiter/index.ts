/**
 * In-Memory Rate Limiter
 * Simple rate limiting using memory (upgradeable to Redis)
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    /**
     * Check if a request is allowed and increment counter
     */
    async checkLimit(
        key: string,
        maxRequests: number,
        windowMs: number
    ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
        const now = Date.now();
        const entry = this.limits.get(key);

        // No entry or expired - create new
        if (!entry || entry.resetAt <= now) {
            const resetAt = now + windowMs;
            this.limits.set(key, { count: 1, resetAt });
            return {
                allowed: true,
                remaining: maxRequests - 1,
                resetAt,
            };
        }

        // Entry exists and not expired
        if (entry.count >= maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.resetAt,
            };
        }

        // Increment count
        entry.count++;
        this.limits.set(key, entry);

        return {
            allowed: true,
            remaining: maxRequests - entry.count,
            resetAt: entry.resetAt,
        };
    }

    /**
     * Clean up expired entries
     */
    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (entry.resetAt <= now) {
                this.limits.delete(key);
            }
        }
    }

    /**
     * Clear all limits (for testing)
     */
    clear() {
        this.limits.clear();
    }

    /**
     * Stop cleanup interval
     */
    destroy() {
        clearInterval(this.cleanupInterval);
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
