/**
 * JSON Schema definitions for MCP tools
 * These schemas define the input parameters for each tool
 */

/**
 * Schema for optimize_route tool
 */
export const optimizeRouteSchema = {
    type: 'object',
    required: ['origin', 'destinations', 'tripType', 'constraints'],
    properties: {
        origin: {
            type: 'object',
            required: ['lat', 'lng'],
            properties: {
                lat: {
                    type: 'number',
                    minimum: -90,
                    maximum: 90,
                    description: 'Latitude of origin location',
                },
                lng: {
                    type: 'number',
                    minimum: -180,
                    maximum: 180,
                    description: 'Longitude of origin location',
                },
                name: {
                    type: 'string',
                    description: 'Name of origin location (e.g., "Office")',
                },
                address: {
                    type: 'string',
                    description: 'Address of origin location',
                },
            },
            description: 'Starting location for the route (e.g., office)',
        },
        destinations: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
                type: 'object',
                required: ['lat', 'lng', 'id'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier for this location',
                    },
                    lat: {
                        type: 'number',
                        minimum: -90,
                        maximum: 90,
                        description: 'Latitude',
                    },
                    lng: {
                        type: 'number',
                        minimum: -180,
                        maximum: 180,
                        description: 'Longitude',
                    },
                    name: {
                        type: 'string',
                        description: 'Name or identifier (e.g., employee name)',
                    },
                    address: {
                        type: 'string',
                        description: 'Address',
                    },
                    preferredPickupTime: {
                        type: 'string',
                        pattern: '^\\d{2}:\\d{2}$',
                        description: 'Preferred time (HH:mm format, e.g., "08:30")',
                    },
                    timeWindowStart: {
                        type: 'string',
                        pattern: '^\\d{2}:\\d{2}$',
                        description: 'Earliest acceptable time (HH:mm)',
                    },
                    timeWindowEnd: {
                        type: 'string',
                        pattern: '^\\d{2}:\\d{2}$',
                        description: 'Latest acceptable time (HH:mm)',
                    },
                },
            },
            description: 'Array of destination locations (e.g., employee homes)',
        },
        tripType: {
            type: 'string',
            enum: ['pickup', 'drop'],
            description: 'Type of trip: "pickup" (office to locations) or "drop" (locations to office)',
        },
        constraints: {
            type: 'object',
            required: ['departureTime'],
            properties: {
                departureTime: {
                    type: 'string',
                    pattern: '^\\d{2}:\\d{2}$',
                    description: 'Departure time from origin (HH:mm format)',
                },
                maxTotalDuration: {
                    type: 'number',
                    minimum: 1,
                    description: 'Maximum total route duration in minutes',
                },
                bufferPerStop: {
                    type: 'number',
                    minimum: 0,
                    description: 'Buffer time per stop in minutes (for boarding)',
                },
            },
            description: 'Time and duration constraints',
        },
        options: {
            type: 'object',
            properties: {
                algorithm: {
                    type: 'string',
                    enum: ['nearest_neighbor', 'christofides', 'genetic', 'dijkstra', 'bmssp', 'auto'],
                    description: 'Optimization algorithm to use (default: auto)',
                },
                useRealRoads: {
                    type: 'boolean',
                    description: 'Use real road network routing via OSRM (default: true)',
                },
                considerTraffic: {
                    type: 'boolean',
                    description: 'Consider traffic conditions (requires TomTom API key)',
                },
                generateAlternatives: {
                    type: 'boolean',
                    description: 'Generate alternative route options',
                },
                maxAlternatives: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 5,
                    description: 'Number of alternative routes to generate',
                },
            },
            description: 'Optional optimization settings',
        },
    },
    description: 'Optimize a single route for employee pickup or drop operations',
} as const;

/**
 * Schema for optimize_multi_cluster tool
 */
export const optimizeMultiClusterSchema = {
    type: 'object',
    required: ['office', 'employees', 'cabs'],
    properties: {
        office: {
            type: 'object',
            required: ['lat', 'lng'],
            properties: {
                lat: {
                    type: 'number',
                    minimum: -90,
                    maximum: 90,
                    description: 'Office latitude',
                },
                lng: {
                    type: 'number',
                    minimum: -180,
                    maximum: 180,
                    description: 'Office longitude',
                },
                name: {
                    type: 'string',
                    description: 'Office name',
                },
            },
            description: 'Central office location',
        },
        employees: {
            type: 'array',
            minItems: 1,
            maxItems: 500,
            items: {
                type: 'object',
                required: ['id', 'lat', 'lng'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'Employee identifier',
                    },
                    name: {
                        type: 'string',
                        description: 'Employee name',
                    },
                    lat: {
                        type: 'number',
                        minimum: -90,
                        maximum: 90,
                        description: 'Home latitude',
                    },
                    lng: {
                        type: 'number',
                        minimum: -180,
                        maximum: 180,
                        description: 'Home longitude',
                    },
                    address: {
                        type: 'string',
                        description: 'Home address',
                    },
                },
            },
            description: 'List of all employees to be picked up',
        },
        cabs: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: {
                type: 'object',
                required: ['id', 'capacity'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'Cab identifier',
                    },
                    name: {
                        type: 'string',
                        description: 'Cab name or number',
                    },
                    capacity: {
                        type: 'integer',
                        minimum: 1,
                        description: 'Maximum number of passengers',
                    },
                },
            },
            description: 'Available cabs with their capacities',
        },
        config: {
            type: 'object',
            properties: {
                maxIterations: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Maximum clustering iterations',
                },
                routeOptimizationAlgorithm: {
                    type: 'string',
                    enum: ['nearest_neighbor', 'christofides', 'genetic', 'dijkstra', 'bmssp', 'auto'],
                    description: 'Algorithm for individual route optimization',
                },
            },
            description: 'Clustering and optimization configuration',
        },
    },
    description: 'Optimize routes for multiple cabs with intelligent employee clustering',
} as const;

/**
 * Schema for calculate_distance_matrix tool
 */
export const calculateDistanceMatrixSchema = {
    type: 'object',
    required: ['coordinates'],
    properties: {
        coordinates: {
            type: 'array',
            minItems: 2,
            maxItems: 100,
            items: {
                type: 'object',
                required: ['lat', 'lng'],
                properties: {
                    lat: {
                        type: 'number',
                        minimum: -90,
                        maximum: 90,
                        description: 'Latitude',
                    },
                    lng: {
                        type: 'number',
                        minimum: -180,
                        maximum: 180,
                        description: 'Longitude',
                    },
                },
            },
            description: 'Array of coordinate points',
        },
        useRealRoads: {
            type: 'boolean',
            description: 'Use real road routing (true) or straight-line distance (false)',
        },
    },
    description: 'Calculate pairwise distance and duration matrix between locations',
} as const;
