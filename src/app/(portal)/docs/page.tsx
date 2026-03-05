/**
 * API Documentation Page
 * Comprehensive, standard-style API reference for users to understand and integrate
 */

'use client';

import { useState } from 'react';

// =================================================================
// Types
// =================================================================
type HttpMethod = 'GET' | 'POST';

interface Endpoint {
    method: HttpMethod;
    path: string;
    title: string;
    description: string;
    tag: string;
    auth: boolean;
    requestBody?: {
        description: string;
        example: string;
    };
    responseExample: string;
    parameters?: { name: string; type: string; required: boolean; description: string }[];
    statusCodes: { code: number; description: string }[];
}

// =================================================================
// API Data
// =================================================================
const BASE_URL = '/api/v1';

const ENDPOINTS: Endpoint[] = [
    {
        method: 'GET',
        path: '/health',
        title: 'Health Check',
        description: 'Check the operational status of all system services. Use this endpoint for monitoring, load balancer health probes, and uptime tracking.',
        tag: 'System',
        auth: false,
        responseExample: JSON.stringify({
            status: 'ok',
            version: '4.0.0',
            timestamp: '2026-02-24T16:15:00.000Z',
            uptime: 86400,
            services: {
                optimizer: true,
                osrm: true,
            },
        }, null, 2),
        statusCodes: [
            { code: 200, description: 'Service is healthy and all subsystems are operational' },
            { code: 503, description: 'Service is degraded or unhealthy' },
        ],
    },
    {
        method: 'GET',
        path: '/algorithms',
        title: 'List Algorithms',
        description: 'Retrieve a list of all available optimization algorithms with their performance characteristics, complexity guarantees, and supported features.',
        tag: 'System',
        auth: false,
        responseExample: JSON.stringify({
            algorithms: [
                {
                    id: 'nearest_neighbor',
                    name: 'Nearest Neighbor',
                    description: 'Fast greedy heuristic that picks the closest unvisited location',
                    timeComplexity: 'O(n²)',
                    qualityGuarantee: 'No guarantee',
                    maxEfficient: 500,
                    supportsTimeWindows: false,
                },
                {
                    id: 'christofides',
                    name: 'TSP Christofides',
                    description: '1.5x optimal guarantee algorithm for the Travelling Salesman Problem',
                    timeComplexity: 'O(n³)',
                    qualityGuarantee: '1.5x optimal',
                    maxEfficient: 200,
                    supportsTimeWindows: false,
                },
                {
                    id: 'genetic',
                    name: 'Genetic Algorithm',
                    description: 'Evolutionary optimization that evolves near-optimal solutions',
                    timeComplexity: 'O(g × p × n)',
                    qualityGuarantee: 'Near-optimal',
                    maxEfficient: 100,
                    supportsTimeWindows: true,
                },
            ],
        }, null, 2),
        statusCodes: [
            { code: 200, description: 'List of available algorithms returned' },
        ],
    },
    {
        method: 'POST',
        path: '/optimize/route',
        title: 'Optimize Route',
        description: 'Optimize a single route for employee pickup or drop operations. The engine selects the best algorithm based on the number of destinations, or you can specify one manually. Supports real-road routing via OSRM and live traffic via TomTom.',
        tag: 'Optimization',
        auth: true,
        requestBody: {
            description: 'Route optimization request with origin, destinations, constraints, and options.',
            example: JSON.stringify({
                origin: {
                    id: 'office-hq',
                    lat: 34.0837,
                    lng: 74.7973,
                    name: 'Office HQ',
                    address: '1 Business Park, Srinagar',
                },
                destinations: [
                    {
                        id: 'emp-1',
                        lat: 34.0900,
                        lng: 74.8050,
                        name: 'Alice Khan',
                        preferredPickupTime: '08:30',
                    },
                    {
                        id: 'emp-2',
                        lat: 34.0750,
                        lng: 74.8100,
                        name: 'Bob Ahmed',
                        preferredPickupTime: '08:45',
                    },
                    {
                        id: 'emp-3',
                        lat: 34.0950,
                        lng: 74.7900,
                        name: 'Carol Singh',
                    },
                ],
                tripType: 'pickup',
                constraints: {
                    departureTime: '08:00',
                    maxTotalDuration: 90,
                    bufferPerStop: 3,
                },
                options: {
                    algorithm: 'auto',
                    useRealRoads: true,
                    considerTraffic: false,
                    generateAlternatives: true,
                    maxAlternatives: 2,
                },
            }, null, 2),
        },
        parameters: [
            { name: 'origin', type: 'Location', required: true, description: 'Starting point with id, lat, lng, and optional name/address' },
            { name: 'destinations', type: 'EmployeeInput[]', required: true, description: 'Array of employees/stops (1–500 items)' },
            { name: 'tripType', type: 'string', required: false, description: '"pickup" or "drop" — defaults to "pickup"' },
            { name: 'constraints.departureTime', type: 'string', required: true, description: 'Departure time in HH:mm format' },
            { name: 'constraints.maxTotalDuration', type: 'number', required: false, description: 'Max route duration in minutes' },
            { name: 'constraints.bufferPerStop', type: 'number', required: false, description: 'Buffer time per stop in minutes' },
            { name: 'options.algorithm', type: 'string', required: false, description: '"nearest_neighbor" | "christofides" | "genetic" | "exhaustive" | "auto"' },
            { name: 'options.useRealRoads', type: 'boolean', required: false, description: 'Use OSRM real road routing — defaults to true' },
            { name: 'options.considerTraffic', type: 'boolean', required: false, description: 'Use TomTom live traffic — defaults to false' },
            { name: 'options.generateAlternatives', type: 'boolean', required: false, description: 'Return alternative routes — defaults to false' },
        ],
        responseExample: JSON.stringify({
            success: true,
            requestId: 'req_abc123',
            processingTimeMs: 245,
            result: {
                route: {
                    id: 'route_xyz789',
                    stops: [
                        { sequence: 1, location: { id: 'emp-3', name: 'Carol Singh' }, arrivalTime: '08:12', distanceFromPrevious: 2.1, durationFromPrevious: 12 },
                        { sequence: 2, location: { id: 'emp-1', name: 'Alice Khan' }, arrivalTime: '08:28', distanceFromPrevious: 3.4, durationFromPrevious: 16 },
                        { sequence: 3, location: { id: 'emp-2', name: 'Bob Ahmed' }, arrivalTime: '08:47', distanceFromPrevious: 2.8, durationFromPrevious: 14 },
                    ],
                    totalDistance: 8.3,
                    totalDuration: 47,
                    estimatedArrival: '08:47',
                    optimizationMethod: 'christofides',
                },
                metrics: {
                    algorithmUsed: 'christofides',
                    optimizationDuration: 45,
                    improvementOverNaive: 23.5,
                    efficiencyScore: 0.87,
                },
            },
        }, null, 2),
        statusCodes: [
            { code: 200, description: 'Route optimized successfully' },
            { code: 400, description: 'Invalid request body or missing required fields' },
            { code: 401, description: 'Missing or invalid API key' },
            { code: 429, description: 'Rate limit exceeded' },
            { code: 500, description: 'Internal optimization engine error' },
        ],
    },
    {
        method: 'POST',
        path: '/optimize/multi-cluster',
        title: 'Multi-Cluster Optimization',
        description: 'Optimize routes for multiple cabs simultaneously. Employees are automatically assigned to cabs based on geographic clustering, then each cab\'s route is independently optimized for minimum distance.',
        tag: 'Optimization',
        auth: true,
        requestBody: {
            description: 'Multi-cluster optimization request with office location, employees, and cab fleet.',
            example: JSON.stringify({
                office: {
                    id: 'office-hq',
                    lat: 34.0837,
                    lng: 74.7973,
                    name: 'Office HQ',
                },
                employees: [
                    { id: 'emp-1', lat: 34.0900, lng: 74.8050, name: 'Alice Khan' },
                    { id: 'emp-2', lat: 34.0750, lng: 74.8100, name: 'Bob Ahmed' },
                    { id: 'emp-3', lat: 34.0950, lng: 74.7900, name: 'Carol Singh' },
                    { id: 'emp-4', lat: 34.0680, lng: 74.8200, name: 'Dave Lone' },
                ],
                cabs: [
                    { id: 'cab-1', name: 'Cab Alpha', capacity: 3 },
                    { id: 'cab-2', name: 'Cab Beta', capacity: 3 },
                ],
                config: {
                    maxIterations: 100,
                    routeOptimizationAlgorithm: 'christofides',
                },
            }, null, 2),
        },
        parameters: [
            { name: 'office', type: 'Location', required: true, description: 'Office/destination location for all cabs' },
            { name: 'employees', type: 'EmployeeInput[]', required: true, description: 'Array of employees to be assigned to cabs' },
            { name: 'cabs', type: 'Cab[]', required: true, description: 'Fleet of cabs with id, name, and capacity' },
            { name: 'config.maxIterations', type: 'number', required: false, description: 'Max clustering iterations' },
            { name: 'config.routeOptimizationAlgorithm', type: 'string', required: false, description: 'Algorithm to optimize each cab route' },
        ],
        responseExample: JSON.stringify({
            success: true,
            requestId: 'req_multi_456',
            processingTimeMs: 890,
            result: {
                clusters: [
                    {
                        cabId: 'cab-1',
                        cabName: 'Cab Alpha',
                        employees: [{ id: 'emp-1', name: 'Alice Khan' }, { id: 'emp-3', name: 'Carol Singh' }],
                        route: { totalDistance: 5.2, totalDuration: 28, optimizationMethod: 'christofides' },
                    },
                    {
                        cabId: 'cab-2',
                        cabName: 'Cab Beta',
                        employees: [{ id: 'emp-2', name: 'Bob Ahmed' }, { id: 'emp-4', name: 'Dave Lone' }],
                        route: { totalDistance: 6.1, totalDuration: 32, optimizationMethod: 'christofides' },
                    },
                ],
                totalCabs: 2,
                totalEmployees: 4,
                metrics: { averageLoadFactor: 0.67, totalDistance: 11.3, totalDuration: 60 },
            },
        }, null, 2),
        statusCodes: [
            { code: 200, description: 'Multi-cluster optimization completed' },
            { code: 400, description: 'Invalid request body or constraints' },
            { code: 401, description: 'Missing or invalid API key' },
            { code: 429, description: 'Rate limit exceeded' },
            { code: 500, description: 'Internal optimization engine error' },
        ],
    },
    {
        method: 'POST',
        path: '/matrix/distance',
        title: 'Distance Matrix',
        description: 'Calculate pairwise distances and durations between a set of coordinates. Returns an NxN matrix useful for custom routing logic, analytics, and visualization.',
        tag: 'Utilities',
        auth: true,
        requestBody: {
            description: 'Array of coordinates to compute pairwise distances for.',
            example: JSON.stringify({
                coordinates: [
                    { lat: 34.0837, lng: 74.7973 },
                    { lat: 34.0900, lng: 74.8050 },
                    { lat: 34.0750, lng: 74.8100 },
                ],
                useRealRoads: true,
            }, null, 2),
        },
        parameters: [
            { name: 'coordinates', type: 'Coordinate[]', required: true, description: 'Array of {lat, lng} objects (2–100 items)' },
            { name: 'useRealRoads', type: 'boolean', required: false, description: 'Use OSRM for real road distances — defaults to true' },
        ],
        responseExample: JSON.stringify({
            success: true,
            requestId: 'req_matrix_789',
            processingTimeMs: 120,
            result: {
                distances: [
                    [0, 2.1, 3.4],
                    [2.1, 0, 4.2],
                    [3.4, 4.2, 0],
                ],
                durations: [
                    [0, 8, 12],
                    [8, 0, 15],
                    [12, 15, 0],
                ],
            },
        }, null, 2),
        statusCodes: [
            { code: 200, description: 'Distance matrix computed successfully' },
            { code: 400, description: 'Invalid coordinates or too few/many points' },
            { code: 401, description: 'Missing or invalid API key' },
            { code: 500, description: 'Internal error or OSRM unavailable' },
        ],
    },
];

