/**
 * MCP Server Configuration
 * Loads and validates environment variables with secure defaults
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load .env file
loadEnv();

// Configuration schema with validation
const configSchema = z.object({
    // Security
    apiKeys: z.string().transform(val => val.split(',').map(k => k.trim())).default(''),
    requireAuth: z.string().transform(val => val === 'true').default('true'),

    // HTTP Server
    http: z.object({
        port: z.number().int().min(1024).max(65535).default(3001),
        host: z.string().default('localhost'),
        enableCors: z.boolean().default(true),
        corsOrigins: z.array(z.string()).default([]),
    }),

    // Routing Services
    routing: z.object({
        osrmUrl: z.string().url().default('https://router.project-osrm.org'),
        mapboxToken: z.string().optional(),
        tomtomApiKey: z.string().optional(),
    }),

    // Optimization Limits
    optimization: z.object({
        maxLocations: z.number().int().min(1).max(500).default(100),
        maxCabs: z.number().int().min(1).max(100).default(50),
        timeout: z.number().int().min(1000).max(300000).default(30000),
    }),

    // Rate Limiting
    rateLimit: z.object({
        enabled: z.boolean().default(true),
        max: z.number().int().min(1).default(100),
        windowMinutes: z.number().int().min(1).default(15),
    }),

    // Logging
    logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        logRequests: z.boolean().default(true),
    }),
});

/**
 * Parse and validate configuration from environment
 */
function parseConfig() {
    const rawConfig = {
        apiKeys: process.env.MCP_API_KEYS || '',
        requireAuth: process.env.MCP_REQUIRE_AUTH || 'true',

        http: {
            port: parseInt(process.env.MCP_HTTP_PORT || '3001', 10),
            host: process.env.MCP_HTTP_HOST || 'localhost',
            enableCors: process.env.MCP_ENABLE_CORS === 'true',
            corsOrigins: process.env.MCP_CORS_ORIGINS?.split(',').map(o => o.trim()) || [],
        },

        routing: {
            osrmUrl: process.env.OSRM_SERVER_URL || 'https://router.project-osrm.org',
            mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
            tomtomApiKey: process.env.TOMTOM_API_KEY,
        },

        optimization: {
            maxLocations: parseInt(process.env.MAX_LOCATIONS || '100', 10),
            maxCabs: parseInt(process.env.MAX_CABS || '50', 10),
            timeout: parseInt(process.env.OPTIMIZATION_TIMEOUT || '30000', 10),
        },

        rateLimit: {
            enabled: process.env.ENABLE_RATE_LIMIT !== 'false',
            max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
            windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10),
        },

        logging: {
            level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
            logRequests: process.env.LOG_REQUESTS !== 'false',
        },
    };

    try {
        return configSchema.parse(rawConfig);
    } catch (error) {
        console.error('Configuration validation failed:', error);
        throw new Error('Invalid configuration. Check your .env file.');
    }
}

/**
 * Validated server configuration
 */
export const config = parseConfig();

/**
 * Validate API key
 */
export function isValidApiKey(key: string): boolean {
    if (!config.requireAuth) {
        return true; // Auth disabled (development only)
    }

    if (config.apiKeys.length === 0) {
        console.warn('WARNING: No API keys configured but authentication is required!');
        return false;
    }

    return config.apiKeys.includes(key);
}

/**
 * Get server info for logging
 */
export function getServerInfo() {
    return {
        name: 'AI Transport Optimizer MCP Server',
        version: '1.0.0',
        authEnabled: config.requireAuth,
        rateLimitEnabled: config.rateLimit.enabled,
        maxLocations: config.optimization.maxLocations,
        maxCabs: config.optimization.maxCabs,
    };
}
