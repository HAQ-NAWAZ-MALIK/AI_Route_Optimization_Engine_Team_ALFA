/**
 * HTTP MCP Server
 * Provides remote access to MCP tools via HTTP + Server-Sent Events
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isValidApiKey, getServerInfo } from './config.js';
import { logger } from './logger.js';
import { MCPError, ErrorCode, handleError } from './errors.js';
import { TOOL_NAMES, callToolByName } from './tools/dispatcher.js';
import {
    optimizeRouteSchema,
    optimizeMultiClusterSchema,
    calculateDistanceMatrixSchema,
} from './schemas/tool-schemas.js';

const app = express();

type ToolResultContent = {
    type?: string;
    text?: string;
};

function parseToolResult(result: unknown): unknown {
    if (!result || typeof result !== 'object' || !('content' in result)) {
        return result;
    }

    const content = (result as { content?: ToolResultContent[] }).content;
    const textContent = content?.find(contentItem => contentItem.type === 'text')?.text;

    if (!textContent) {
        return result;
    }

    try {
        return JSON.parse(textContent);
    } catch {
        return textContent;
    }
}

function assertJsonRpcObject(value: unknown): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new MCPError(ErrorCode.InvalidParams, 'JSON-RPC params must be an object');
    }
}

/**
 * Middleware: JSON body parser
 */
app.use(express.json({ limit: '10mb' }));

/**
 * Middleware: CORS
 */
if (config.http.enableCors) {
    const hasExplicitOrigins = config.http.corsOrigins.length > 0;
    const corsOptions = {
        origin: hasExplicitOrigins
            ? config.http.corsOrigins
            : '*',
        credentials: hasExplicitOrigins,
    };
    app.use(cors(corsOptions));
    logger.info('CORS enabled', { origins: corsOptions.origin });
}

/**
 * Middleware: Rate limiting
 */
if (config.rateLimit.enabled) {
    const limiter = rateLimit({
        windowMs: config.rateLimit.windowMinutes * 60 * 1000,
        max: config.rateLimit.max,
        message: 'Too many requests, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/api/', limiter);
    logger.info('Rate limiting enabled', {
        max: config.rateLimit.max,
        window: `${config.rateLimit.windowMinutes}min`,
    });
}

/**
 * Middleware: Authentication
 */
function getApiKey(req: Request): string | undefined {
    const headerApiKey = req.header('x-api-key');
    if (headerApiKey) {
        return headerApiKey;
    }

    const queryApiKey = req.query.key;
    if (typeof queryApiKey === 'string') {
        return queryApiKey;
    }

    return undefined;
}

function authenticate(req: Request, res: Response, next: NextFunction) {
    if (!config.requireAuth) {
        return next(); // Auth disabled
    }

    const apiKey = getApiKey(req);

    if (!apiKey) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Missing API key. Provide X-API-Key header or key query parameter.',
        });
    }

    if (!isValidApiKey(apiKey)) {
        logger.warn('Invalid API key attempt', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        return res.status(403).json({
            error: 'Authentication failed',
            message: 'Invalid API key',
        });
    }

    next();
}

/**
 * Middleware: Request logging
 */