const TAGS = ['All', 'System', 'Optimization', 'Utilities'] as const;

// =================================================================
// Components
// =================================================================

function MethodBadge({ method }: { method: HttpMethod }) {
    const color = method === 'GET' ? '#30d158' : '#0071e3';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em',
            borderRadius: 'var(--radius-full)',
            color: color,
            background: `${color}18`,
            border: `1px solid ${color}30`,
        }}>
            {method}
        </span>
    );
}

function StatusBadge({ code }: { code: number }) {
    const color = code < 300 ? '#30d158' : code < 400 ? '#0071e3' : code < 500 ? '#ff9f0a' : '#ff3b30';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '38px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            borderRadius: 'var(--radius-sm)',
            color: color,
            background: `${color}15`,
        }}>
            {code}
        </span>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 500,
                color: copied ? 'var(--green)' : 'var(--gray-400)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
            }}
        >
            {copied ? '✓ Copied' : 'Copy'}
        </button>
    );
}

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
    return (
        <div style={{ position: 'relative' }}>
            <CopyButton text={code} />
            <pre style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                paddingRight: '80px',
                overflow: 'auto',
                fontSize: '13px',
                lineHeight: 1.6,
                fontFamily: 'var(--font-mono)',
                color: 'var(--gray-300)',
                maxHeight: '500px',
            }}>
                <code>{code}</code>
            </pre>
        </div>
    );
}

