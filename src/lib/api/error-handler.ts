/**
 * API Error Handling
 * Global error handler with typed error codes
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
    success: false;
    error: string;
    message: string;
    details?: any;
    requestId?: string;
}

/**
 * Global API error handler
 * Converts various error types to consistent NextResponse
 */
export function handleApiError(error: unknown, requestId?: string): NextResponse<ErrorResponse> {
    console.error('[API Error]', error);

    // Known API errors
    if (error instanceof ApiError) {
        return NextResponse.json({
            success: false,
            error: error.code,
            message: error.message,
            details: error.details,
            requestId,
        }, { status: error.statusCode });
    }

    // Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                return NextResponse.json({
                    success: false,
                    error: 'DUPLICATE_ENTRY',
                    message: 'A record with this value already exists',
                    details: error.meta,
                    requestId,
                }, { status: 409 });

            case 'P2025':
                return NextResponse.json({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'The requested resource was not found',
                    requestId,
                }, { status: 404 });

            case 'P2003':
                return NextResponse.json({
                    success: false,
                    error: 'FOREIGN_KEY_CONSTRAINT',
                    message: 'Cannot perform operation due to related records',
                    requestId,
                }, { status: 409 });

            default:
                return NextResponse.json({
                    success: false,
                    error: 'DATABASE_ERROR',
                    message: 'A database error occurred',
                    requestId,
                }, { status: 500 });
        }
    }

    // Validation errors (from Zod or custom)
    if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error,
            requestId,
        }, { status: 400 });
    }

    // Generic Error
    if (error instanceof Error) {
        return NextResponse.json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message,
            requestId,
        }, { status: 500 });
    }

    // Unknown errors (don't leak details to client)
    return NextResponse.json({
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        requestId,
    }, { status: 500 });
}

/**
 * Common error factories
 */
export const Errors = {
    unauthorized: (message = 'Authentication required') =>
        new ApiError(401, 'UNAUTHORIZED', message),

    forbidden: (message = 'You do not have permission to perform this action') =>
        new ApiError(403, 'FORBIDDEN', message),

    notFound: (resource = 'Resource') =>
        new ApiError(404, 'NOT_FOUND', `${resource} not found`),

    badRequest: (message: string, details?: any) =>
        new ApiError(400, 'BAD_REQUEST', message, details),

    conflict: (message: string, details?: any) =>
        new ApiError(409, 'CONFLICT', message, details),

    tooManyRequests: (message = 'Rate limit exceeded') =>
        new ApiError(429, 'RATE_LIMIT_EXCEEDED', message),

    internalError: (message = 'An internal error occurred') =>
        new ApiError(500, 'INTERNAL_ERROR', message),
};
