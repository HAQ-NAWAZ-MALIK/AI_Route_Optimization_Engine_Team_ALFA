/**
 * Structured Logger
 * 
 * JSON-formatted logging for production observability.
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    requestId?: string;
    duration?: number;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, unknown>;
}

export interface RequestLogEntry extends LogEntry {
    method: string;
    path: string;
    statusCode: number;
    userAgent?: string;
    apiKey?: string;
}

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
    private minLevel: LogLevel;
    private levelPriority: Record<LogLevel, number> = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    };

    constructor() {
        this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO';
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.minLevel];
    }

    private formatEntry(entry: LogEntry): string {
        return JSON.stringify(entry);
    }

    private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...metadata,
        };

        const output = this.formatEntry(entry);

        switch (level) {
            case 'ERROR':
                console.error(output);
                break;
            case 'WARN':
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    debug(message: string, metadata?: Record<string, unknown>): void {
        this.log('DEBUG', message, metadata);
    }

    info(message: string, metadata?: Record<string, unknown>): void {
        this.log('INFO', message, metadata);
    }

    warn(message: string, metadata?: Record<string, unknown>): void {
        this.log('WARN', message, metadata);
    }

    error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
        this.log('ERROR', message, {
            ...metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : undefined,
        });
    }

    // ========================================================================
    // REQUEST LOGGING
    // ========================================================================

    request(entry: Omit<RequestLogEntry, 'timestamp' | 'level'>): void {
        if (!this.shouldLog('INFO')) return;

        const logEntry: RequestLogEntry = {
            timestamp: new Date().toISOString(),
            level: entry.statusCode >= 500 ? 'ERROR' : entry.statusCode >= 400 ? 'WARN' : 'INFO',
            ...entry,
        };

        const output = this.formatEntry(logEntry);
        console.log(output);
    }

    // ========================================================================
    // PERFORMANCE LOGGING
    // ========================================================================

    /**
     * Create a timer for measuring operation duration
     */
    startTimer(operation: string, requestId?: string): () => void {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.info(`${operation} completed`, { requestId, duration });
        };
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const logger = new Logger();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Mask sensitive data for logging
 */
export function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}