function ParamTable({ parameters }: { parameters: Endpoint['parameters'] }) {
    if (!parameters || parameters.length === 0) return null;
    return (
        <div style={{ marginTop: 'var(--space-4)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-300)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Parameters
            </h4>
            <div className="table-container">
                <table className="table" style={{ fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Required</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parameters.map((p) => (
                            <tr key={p.name}>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue-light)', fontSize: '12px', whiteSpace: 'nowrap' }}>{p.name}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)', fontSize: '12px', whiteSpace: 'nowrap' }}>{p.type}</td>
                                <td>
                                    {p.required ? (
                                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>Required</span>
                                    ) : (
                                        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Optional</span>
                                    )}
                                </td>
                                <td style={{ color: 'var(--gray-400)' }}>{p.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function EndpointCard({ endpoint, isOpen, onToggle }: { endpoint: Endpoint; isOpen: boolean; onToggle: () => void }) {
    return (
        <div id={endpoint.path.replace(/\//g, '-').slice(1)} className="doc-endpoint-card" style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            {/* Header — always visible */}
            <button
                onClick={onToggle}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-5) var(--space-6)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 150ms ease',
                }}
            >
                <MethodBadge method={endpoint.method} />
                <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    color: 'var(--white)',
                    fontWeight: 500,
                }}>
                    {BASE_URL}{endpoint.path}
                </span>
                <span style={{
                    marginLeft: 'auto',
                    fontSize: '13px',
                    color: 'var(--gray-500)',
                    fontWeight: 400,
                }}>
                    {endpoint.title}
                </span>
                {endpoint.auth && (
                    <span style={{
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'var(--orange)',
                        background: 'rgba(255,159,10,0.1)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(255,159,10,0.2)',
                    }}>
                        🔒 AUTH
                    </span>
                )}
                <svg
                    width="16" height="16" fill="none" stroke="var(--gray-500)" strokeWidth="2"
                    style={{
                        transition: 'transform 200ms ease',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                    }}
                >
                    <path d="M4 6l4 4 4-4" />
                </svg>
            </button>

            {/* Expanded content */}
            {isOpen && (
                <div style={{
                    padding: '0 var(--space-6) var(--space-6)',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    animation: 'fadeIn 200ms ease',
                }}>
                    {/* Description */}
                    <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.7, marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                        {endpoint.description}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: endpoint.requestBody ? '1fr 1fr' : '1fr', gap: 'var(--space-6)' }}>
                        {/* Left column: Request */}
                        {endpoint.requestBody && (
                            <div>
                                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-300)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Request Body
                                </h4>
                                <CodeBlock code={endpoint.requestBody.example} />
                            </div>
                        )}

                        {/* Right column: Response */}
                        <div>
                            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-300)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Response
                            </h4>
                            <CodeBlock code={endpoint.responseExample} />
                        </div>
                    </div>

                    {/* Parameters table */}
                    <ParamTable parameters={endpoint.parameters} />

                    {/* Status codes */}
                    <div style={{ marginTop: 'var(--space-5)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-300)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Status Codes
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {endpoint.statusCodes.map((sc) => (
                                <div key={sc.code} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <StatusBadge code={sc.code} />
                                    <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{sc.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =================================================================
// Page
// =================================================================
export default function DocsPage() {
    const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set());
    const [activeTag, setActiveTag] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');

    const toggle = (path: string) => {
        setOpenEndpoints((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const expandAll = () => setOpenEndpoints(new Set(ENDPOINTS.map(e => e.path)));
    const collapseAll = () => setOpenEndpoints(new Set());

    const filteredEndpoints = ENDPOINTS.filter((e) => {
        const matchesTag = activeTag === 'All' || e.tag === activeTag;
        const matchesSearch = searchQuery === '' ||
            e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTag && matchesSearch;
    });

    return (
        <div style={{ maxWidth: '1100px' }}>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                    <h1 className="page-title" style={{ margin: 0 }}>API Documentation</h1>
                    <span className="badge badge-info" style={{ fontSize: '11px' }}>v1.0</span>
                </div>
                <p className="page-description">
                    Complete reference for integrating with the AI Transport Optimizer API.
                </p>
            </div>

            {/* Quick Start Card */}
            <div className="card" style={{ marginBottom: 'var(--space-8)', background: 'linear-gradient(135deg, rgba(0,113,227,0.08) 0%, rgba(191,77,255,0.05) 100%)', border: '1px solid rgba(0,113,227,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-6)' }}>
                    <div style={{
                        width: '44px', height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(0,113,227,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <svg width="22" height="22" fill="none" stroke="var(--blue-light)" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Quick Start</h2>
                        <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                            All API requests go to <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--blue-light)', background: 'rgba(0,113,227,0.1)', padding: '2px 6px', borderRadius: '4px' }}>http://localhost:3000/api/v1</code>.
                            Protected endpoints require an API key in the <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--blue-light)', background: 'rgba(0,113,227,0.1)', padding: '2px 6px', borderRadius: '4px' }}>x-api-key</code> header.
                        </p>
                        <CodeBlock
                            language="bash"
                            code={`# Example: Optimize a route
curl -X POST http://localhost:3000/api/v1/optimize/route \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "origin": { "id": "hq", "lat": 34.0837, "lng": 74.7973 },
    "destinations": [
      { "id": "e1", "lat": 34.090, "lng": 74.805, "name": "Employee 1" }
    ],
    "constraints": { "departureTime": "08:00" }
  }'`}
                        />
                    </div>
                </div>
            </div>

            {/* Authentication Section */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                    🔐 Authentication
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
                    Endpoints marked with <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600, color: 'var(--orange)', background: 'rgba(255,159,10,0.1)', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,159,10,0.2)' }}>🔒 AUTH</span> require
                    an API key. Generate one from <a href="/api-keys" style={{ color: 'var(--blue-light)', textDecoration: 'none' }}>API Keys</a> and include it in every request:
                </p>
                <div className="table-container" style={{ marginBottom: 'var(--space-4)' }}>
                    <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th>Header</th>
                                <th>Value</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue-light)' }}>x-api-key</td>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--gray-300)' }}>ropt_xxxxxxxx...</td>
                                <td style={{ color: 'var(--gray-400)' }}>Your unique API key from the dashboard</td>
                            </tr>
                            <tr>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue-light)' }}>Content-Type</td>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--gray-300)' }}>application/json</td>
                                <td style={{ color: 'var(--gray-400)' }}>Required for all POST requests</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rate Limiting Section */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                    ⚡ Rate Limiting
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
                    API calls are rate-limited per API key based on your subscription plan. Rate limit headers are included in every response.
                </p>
                <div className="table-container">
                    <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th>Plan</th>
                                <th>Requests / Month</th>
                                <th>Rate Limit</th>
                                <th>Max Locations</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span className="badge badge-neutral">Free</span></td>
                                <td style={{ color: 'var(--gray-300)' }}>100</td>
                                <td style={{ color: 'var(--gray-300)' }}>10 req / 15 min</td>
                                <td style={{ color: 'var(--gray-300)' }}>10</td>
                            </tr>
                            <tr>
                                <td><span className="badge badge-info">Pro</span></td>
                                <td style={{ color: 'var(--gray-300)' }}>10,000</td>
                                <td style={{ color: 'var(--gray-300)' }}>100 req / 15 min</td>
                                <td style={{ color: 'var(--gray-300)' }}>100</td>
                            </tr>
                            <tr>
                                <td><span className="badge badge-success">Enterprise</span></td>
                                <td style={{ color: 'var(--gray-300)' }}>Unlimited</td>
                                <td style={{ color: 'var(--gray-300)' }}>1,000 req / 15 min</td>
                                <td style={{ color: 'var(--gray-300)' }}>500</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Error Handling Section */}
            <div className="card" style={{ marginBottom: 'var(--space-10)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                    ⚠️ Error Handling
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
                    All errors follow a consistent JSON structure. Use the <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--blue-light)', background: 'rgba(0,113,227,0.1)', padding: '2px 6px', borderRadius: '4px' }}>requestId</code> when contacting support.
                </p>
                <CodeBlock code={JSON.stringify({
                    success: false,
                    error: 'Validation failed',
                    message: 'origin.lat must be between -90 and 90',
                    requestId: 'req_err_abc123',
                }, null, 2)} />
            </div>

            {/* Endpoints Section */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--white)', margin: 0 }}>
                        Endpoints
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <button onClick={expandAll} style={{ fontSize: '12px', color: 'var(--blue-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Expand all</button>
                        <span style={{ color: 'var(--gray-600)' }}>|</span>
                        <button onClick={collapseAll} style={{ fontSize: '12px', color: 'var(--blue-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Collapse all</button>
                    </div>
                </div>

                {/* Filter bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                    {/* Tag filters */}
                    {TAGS.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(tag)}
                            style={{
                                padding: '6px 16px',
                                fontSize: '13px',
                                fontWeight: 500,
                                borderRadius: 'var(--radius-full)',
                                border: activeTag === tag ? '1px solid var(--blue)' : '1px solid rgba(255,255,255,0.1)',
                                background: activeTag === tag ? 'rgba(0,113,227,0.15)' : 'rgba(255,255,255,0.03)',
                                color: activeTag === tag ? 'var(--blue-light)' : 'var(--gray-400)',
                                cursor: 'pointer',
                                transition: 'all 150ms ease',
                            }}
                        >
                            {tag}
                        </button>
                    ))}

                    {/* Search */}
                    <div style={{ marginLeft: 'auto', position: 'relative' }}>
                        <svg width="14" height="14" fill="none" stroke="var(--gray-500)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="6" cy="6" r="5" />
                            <path d="M10 10l3 3" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search endpoints..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input"
                            style={{
                                width: '240px',
                                paddingLeft: '34px',
                                fontSize: '13px',
                                height: '36px',
                            }}
                        />
                    </div>
                </div>

                {/* Endpoint List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {filteredEndpoints.map((endpoint) => (
                        <EndpointCard
                            key={endpoint.path}
                            endpoint={endpoint}
                            isOpen={openEndpoints.has(endpoint.path)}
                            onToggle={() => toggle(endpoint.path)}
                        />
                    ))}
                    {filteredEndpoints.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--gray-500)' }}>
                            No endpoints match your search.
                        </div>
                    )}
                </div>
            </div>

            {/* SDKs & Integration */}
            <div className="card" style={{ marginTop: 'var(--space-10)', marginBottom: 'var(--space-8)', background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(191,77,255,0.04) 100%)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
                    🧩 Integration Examples
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                    <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-300)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            JavaScript / Node.js
                        </h4>
                        <CodeBlock language="javascript" code={`const response = await fetch(
  'http://localhost:3000/api/v1/optimize/route',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
    },
    body: JSON.stringify({
      origin: { id: 'hq', lat: 34.08, lng: 74.79 },
      destinations: [...employees],
      constraints: { departureTime: '08:00' },
    }),
  }
);

const data = await response.json();
console.log(data.result.route);`} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-300)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Python
                        </h4>
                        <CodeBlock language="python" code={`import requests

response = requests.post(
    "http://localhost:3000/api/v1/optimize/route",
    headers={
        "Content-Type": "application/json",
        "x-api-key": "YOUR_API_KEY",
    },
    json={
        "origin": {"id": "hq", "lat": 34.08, "lng": 74.79},
        "destinations": [
            {"id": "e1", "lat": 34.09, "lng": 74.80}
        ],
        "constraints": {"departureTime": "08:00"},
    },
)

data = response.json()
print(data["result"]["route"])`} />
                    </div>
                </div>
            </div>

            {/* MCP Integration */}
            <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                    🤖 MCP Server Integration
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
                    The optimizer also provides a <strong style={{ color: 'var(--gray-200)' }}>Model Context Protocol (MCP)</strong> server for LLM integration
                    (ChatGPT, Claude, etc.). The MCP server exposes the same optimization tools via JSON-RPC 2.0.
                </p>
                <div className="table-container">
                    <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th>MCP Endpoint</th>
                                <th>Port</th>
                                <th>Protocol</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue-light)' }}>http://localhost:3001/mcp</td>
                                <td style={{ color: 'var(--gray-300)' }}>3001</td>
                                <td style={{ color: 'var(--gray-300)' }}>JSON-RPC 2.0</td>
                            </tr>
                            <tr>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue-light)' }}>http://localhost:3001/api/tools/:name</td>
                                <td style={{ color: 'var(--gray-300)' }}>3001</td>
                                <td style={{ color: 'var(--gray-300)' }}>REST</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                textAlign: 'center',
                padding: 'var(--space-10) 0 var(--space-8)',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                color: 'var(--gray-500)',
                fontSize: '13px',
            }}>
                <p style={{ marginBottom: 'var(--space-2)' }}>
                    Need help? Check the <a href="/api-keys" style={{ color: 'var(--blue-light)', textDecoration: 'none' }}>API Keys</a> page to generate your key,
                    or view <a href="/usage" style={{ color: 'var(--blue-light)', textDecoration: 'none' }}>Usage Analytics</a> for call history.
                </p>
                <p style={{ color: 'var(--gray-600)' }}>
                    AI Transport Optimizer v4.0 — MIT License
                </p>
            </div>
        </div>
    );
}
