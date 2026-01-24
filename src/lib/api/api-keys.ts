/**
 * API Key Management
 * 
 * Handles API key generation, validation, and tier management.
 * Supports both in-memory demo keys and database-backed portal keys.
 */

import { getEffectiveTierLimits as getDbTierLimits } from '@/lib/config/platform-config';

import { prisma } from '../db/prisma';
import { verifyApiKey as verifyKeyHash } from '../api-keys/generator';

// ============================================================================
// TYPES
// ============================================================================

export type ApiTier = 'free' | 'pro' | 'enterprise';

export interface ApiKeyInfo {
    key: string;
    tier: ApiTier;
    createdAt: Date;
    lastUsedAt?: Date;
    requestCount: number;
    name?: string;
    email?: string;
}

export interface TierLimits {
    requestsPerDay: number;
    requestsPerMinute: number;
    maxDestinations: number;
    features: string[];
}

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

export const TIER_LIMITS: Record<ApiTier, TierLimits> = {
    free: {
        requestsPerDay: 100,
        requestsPerMinute: 10,
        maxDestinations: 20,
        features: ['route_optimization', 'distance_matrix'],
    },
    pro: {
        requestsPerDay: 1000,
        requestsPerMinute: 60,
        maxDestinations: 100,
        features: ['route_optimization', 'distance_matrix', 'multi_cluster', 'traffic'],
    },
    enterprise: {
        requestsPerDay: Infinity,
        requestsPerMinute: Infinity,
        maxDestinations: 500,
        features: ['route_optimization', 'distance_matrix', 'multi_cluster', 'traffic', 'batch', 'priority_support'],
    },
};

// ============================================================================
// API KEY STORE (In-memory for demo, use database in production)
// ============================================================================

const apiKeyStore = new Map<string, ApiKeyInfo>();

// Default demo keys
const DEMO_KEYS: ApiKeyInfo[] = [
    {
        key: 'demo_free_key_12345',
        tier: 'free',
        createdAt: new Date(),
        requestCount: 0,
        name: 'Demo Free User',
    },
    {
        key: 'demo_pro_key_67890',
        tier: 'pro',
        createdAt: new Date(),
        requestCount: 0,
        name: 'Demo Pro User',
    },
    {
        key: 'demo_enterprise_key_abcde',
        tier: 'enterprise',
        createdAt: new Date(),
        requestCount: 0,
        name: 'Demo Enterprise User',
    },
];

// Initialize demo keys
DEMO_KEYS.forEach(key => apiKeyStore.set(key.key, key));

// ============================================================================
// KEY MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Generate a new API key
 */
export function generateApiKey(tier: ApiTier = 'free', options?: { name?: string; email?: string }): ApiKeyInfo {
    const key = `${tier}_${Date.now()}_${generateRandomString(16)}`;
    const info: ApiKeyInfo = {
        key,
        tier,
        createdAt: new Date(),
        requestCount: 0,
        name: options?.name,
        email: options?.email,
    };
    apiKeyStore.set(key, info);
    return info;
}

/**
 * Validate an API key and return its info
 * Checks both in-memory demo keys and database portal keys
 */
export async function validateApiKey(key: string): Promise<ApiKeyInfo | null> {
    // Development mode bypass disabled for proper testing
    // Uncomment below for local development convenience
    // if (process.env.NODE_ENV === 'development' && !key) {
    //     return {
    //         key: 'development',
    //         tier: 'enterprise',
    //         createdAt: new Date(),
    //         requestCount: 0,
    //         name: 'Development Mode',
    //     };
    // }

    // Check in-memory demo keys first
    const demoKey = apiKeyStore.get(key);
    if (demoKey) {
        return demoKey;
    }

    // Check database portal keys
    try {
        const prefix = key.substring(0, 12); // First 12 chars to match generator

        const dbKey = await prisma.apiKey.findFirst({
            where: { prefix },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true,
                        subscriptions: {
                            where: { status: 'ACTIVE' },
                            select: { plan: true },
                            take: 1,
                        },
                    },
                },
            },
        });

        if (!dbKey) {
            return null;
        }

        // Verify hash
        const isValid = await verifyKeyHash(key, dbKey.keyHash);
        if (!isValid) {
            return null;
        }

        // Check expiration
        if (dbKey.expiresAt && dbKey.expiresAt < new Date()) {
            return null;
        }

        // Map subscription plan to API tier
        const plan = dbKey.user.subscriptions[0]?.plan || 'FREE';
        const tier: ApiTier = plan === 'ENTERPRISE' ? 'enterprise' : plan === 'PRO' ? 'pro' : 'free';

        // Update last used
        await prisma.apiKey.update({
            where: { id: dbKey.id },
            data: { lastUsedAt: new Date() },
        });

        return {
            key,
            tier,
            createdAt: dbKey.createdAt,
            lastUsedAt: dbKey.lastUsedAt || undefined,
            requestCount: 0, // Could track this in DB
            name: dbKey.user.name || undefined,
            email: dbKey.user.email,
        };
    } catch (error) {
        console.error('Database key validation error:', error);
        return null;
    }
}

/**
 * Get effective tier limits (reads from DB config with fallback to hardcoded defaults)
 */
export async function getEffectiveLimitsForTier(tier: ApiTier): Promise<TierLimits> {
    try {
        const dbLimits = await getDbTierLimits(tier);
        return {
            requestsPerDay: dbLimits.requestsPerDay,
            requestsPerMinute: dbLimits.requestsPerMinute,
            maxDestinations: dbLimits.maxDestinations,
            features: TIER_LIMITS[tier]?.features || [],
        };
    } catch {
        return TIER_LIMITS[tier] || TIER_LIMITS.free;
    }
}

/**
 * Get tier limits for a key
 */
export async function getKeyLimits(key: string): Promise<TierLimits | null> {
    const info = await validateApiKey(key);
    if (!info) return null;
    return getEffectiveLimitsForTier(info.tier);
}

/**
 * Update key usage
 */
export function recordKeyUsage(key: string): void {
    const info = apiKeyStore.get(key);
    if (info) {
        info.lastUsedAt = new Date();
        info.requestCount++;
    }
}

/**
 * Get all keys (admin function)
 */
export function getAllKeys(): ApiKeyInfo[] {
    return Array.from(apiKeyStore.values());
}

/**
 * Revoke an API key
 */
export function revokeApiKey(key: string): boolean {
    return apiKeyStore.delete(key);
}

// ============================================================================
// HELPERS
// ============================================================================

function generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
