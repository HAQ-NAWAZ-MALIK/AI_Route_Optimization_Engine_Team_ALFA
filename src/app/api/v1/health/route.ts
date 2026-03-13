/**
 * Health Check API Endpoint
 * 
 * GET /api/v1/health
 * Returns comprehensive service status including memory, cache, and dependencies.
 */

import { NextResponse } from 'next/server';
import type { HealthResponse } from '@/lib/api/api-schemas';
import { getGlobalCache } from '@/lib/cache/cache-layer';

// Store startup time for uptime calculation
const startupTime = Date.now();

export async function GET(): Promise<NextResponse<HealthResponse>> {
    const uptimeSeconds = Math.floor((Date.now() - startupTime) / 1000);

    // Get memory usage
    let memoryUsage: { heapUsed: number; heapTotal: number; rss: number } | undefined;
    try {
        const mem = process.memoryUsage();
        memoryUsage = {
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024), // MB
            rss: Math.round(mem.rss / 1024 / 1024), // MB
        };
    } catch {
        // Memory info not available
    }

    // Get cache stats
    let cacheStats: { entries: number; maxEntries: number } | undefined;
    try {
        const cache = getGlobalCache();
        cacheStats = cache.getStats();
    } catch {
        // Cache not available
    }

    // Check OSRM availability (optional)
    let osrmAvailable = false;
    try {
        const osrmResponse = await fetch(`${process.env.OSRM_URL || 'https://router.project-osrm.org'}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
        });
        osrmAvailable = osrmResponse.ok;
    } catch {
        // OSRM not available, that's okay
    }

    const response: HealthResponse = {
        status: 'ok',
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: uptimeSeconds,
        services: {
            optimizer: true,
            osrm: osrmAvailable,
            cache: cacheStats ? true : false,
        },
        // Extended info (optional)
        memory: memoryUsage,
        cache: cacheStats,
    };

    return NextResponse.json(response);
}
