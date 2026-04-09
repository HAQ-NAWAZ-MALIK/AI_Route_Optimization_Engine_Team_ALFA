/**
 * Route Optimizer Client SDK
 * 
 * TypeScript/JavaScript SDK for consuming the Route Optimizer API.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ClientConfig {
    baseUrl: string;
    apiKey: string;
    timeout?: number;
    retries?: number;
}

export interface Location {
    id: string;
    lat: number;
    lng: number;
    name?: string;
    address?: string;
}

export interface Destination extends Location {
    preferredPickupTime?: string;
    timeWindowStart?: string;
    timeWindowEnd?: string;
}

export interface Constraints {
    departureTime: string;
    maxTotalDuration?: number;
    bufferPerStop?: number;
}

export interface OptimizeRouteRequest {
    origin: Location;
    destinations: Destination[];
    tripType?: 'pickup' | 'drop';
    constraints: Constraints;
    options?: {
        algorithm?: 'nearest_neighbor' | 'christofides' | 'genetic' | 'exhaustive' | 'auto';
        useRealRoads?: boolean;
        considerTraffic?: boolean;
        generateAlternatives?: boolean;
        maxAlternatives?: number;
    };
}

export interface OptimizeRouteResponse {
    success: boolean;
    requestId: string;
    processingTimeMs: number;
    result: {
        route: {
            id: string;
            stops: RouteStop[];
            totalDistance: number;
            totalDuration: number;
            estimatedArrival: string;
            geometry?: string;
            optimizationMethod: string;
        };
        metrics: {
            algorithmUsed: string;
            optimizationDuration: number;
            improvementOverNaive: number;
            efficiencyScore: number;
        };
    };
}

export interface RouteStop {
    sequence: number;
    location: Location;
    arrivalTime: string;
    departureTime: string;
    distanceFromPrevious: number;
    durationFromPrevious: number;
    cumulativeDistance: number;
    cumulativeDuration: number;
}

export interface HealthResponse {
    status: string;
    version: string;
    uptime: number;
}

export interface AlgorithmsResponse {
    algorithms: Array<{
        id: string;
        name: string;
        description: string;
        complexity: string;
        qualityGuarantee?: string;
    }>;
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class RouteOptimizerError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public requestId?: string
    ) {
        super(message);
        this.name = 'RouteOptimizerError';
    }
}

export class AuthenticationError extends RouteOptimizerError {
    constructor(message: string, requestId?: string) {
        super(message, 401, requestId);
        this.name = 'AuthenticationError';
    }
}

export class RateLimitError extends RouteOptimizerError {
    constructor(
        message: string,
        public retryAfter: number,
        requestId?: string
    ) {
        super(message, 429, requestId);
        this.name = 'RateLimitError';
    }
}

export class ValidationError extends RouteOptimizerError {
    constructor(message: string, requestId?: string) {
        super(message, 400, requestId);
        this.name = 'ValidationError';
    }
}

// ============================================================================
// CLIENT
// ============================================================================

/**
 * Route Optimizer API Client
 */
export class RouteOptimizerClient {
    private config: Required<ClientConfig>;

    constructor(config: ClientConfig) {
        this.config = {
            baseUrl: config.baseUrl.replace(/\/$/, ''),
            apiKey: config.apiKey,
            timeout: config.timeout ?? 30000,
            retries: config.retries ?? 2,
        };
    }

    // ========================================================================
    // HEALTH & INFO
    // ========================================================================

    /**
     * Check API health
     */
    async checkHealth(): Promise<HealthResponse> {
        return this.request<HealthResponse>('GET', '/api/v1/health');
    }

    /**
     * Get available algorithms
     */
    async getAlgorithms(): Promise<AlgorithmsResponse> {
        return this.request<AlgorithmsResponse>('GET', '/api/v1/algorithms');
    }

    // ========================================================================
    // OPTIMIZATION
    // ========================================================================

    /**
     * Optimize a single route
     */
    async optimizeRoute(input: OptimizeRouteRequest): Promise<OptimizeRouteResponse> {
        return this.request<OptimizeRouteResponse>('POST', '/api/v1/optimize/route', input);
    }

    /**
     * Calculate distance matrix
     */
    async getDistanceMatrix(coordinates: Array<{ lat: number; lng: number }>): Promise<{
        distances: number[][];
        durations: number[][];
    }> {
        return this.request('POST', '/api/v1/matrix/distance', {
            coordinates,
            useRealRoads: true,
        });
    }

    // ========================================================================
    // REQUEST HANDLING
    // ========================================================================

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = `${this.config.baseUrl}${path}`;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.config.apiKey,
                    },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                const data = await response.json();
                const requestId = response.headers.get('X-Request-Id') || undefined;

                if (!response.ok) {
                    throw this.handleErrorResponse(response.status, data, requestId);
                }

                return data as T;

            } catch (error) {
                lastError = error as Error;

                // Don't retry on auth or validation errors
                if (error instanceof AuthenticationError ||
                    error instanceof ValidationError ||
                    error instanceof RateLimitError) {
                    throw error;
                }

                // Wait before retry (exponential backoff)
                if (attempt < this.config.retries) {
                    await this.sleep(Math.pow(2, attempt) * 1000);
                }
            }
        }

        throw lastError || new Error('Request failed');
    }

    private handleErrorResponse(
        status: number,
        data: { error?: string; message?: string },
        requestId?: string
    ): RouteOptimizerError {
        const message = data.message || data.error || 'Unknown error';

        switch (status) {
            case 401:
                return new AuthenticationError(message, requestId);
            case 429:
                return new RateLimitError(message, 60, requestId);
            case 400:
                return new ValidationError(message, requestId);
            default:
                return new RouteOptimizerError(message, status, requestId);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new Route Optimizer client
 */
export function createClient(config: ClientConfig): RouteOptimizerClient {
    return new RouteOptimizerClient(config);
}