app.use((req, res, next) => {
    if (config.logging.logRequests) {
        logger.info(`${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.headers['user-agent']?.substring(0, 100),
        });
    }
    next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: getServerInfo(),
    });
});

/**
 * Server info endpoint
 */
app.get('/api/info', (req, res) => {
    res.json({
        ...getServerInfo(),
        tools: TOOL_NAMES,
        transport: 'http',
    });
});

/**
 * List tools endpoint
 */
app.get('/api/tools', authenticate, (req, res) => {
    res.json({
        tools: [
            {
                name: 'optimize_route',
                description: 'Optimize a route for employee pickup or drop operations',
                inputSchema: optimizeRouteSchema,
            },
            {
                name: 'optimize_multi_cluster',
                description: 'Optimize routes for multiple vehicles with clustering',
                inputSchema: optimizeMultiClusterSchema,
            },
            {
                name: 'calculate_distance_matrix',
                description: 'Calculate pairwise distances between locations',
                inputSchema: calculateDistanceMatrixSchema,
            },
        ],
    });
});

/**
 * Execute tool endpoint
 */
app.post('/api/tools/:toolName', authenticate, async (req, res) => {
    const requestId = crypto.randomUUID();
    const { toolName } = req.params;
    const args = req.body;

    try {
        const result = await callToolByName(toolName, args, requestId);

        res.json({
            requestId,
            result: parseToolResult(result),
        });

    } catch (error) {
        const mcpError = handleError(error);
        logger.error('Tool execution failed', mcpError, { requestId });

        res.status(mcpError.code === ErrorCode.InvalidParams ? 400 : 500).json({
            requestId,
            error: mcpError.toJSON(),
        });
    }
});

/**
 * MCP endpoint (JSON-RPC 2.0 compatible)
 * This endpoint follows the MCP HTTP transport specification
 */
app.post('/mcp', authenticate, async (req, res) => {
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== '2.0') {
        return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
                code: ErrorCode.InvalidRequest,
                message: 'Invalid JSON-RPC version',
            },
        });
    }

    const requestId = crypto.randomUUID();

    try {
        let result;

        switch (method) {
            case 'tools/list':
                result = {
                    tools: [
                        { name: 'optimize_route', description: 'Optimize route', inputSchema: optimizeRouteSchema },
                        { name: 'optimize_multi_cluster', description: 'Multi-vehicle optimization', inputSchema: optimizeMultiClusterSchema },
                        { name: 'calculate_distance_matrix', description: 'Calculate distance matrix', inputSchema: calculateDistanceMatrixSchema },
                    ],
                };
                break;

            case 'tools/call':
                assertJsonRpcObject(params);

                if (typeof params.name !== 'string') {
                    throw new MCPError(ErrorCode.InvalidParams, 'tools/call params.name must be a string');
                }

                const { name } = params;
                const args = params.arguments ?? {};
                result = await callToolByName(name, args, requestId);
                break;

            default:
                throw new MCPError(ErrorCode.MethodNotFound, `Unknown method: ${method}`);
        }

        res.json({
            jsonrpc: '2.0',
            id,
            result,
        });

    } catch (error) {
        const mcpError = handleError(error);
        logger.error('MCP request failed', mcpError, { requestId });

        res.json({
            jsonrpc: '2.0',
            id,
            error: mcpError.toJSON(),
        });
    }
});

/**
 * 404 handler
 */
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.path} not found`,
        availableEndpoints: [
            'GET /health',
            'GET /api/info',
            'GET /api/tools',
            'POST /api/tools/:toolName',
            'POST /mcp',
        ],
    });
});

/**
 * Error handler
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Express error handler', err);

    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
    });
});

/**
 * Start HTTP server
 */
async function main() {
    const serverInfo = getServerInfo();

    logger.info('Starting AI Transport Optimizer MCP HTTP Server', {
        ...serverInfo,
        transport: 'http',
        port: config.http.port,
        host: config.http.host,
    });

    // Validate configuration
    if (config.requireAuth && config.apiKeys.length === 0) {
        logger.warn('⚠️  Authentication is enabled but no API keys are configured!');
        logger.warn('⚠️  Set MCP_API_KEYS in .env file or disable auth with MCP_REQUIRE_AUTH=false');
    }

    app.listen(config.http.port, config.http.host, () => {
        logger.info(`✅ HTTP MCP Server listening on http://${config.http.host}:${config.http.port}`);
        logger.info('Available endpoints:');
        logger.info(`  - GET  http://${config.http.host}:${config.http.port}/health`);
        logger.info(`  - GET  http://${config.http.host}:${config.http.port}/api/info`);
        logger.info(`  - GET  http://${config.http.host}:${config.http.port}/api/tools`);
        logger.info(`  - POST http://${config.http.host}:${config.http.port}/api/tools/:toolName`);
        logger.info(`  - POST http://${config.http.host}:${config.http.port}/mcp`);
    });
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
    logger.error('Failed to start HTTP server', error);
    process.exit(1);
});
