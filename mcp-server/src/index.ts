#!/usr/bin/env node
/**
 * MCP Server Entry Point (stdio transport)
 * This server communicates via stdio and is designed for local LLM clients like Claude Desktop
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { config, isValidApiKey, getServerInfo } from './config.js';
import { logger } from './logger.js';
import { MCPError, ErrorCode, handleError } from './errors.js';
import {
    optimizeRouteSchema,
    optimizeMultiClusterSchema,
    calculateDistanceMatrixSchema,
} from './schemas/tool-schemas.js';
import {
    handleOptimizeRoute,
    handleOptimizeMultiCluster,
    handleCalculateDistanceMatrix,
} from './tools/handlers.js';

/**
 * Initialize MCP Server
 */
const server = new Server(
    {
        name: 'ai-transport-optimizer',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
            resources: {},
        },
    }
);

/**
 * Tool definitions
 */
const tools = [
    {
        name: 'optimize_route',
        description: `Optimize a route for employee pickup or drop operations. 
    
This tool finds the most efficient sequence to visit multiple locations (e.g., employee homes) 
starting from an origin point (e.g., office). It uses advanced algorithms to minimize total 
distance and travel time while respecting time constraints.

Use this for:
- Planning employee pickup routes
- Optimizing delivery sequences
- Scheduling service visits

The tool supports:
- **Auto mode (default)**: Runs ALL algorithms in parallel and returns the best result with comparison
- Multiple optimization algorithms (Christofides, Genetic, Nearest Neighbor, Dijkstra, BMSSP, Exhaustive)
- Algorithm comparison showing performance of each method
- Real road network routing via OSRM
- Time window constraints
- Traffic consideration (requires API key)

When using auto mode (or no algorithm specified), you get:
- The best route found across all 6 algorithms
- A comparison of all algorithm performances
- The winning algorithm name and summary`,
        inputSchema: optimizeRouteSchema,
    },
    {
        name: 'optimize_multi_cluster',
        description: `Optimize routes for multiple vehicles with intelligent employee clustering.

This tool solves the "multi-vehicle routing problem" by:
1. Clustering employees geographically based on cab capacities
2. Assigning cabs to clusters to minimize total travel distance
3. Providing optimized employee-to-cab assignments

Use this for:
- Planning multi-cab employee transportation
- Fleet routing optimization
- Resource allocation for distributed pickups

The tool handles:
- Capacity constraints (ensures no cab is overloaded)
- Geographic clustering (groups nearby employees)
- Balance optimization (distributes load evenly)
- Overflow detection (warns if capacity insufficient)`,
        inputSchema: optimizeMultiClusterSchema,
    },
    {
        name: 'calculate_distance_matrix',
        description: `Calculate pairwise distances and travel times between multiple locations.

This tool generates a distance matrix showing the distance and travel time between every 
pair of locations. Useful for:
- Analyzing travel costs between locations
- Preprocessing data for custom optimization
- Comparing different route options
- Understanding geographic spread of locations

Supports:
- Real road network distances via OSRM (accounts for actual roads)
- Straight-line (haversine) distance calculation
- Both distance (km) and duration (minutes) matrices`,
        inputSchema: calculateDistanceMatrixSchema,
    },
];

/**
 * Register tool listing handler
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Tools listing requested');
    return { tools };
});

/**
 * Register tool execution handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const requestId = crypto.randomUUID();

    try {
        // Authentication check (for HTTP, not needed for stdio in most cases)
        // But we support it for consistency
        const apiKey = (request.params as any)._meta?.apiKey;
        if (config.requireAuth && apiKey && !isValidApiKey(apiKey)) {
            throw new MCPError(ErrorCode.ResourceAccessDenied, 'Invalid API key');
        }

        const { name, arguments: args } = request.params;

        logger.info(`Tool execution: ${name}`, { requestId });

        // Route to appropriate handler
        switch (name) {
            case 'optimize_route':
                return await handleOptimizeRoute(args, requestId);

            case 'optimize_multi_cluster':
                return await handleOptimizeMultiCluster(args, requestId);

            case 'calculate_distance_matrix':
                return await handleCalculateDistanceMatrix(args, requestId);

            default:
                throw new MCPError(
                    ErrorCode.ToolNotFound,
                    `Unknown tool: ${name}`
                );
        }

    } catch (error) {
        const mcpError = handleError(error);
        logger.error('Tool execution failed', mcpError);
        throw mcpError;
    }
});

/**
 * Register resources handler
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Resources listing requested');

    return {
        resources: [
            {
                uri: 'algorithm://info',
                name: 'Algorithm Information',
                description: 'Details about available optimization algorithms',
                mimeType: 'text/markdown',
            },
            {
                uri: 'capabilities://server',
                name: 'Server Capabilities',
                description: 'Server limits and supported features',
                mimeType: 'application/json',
            },
            {
                uri: 'examples://usage',
                name: 'Usage Examples',
                description: 'Example tool calls for common scenarios',
                mimeType: 'text/markdown',
            },
        ],
    };
});

/**
 * Start the server
 */
async function main() {
    const serverInfo = getServerInfo();

    logger.info('Starting AI Transport Optimizer MCP Server', {
        ...serverInfo,
        transport: 'stdio',
    });

    // Validate configuration
    if (config.requireAuth && config.apiKeys.length === 0) {
        logger.warn('⚠️  Authentication is enabled but no API keys are configured!');
        logger.warn('⚠️  Set MCP_API_KEYS in .env file or disable auth with MCP_REQUIRE_AUTH=false');
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('✅ MCP Server ready (stdio transport)');
    logger.info('Listening for requests from MCP clients...');
}

// Error handling
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
    process.exit(1);
});

// Start server
main().catch((error) => {
    logger.error('Failed to start server', error);
    process.exit(1);
});
