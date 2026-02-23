/**
 * Platform Configuration Service
 * 
 * Reads/writes platform-wide settings from the database.
 * Uses in-memory cache with 30s TTL so admin changes propagate quickly
 * without hitting the DB on every API request.
 */

import { prisma } from '@/lib/db/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface TierRateLimits {
    requestsPerDay: number;
    requestsPerMinute: number;
    maxDestinations: number;
}

export interface PlanQuotas {
    requestsPerMonth: number;
    maxLocations: number;
    maxCabs: number;
}

export interface FeatureFlags {
    signup: boolean;
    oauth: boolean;
    trial: boolean;
    webhooks: boolean;
    aiFeatures: boolean;
}

export interface MaintenanceConfig {
    enabled: boolean;
    message: string;
}

export interface PlatformConfigData {
    tierLimits: Record<string, TierRateLimits>;
    planLimits: Record<string, PlanQuotas>;
    features: FeatureFlags;
    maintenance: MaintenanceConfig;
}

// ============================================================================
// DEFAULTS (fallback when DB has no config yet)
// ============================================================================

export const DEFAULT_CONFIG: PlatformConfigData = {
    tierLimits: {
        free: { requestsPerDay: 100, requestsPerMinute: 10, maxDestinations: 20 },
        pro: { requestsPerDay: 1000, requestsPerMinute: 60, maxDestinations: 100 },
        enterprise: { requestsPerDay: -1, requestsPerMinute: -1, maxDestinations: 500 },
    },
    planLimits: {
        FREE: { requestsPerMonth: 100, maxLocations: 10, maxCabs: 2 },
        TRIAL: { requestsPerMonth: 1000, maxLocations: 50, maxCabs: 10 },
        PRO: { requestsPerMonth: 10000, maxLocations: 100, maxCabs: 50 },
        ENTERPRISE: { requestsPerMonth: -1, maxLocations: 500, maxCabs: 200 },
    },
    features: {
        signup: true,
        oauth: true,
        trial: true,
        webhooks: false,
        aiFeatures: true,
    },
    maintenance: {
        enabled: false,
        message: '',
    },
};

// ============================================================================
// CACHE
// ============================================================================

let cachedConfig: PlatformConfigData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

function isCacheValid(): boolean {
    return cachedConfig !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

export function clearConfigCache(): void {
    cachedConfig = null;
    cacheTimestamp = 0;
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get the full platform config. Reads from cache if fresh, else from DB.
 * Falls back to DEFAULT_CONFIG if no DB row exists.
 */
export async function getConfig(): Promise<PlatformConfigData> {
    if (isCacheValid()) {
        return cachedConfig!;
    }

    try {
        const row = await prisma.platformConfig.findUnique({
            where: { id: 'platform_config' },
        });

        if (row) {
            cachedConfig = row.config as unknown as PlatformConfigData;
        } else {
            cachedConfig = { ...DEFAULT_CONFIG };
        }
    } catch (error) {
        console.error('Failed to read platform config from DB, using defaults:', error);
        cachedConfig = { ...DEFAULT_CONFIG };
    }

    cacheTimestamp = Date.now();
    return cachedConfig!;
}

/**
 * Get rate limits for a specific API tier.
 */
export async function getEffectiveTierLimits(tier: string): Promise<TierRateLimits> {
    const config = await getConfig();
    return config.tierLimits[tier] || DEFAULT_CONFIG.tierLimits.free;
}

/**
 * Get plan quotas for a specific subscription plan.
 */
export async function getEffectivePlanLimits(plan: string): Promise<PlanQuotas> {
    const config = await getConfig();
    return config.planLimits[plan] || DEFAULT_CONFIG.planLimits.FREE;
}

/**
 * Get feature flags.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
    const config = await getConfig();
    return config.features;
}

/**
 * Get maintenance status.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceConfig> {
    const config = await getConfig();
    return config.maintenance;
}

// ============================================================================
// WRITE
// ============================================================================

/**
 * Update platform config by merging a partial patch with the existing config.
 * Clears the cache so next read picks up the new values.
 */
export async function updateConfig(
    patch: Partial<PlatformConfigData>,
    adminUserId?: string
): Promise<PlatformConfigData> {
    const current = await getConfig();

    // Deep merge: replace whole sub-objects when provided
    const updated: PlatformConfigData = {
        tierLimits: patch.tierLimits
            ? { ...current.tierLimits, ...patch.tierLimits }
            : current.tierLimits,
        planLimits: patch.planLimits
            ? { ...current.planLimits, ...patch.planLimits }
            : current.planLimits,
        features: patch.features
            ? { ...current.features, ...patch.features }
            : current.features,
        maintenance: patch.maintenance
            ? { ...current.maintenance, ...patch.maintenance }
            : current.maintenance,
    };

    await prisma.platformConfig.upsert({
        where: { id: 'platform_config' },
        create: {
            id: 'platform_config',
            config: updated as unknown as Record<string, unknown>,
            updatedBy: adminUserId,
        },
        update: {
            config: updated as unknown as Record<string, unknown>,
            updatedBy: adminUserId,
        },
    });

    // Clear cache so everyone picks up new config within next request
    clearConfigCache();

    return updated;
}
