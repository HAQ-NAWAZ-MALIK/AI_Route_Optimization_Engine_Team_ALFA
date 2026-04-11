/**
 * MCP Error Types and Error Handling
 * Standard error codes and custom error class for MCP protocol
 */

/**
 * MCP standard error codes
 */
export enum ErrorCode {
    // Standard JSON-RPC error codes
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,

    // MCP-specific errors
    ResourceNotFound = -32001,
    ResourceAccessDenied = -32002,
    ToolNotFound = -32003,
    ToolExecutionError = -32004,
}

/**
 * Custom MCP Error class
 */
export class MCPError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public data?: any
    ) {
        super(message);
        this.name = 'MCPError';
    }

    /**
     * Convert to JSON-RPC error format
     */
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}

/**
 * Error handler middleware
 */
export function handleError(error: unknown): MCPError {
    if (error instanceof MCPError) {
        return error;
    }

    if (error instanceof Error) {
        // Check for common error types
        if (error.message.includes('timeout')) {
            return new MCPError(
                ErrorCode.ToolExecutionError,
                'Operation timed out. Try reducing the number of locations or simplifying constraints.',
                { originalError: error.message }
            );
        }

        if (error.message.includes('OSRM')) {
            return new MCPError(
                ErrorCode.ToolExecutionError,
                'Routing service unavailable. Check OSRM server configuration.',
                { originalError: error.message }
            );
        }

        return new MCPError(
            ErrorCode.InternalError,
            error.message,
            { stack: error.stack }
        );
    }

    return new MCPError(
        ErrorCode.InternalError,
        'An unknown error occurred',
        { error: String(error) }
    );
}
