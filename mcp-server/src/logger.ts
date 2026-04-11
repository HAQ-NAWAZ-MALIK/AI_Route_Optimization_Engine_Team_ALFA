/**
 * Structured logging for MCP server
 * Provides different log levels and request tracking
 */

import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    requestId?: string;
    tool?: string;
    [key: string]: any;
}

class Logger {
    private level: LogLevel;

    constructor() {
        this.level = config.logging.level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        const currentIndex = levels.indexOf(this.level);
        const messageIndex = levels.indexOf(level);
        return messageIndex >= currentIndex;
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }

    debug(message: string, context?: LogContext): void {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, context));
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, context));
        }
    }

    warn(message: string, context?: LogContext): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, context));
        }
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        if (this.shouldLog('error')) {
            const errorContext = error instanceof Error
                ? { ...context, error: error.message, stack: error.stack }
                : { ...context, error: String(error) };
            console.error(this.formatMessage('error', message, errorContext));
        }
    }

    // Log tool invocation
    toolCall(toolName: string, args: any, requestId: string): void {
        if (config.logging.logRequests) {
            this.info(`Tool called: ${toolName}`, { requestId, tool: toolName, args });
        }
    }

    // Log tool result
    toolResult(toolName: string, success: boolean, duration: number, requestId: string): void {
        if (config.logging.logRequests) {
            const level = success ? 'info' : 'warn';
            this[level](`Tool ${success ? 'completed' : 'failed'}: ${toolName}`, {
                requestId,
                tool: toolName,
                duration: `${duration}ms`,
                success,
            });
        }
    }
}

export const logger = new Logger();
