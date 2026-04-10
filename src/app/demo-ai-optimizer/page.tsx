'use client';

/**
 * AI Transport Optimizer - Multi-Cluster Demo V2 Enhanced
 * 
 * Features:
 * - CSV data loading (employees, cabs, config)
 * - Multi-cluster optimization with cab assignment
 * - Per-cab route with algorithm comparison (NN, Christofides, GA, Exhaustive)
 * - Route animations (individual and simultaneous)
 * - Detailed cluster and assignment visualization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
    optimizeRoute,
    getRoute,
    decodePolyline,
} from '@/lib/ai-engine';
import type { Coordinate, OptimizationMethod, RouteOptimizationOutput } from '@/lib/ai-engine';
import {
    loadSampleData,
    parseUploadedFiles,
    type Employee,
    type Cab,
    type Config,
} from '@/lib/csv-parser';
import {
    optimizeMultiCluster,
    type CabAssignment,
    type Cluster,
} from '@/lib/multi-cluster-optimizer';

// ============================================================================
// CONSTANTS
// ============================================================================

const CLUSTER_COLORS = [
    '#22c55e', // Green
    '#3b82f6', // Blue  
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
];

const DEFAULT_CONFIG: Config = {
    officeName: 'Tech Park Office',
    officeAddress: 'Marathahalli',
    officeLat: 12.9565,
    officeLng: 77.7010,
    departureTime: '08:00',
    tripType: 'pickup',
};

interface AlgorithmResult {
    name: string;
    distance: number;
    duration: number;
    timeMs: number;
}

interface RouteResult {
    cabId: string;
    cabName: string;
    driverName: string;
    employees: Employee[];
    cluster: Cluster;
    route: Coordinate[];
    totalDistance: number;
    totalDuration: number;
    color: string;
    optimizationResult: RouteOptimizationOutput | null;
    algorithms: AlgorithmResult[];
    winner: string;
    stopOrder: { name: string; address: string; eta: string }[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MultiClusterDemoPage() {
    // Data state
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [cabs, setCabs] = useState<Cab[]>([]);
    const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
    const [dataLoaded, setDataLoaded] = useState(false);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'sample' | 'upload'>('sample');
    const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
    const [showClusters, setShowClusters] = useState(true);
    const [showAssignments, setShowAssignments] = useState(true);

    // Animation state
    const [animating, setAnimating] = useState(false);
    const [animatingAll, setAnimatingAll] = useState(false);
    const animationRefs = useRef<{ [key: string]: number }>({});
    const vehicleMarkers = useRef<{ [key: string]: mapboxgl.Marker }>({});

    // Results
    const [routes, setRoutes] = useState<RouteResult[]>([]);
    const [clusterAssignments, setClusterAssignments] = useState<CabAssignment[]>([]);
    const [unassignedEmps, setUnassignedEmps] = useState<Employee[]>([]);
    const [totalMetrics, setTotalMetrics] = useState<{
        distance: number;
        duration: number;
        employees: number;
        cabs: number;
    } | null>(null);

    // Map refs
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<mapboxgl.Marker[]>([]);

    const addLog = (msg: string) => {
        setLogs((prev: string[]) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Initialize Mapbox
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [config.officeLng, config.officeLat],
            zoom: 11,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    // Load sample data
    const handleLoadSample = async () => {
        setLoading(true);
        setError(null);
        setLogs([]);
        setRoutes([]);
        setClusterAssignments([]);
        addLog('📂 Loading sample data...');

        try {
            const result = await loadSampleData();

            if (result.errors.length > 0) {
                result.errors.forEach((e: { message: string }) => addLog(`❌ ${e.message}`));
            }
            if (result.warnings.length > 0) {
                result.warnings.forEach((w: string) => addLog(`⚠️ ${w}`));
            }

            setEmployees(result.data.employees);
            setCabs(result.data.cabs);
            setConfig(result.data.config);
            setDataLoaded(true);

            addLog(`✅ Loaded ${result.data.employees.length} employees`);
            addLog(`✅ Loaded ${result.data.cabs.length} cabs`);
            addLog(`🏢 Office: ${result.data.config.officeName} (${result.data.config.officeLat.toFixed(4)}, ${result.data.config.officeLng.toFixed(4)})`);

            // Show employees on map
            updateMapMarkers(result.data.employees, result.data.cabs, result.data.config, []);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to load sample data: ${errMsg}`);
            addLog(`❌ Error: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle file upload
    const handleFileUpload = async (type: 'employees' | 'cabs' | 'config', file: File) => {
        addLog(`📤 Uploading ${type}.csv...`);

        try {
            const result = await parseUploadedFiles({ [type]: file });

            if (result.errors.length > 0) {
                result.errors.forEach((e: { message: string }) => addLog(`❌ ${e.message}`));
            }

            if (type === 'employees' && result.data.employees) {
                setEmployees(result.data.employees);
                addLog(`✅ Loaded ${result.data.employees.length} employees`);
            } else if (type === 'cabs' && result.data.cabs) {
                setCabs(result.data.cabs);
                addLog(`✅ Loaded ${result.data.cabs.length} cabs`);
            } else if (type === 'config' && result.data.config) {
                setConfig(result.data.config);
                addLog(`✅ Loaded config: ${result.data.config.officeName}`);
            }

            setDataLoaded(true);
        } catch (err) {
            addLog(`❌ Failed to parse ${type}.csv`);
        }
    };

    // Update map markers
    const updateMapMarkers = (emps: Employee[], cabList: Cab[], cfg: Config, routeResults: RouteResult[]) => {
        if (!map.current) return;

        // Clear existing markers
        markers.current.forEach((m: mapboxgl.Marker) => m.remove());
        markers.current = [];

        // Clear route layers
        for (let i = 0; i < 10; i++) {
            const layerId = `route-${i}`;
            if (map.current.getLayer(layerId)) {
                map.current.removeLayer(layerId);
            }
            if (map.current.getSource(layerId)) {
                map.current.removeSource(layerId);
            }
        }

        // Add office marker
        const officeEl = document.createElement('div');
        officeEl.innerHTML = '🏢';
        officeEl.style.cssText = 'font-size: 32px; cursor: pointer;';
        const officeMarker = new mapboxgl.Marker({ element: officeEl })
            .setLngLat([cfg.officeLng, cfg.officeLat])
            .setPopup(new mapboxgl.Popup().setHTML(`<b>${cfg.officeName}</b><br/>Lat: ${cfg.officeLat.toFixed(4)}<br/>Lng: ${cfg.officeLng.toFixed(4)}`))
            .addTo(map.current);
        markers.current.push(officeMarker);

        if (routeResults.length === 0) {
            // Show all employees without colors (before optimization)
            emps.forEach((emp: Employee, idx: number) => {
                const el = document.createElement('div');
                el.style.cssText = `
                    width: 24px; height: 24px;
                    background: #6b7280;
                    border-radius: 50%;
                    border: 2px solid white;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 10px; color: white; font-weight: bold;
                `;
                el.innerText = String(idx + 1);

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([emp.lng, emp.lat])
                    .setPopup(new mapboxgl.Popup().setHTML(`<b>${emp.name}</b><br/>${emp.address}<br/>📍 ${emp.lat.toFixed(4)}, ${emp.lng.toFixed(4)}`))
                    .addTo(map.current!);
                markers.current.push(marker);
            });
        }

        // Fit bounds
        if (emps.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([cfg.officeLng, cfg.officeLat]);
            emps.forEach((e: Employee) => bounds.extend([e.lng, e.lat]));
            map.current.fitBounds(bounds, { padding: 50 });
        }
    };

    // Run multi-cluster optimization with detailed algorithm comparison
    const runOptimization = async () => {
        if (employees.length === 0) {
            setError('Please load employees data first');
            return;
        }
        if (cabs.length === 0) {
            setError('Please load cabs data first');
            return;
        }

        setLoading(true);
        setError(null);
        setRoutes([]);
        setClusterAssignments([]);
        setUnassignedEmps([]);
        setLogs([]);
        stopAllAnimations();

        addLog(`🚀 Starting Multi-Cluster Route Optimization`);
        addLog(`════════════════════════════════════════════`);
        addLog(`📊 Input: ${employees.length} employees, ${cabs.length} cabs`);
        addLog(`🏢 Office: ${config.officeName}`);
        addLog(`⏰ Departure: ${config.departureTime}`);
        addLog(`🚗 Trip Type: ${config.tripType.toUpperCase()}`);
        addLog(``);

        try {
            // Step 1: Cluster and assign
            addLog(`🔷 PHASE 1: CLUSTERING & CAB ASSIGNMENT`);
            addLog(`────────────────────────────────────────`);
            const clusterStartTime = performance.now();
            const clusterResult = optimizeMultiCluster(employees, cabs, config);
            const clusterTime = performance.now() - clusterStartTime;

            setClusterAssignments(clusterResult.assignments);
            setUnassignedEmps(clusterResult.unassignedEmployees);

            addLog(`✅ Clustering completed in ${clusterTime.toFixed(0)}ms`);
            addLog(`📍 Created ${clusterResult.assignments.length} clusters`);

            // Log cluster details
            clusterResult.assignments.forEach((a, idx) => {
                addLog(`   Cluster ${idx + 1}: ${a.cluster.employees.length} employees → ${a.cab.name}`);
                a.cluster.employees.forEach((emp, i) => {
                    addLog(`      ${i + 1}. ${emp.name} (${emp.address})`);
                });
            });

            if (clusterResult.unassignedEmployees.length > 0) {
                addLog(`⚠️ ${clusterResult.unassignedEmployees.length} employees unassigned (capacity exceeded)`);
            }

            clusterResult.warnings.forEach((w: string) => addLog(`⚠️ ${w}`));
            addLog(``);

            // Step 2: Optimize route for each assignment with algorithm comparison
            addLog(`🔷 PHASE 2: ROUTE OPTIMIZATION (Per-Cab)`);
            addLog(`────────────────────────────────────────`);

            const routeResults: RouteResult[] = [];
            let totalDist = 0;
            let totalDur = 0;

            for (let i = 0; i < clusterResult.assignments.length; i++) {
                const assignment = clusterResult.assignments[i];
                const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

                addLog(``);
                addLog(`🚗 CAB ${i + 1}: ${assignment.cab.name}`);
                addLog(`   Driver: ${assignment.cab.driver}`);
                addLog(`   Capacity: ${assignment.cab.seats} seats`);
                addLog(`   Passengers: ${assignment.cluster.employees.length}`);
                addLog(`   ─────────────────────────`);

                try {
                    // Build destinations for optimizer
                    const destinations = assignment.cluster.employees.map((e: Employee) => ({
                        id: e.id,
                        name: e.name,
                        address: e.address,
                        lat: e.lat,
                        lng: e.lng,
                    }));

                    // Run optimization with all algorithms
                    const algorithms: AlgorithmResult[] = [];

                    // Test each algorithm
                    const methodsToTest: OptimizationMethod[] = ['nearest_neighbor', 'christofides', 'genetic_algorithm'];

                    for (const method of methodsToTest) {
                        const startTime = performance.now();
                        try {
                            const result = await optimizeRoute({
                                origin: {
                                    id: 'office',
                                    name: config.officeName,
                                    address: config.officeAddress,
                                    lat: config.officeLat,
                                    lng: config.officeLng,
                                },
                                destinations,
                                tripType: config.tripType,
                                constraints: { departureTime: config.departureTime, bufferPerStop: 2 },
                                options: {
                                    useOSRM: true,
                                    useTraffic: false,
                                    method,
                                    generateAlternatives: false,
                                },
                            });
                            const timeMs = performance.now() - startTime;

                            algorithms.push({
                                name: method === 'nearest_neighbor' ? 'Nearest Neighbor' :
                                    method === 'christofides' ? 'Christofides' : 'Genetic Algorithm',
                                distance: result.primaryRoute.totalDistance,
                                duration: result.primaryRoute.totalDuration,
                                timeMs,
                            });
                        } catch (err) {
                            addLog(`   ⚠️ ${method} failed`);
                        }
                    }

                    // Run exhaustive if small enough
                    if (assignment.cluster.employees.length <= 8) {
                        const startTime = performance.now();
                        try {
                            const result = await optimizeRoute({
                                origin: {
                                    id: 'office',
                                    name: config.officeName,
                                    address: config.officeAddress,
                                    lat: config.officeLat,
                                    lng: config.officeLng,
                                },
                                destinations,
                                tripType: config.tripType,
                                constraints: { departureTime: config.departureTime, bufferPerStop: 2 },
                                options: {
                                    useOSRM: true,
                                    useTraffic: false,
                                    method: 'christofides',
                                    generateAlternatives: true,
                                },
                            });
                            const timeMs = performance.now() - startTime;

                            algorithms.push({
                                name: `Exhaustive (${factorial(assignment.cluster.employees.length)} routes)`,
                                distance: result.primaryRoute.totalDistance,
                                duration: result.primaryRoute.totalDuration,
                                timeMs,
                            });
                        } catch (err) {
                            // Exhaustive failed
                        }
                    }

                    // Find winner (shortest distance)
                    algorithms.sort((a, b) => a.distance - b.distance);
                    const winner = algorithms[0];

                    // Log algorithm comparison
                    addLog(`   🔬 Algorithm Comparison:`);
                    algorithms.forEach((algo, idx) => {
                        const icon = idx === 0 ? '🏆' : '  ';
                        addLog(`   ${icon} ${algo.name}: ${algo.distance.toFixed(2)}km (${algo.timeMs.toFixed(0)}ms)`);
                    });

                    // Get final optimized result
                    const finalResult = await optimizeRoute({
                        origin: {
                            id: 'office',
                            name: config.officeName,
                            address: config.officeAddress,
                            lat: config.officeLat,
                            lng: config.officeLng,
                        },
                        destinations,
                        tripType: config.tripType,
                        constraints: { departureTime: config.departureTime, bufferPerStop: 2 },
                        options: {
                            useOSRM: true,
                            useTraffic: false,
                            method: 'christofides',
                            generateAlternatives: false,
                        },
                    });

                    // Get real road geometry
                    let routeCoords: Coordinate[] = [];
                    try {
                        const coordsForRoute: Coordinate[] = [
                            { lat: config.officeLat, lng: config.officeLng },
                            ...finalResult.primaryRoute.stops.map((s: { location: { lat: number; lng: number } }) => ({ lat: s.location.lat, lng: s.location.lng })),
                            { lat: config.officeLat, lng: config.officeLng },
                        ];

                        const osrmRoute = await getRoute(coordsForRoute, {
                            overview: 'full',
                            geometries: 'polyline',
                        });

                        if (osrmRoute.code === 'Ok' && osrmRoute.routes[0]?.geometry) {
                            routeCoords = decodePolyline(osrmRoute.routes[0].geometry as string);
                            addLog(`   ✅ Mapbox road geometry loaded (${routeCoords.length} points)`);
                        }
                    } catch (routeErr) {
                        addLog(`   ⚠️ Using straight-line fallback`);
                        routeCoords = [
                            { lat: config.officeLat, lng: config.officeLng },
                            ...finalResult.primaryRoute.stops.map((s: { location: { lat: number; lng: number } }) => ({ lat: s.location.lat, lng: s.location.lng })),
                            { lat: config.officeLat, lng: config.officeLng },
                        ];
                    }

                    // Build stop order with ETAs
                    const stopOrder = finalResult.primaryRoute.stops.map((stop: { location: { name: string; address: string }; arrivalTime: string }, idx: number) => ({
                        name: stop.location.name,
                        address: stop.location.address,
                        eta: stop.arrivalTime,
                    }));

                    addLog(`   📍 Optimized Route Order:`);
                    stopOrder.forEach((stop: { name: string; address: string; eta: string }, idx: number) => {
                        addLog(`      ${idx + 1}. ${stop.name} → ETA: ${stop.eta}`);
                    });
                    addLog(`   📊 Total: ${winner.distance.toFixed(2)}km, ${Math.round(winner.duration)}min`);

                    routeResults.push({
                        cabId: assignment.cab.id,
                        cabName: assignment.cab.name,
                        driverName: assignment.cab.driver,
                        employees: assignment.cluster.employees,
                        cluster: assignment.cluster,
                        route: routeCoords,
                        totalDistance: winner.distance,
                        totalDuration: winner.duration,
                        color,
                        optimizationResult: finalResult,
                        algorithms,
                        winner: winner.name,
                        stopOrder,
                    });

                    totalDist += winner.distance;
                    totalDur += winner.duration;

                } catch (optErr) {
                    addLog(`   ❌ Optimization failed for ${assignment.cab.name}`);
                }
            }

            setRoutes(routeResults);
            setTotalMetrics({
                distance: totalDist,
                duration: totalDur,
                employees: employees.length - clusterResult.unassignedEmployees.length,
                cabs: routeResults.length,
            });

            // Draw routes on map
            drawRoutesOnMap(routeResults);

            addLog(``);
            addLog(`════════════════════════════════════════════`);
            addLog(`🏆 OPTIMIZATION COMPLETE`);
            addLog(`────────────────────────────────────────`);
            addLog(`📊 Total Routes: ${routeResults.length}`);
            addLog(`📏 Total Distance: ${totalDist.toFixed(2)}km`);
            addLog(`⏱️ Total Duration: ${Math.round(totalDur)}min`);
            addLog(`👥 Employees Assigned: ${employees.length - clusterResult.unassignedEmployees.length}/${employees.length}`);
            addLog(`════════════════════════════════════════════`);

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(`Optimization failed: ${errMsg}`);
            addLog(`❌ Error: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    // Helper function for factorial
    const factorial = (n: number): number => {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    };

    // Draw all routes on map with different colors
    const drawRoutesOnMap = (routeResults: RouteResult[]) => {
        if (!map.current) return;

        // Clear existing route layers first
        for (let i = 0; i < 10; i++) {
            const layerId = `route-${i}`;
            if (map.current.getLayer(layerId)) {
                map.current.removeLayer(layerId);
            }
            if (map.current.getSource(layerId)) {
                map.current.removeSource(layerId);
            }
        }

        // Add routes
        const addRoutes = () => {
            routeResults.forEach((route: RouteResult, idx: number) => {
                if (route.route.length < 2) return;

                const layerId = `route-${idx}`;

                try {
                    map.current?.addSource(layerId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'LineString',
                                coordinates: route.route.map((c: Coordinate) => [c.lng, c.lat]),
                            },
                        },
                    });

                    map.current?.addLayer({
                        id: layerId,
                        type: 'line',
                        source: layerId,
                        paint: {
                            'line-color': route.color,
                            'line-width': 4,
                            'line-opacity': 0.8,
                        },
                    });
                } catch (e) {
                    console.warn('Failed to add route layer:', e);
                }
            });

            // Update employee markers with cluster colors
            markers.current.forEach((m: mapboxgl.Marker) => m.remove());
            markers.current = [];

            // Office marker
            const officeEl = document.createElement('div');
            officeEl.innerHTML = '🏢';
            officeEl.style.cssText = 'font-size: 32px; cursor: pointer;';
            const officeMarker = new mapboxgl.Marker({ element: officeEl })
                .setLngLat([config.officeLng, config.officeLat])
                .setPopup(new mapboxgl.Popup().setHTML(`<b>${config.officeName}</b>`))
                .addTo(map.current!);
            markers.current.push(officeMarker);

            // Employee markers with cluster colors and stop numbers
            routeResults.forEach((route: RouteResult) => {
                route.stopOrder.forEach((stop: { name: string; address: string; eta: string }, idx: number) => {
                    const emp = route.employees.find((e: Employee) => e.name === stop.name);
                    if (!emp) return;

                    const el = document.createElement('div');
                    el.style.cssText = `
                        width: 28px; height: 28px;
                        background: ${route.color};
                        border-radius: 50%;
                        border: 3px solid white;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 12px; color: white; font-weight: bold;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    `;
                    el.innerText = String(idx + 1);

                    const marker = new mapboxgl.Marker({ element: el })
                        .setLngLat([emp.lng, emp.lat])
                        .setPopup(new mapboxgl.Popup().setHTML(
                            `<b>Stop #${idx + 1}</b><br/>${emp.name}<br/>${emp.address}<br/>🚗 ${route.cabName}<br/>⏰ ETA: ${stop.eta}`
                        ))
                        .addTo(map.current!);
                    markers.current.push(marker);
                });
            });

            // Unassigned employees in gray
            unassignedEmps.forEach((emp: Employee) => {
                const el = document.createElement('div');
                el.style.cssText = `
                    width: 24px; height: 24px;
                    background: #6b7280;
                    border-radius: 50%;
                    border: 2px solid #ef4444;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 10px; color: white; font-weight: bold;
                `;
                el.innerText = '!';

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([emp.lng, emp.lat])
                    .setPopup(new mapboxgl.Popup().setHTML(
                        `<b>${emp.name}</b><br/>${emp.address}<br/>⚠️ Not assigned`
                    ))
                    .addTo(map.current!);
                markers.current.push(marker);
            });
        };

        if (map.current.isStyleLoaded()) {
            addRoutes();
        } else {
            map.current.once('style.load', addRoutes);
        }
    };

    // Animate a single route
    const animateRoute = (routeIdx: number) => {
        const route = routes[routeIdx];
        if (!route || !map.current || route.route.length < 2) return;

        setAnimating(true);

        // Create vehicle marker
        const vehicleEl = document.createElement('div');
        vehicleEl.innerHTML = '🚗';
        vehicleEl.style.cssText = 'font-size: 24px; transform: rotate(0deg);';

        const vehicleMarker = new mapboxgl.Marker({ element: vehicleEl })
            .setLngLat([route.route[0].lng, route.route[0].lat])
            .addTo(map.current);

        vehicleMarkers.current[route.cabId] = vehicleMarker;

        let step = 0;
        const totalSteps = route.route.length;
        const stepDuration = 50; // ms per step

        const animate = () => {
            if (step >= totalSteps) {
                vehicleMarker.remove();
                delete vehicleMarkers.current[route.cabId];
                setAnimating(false);
                return;
            }

            const point = route.route[step];
            vehicleMarker.setLngLat([point.lng, point.lat]);

            // Calculate rotation
            if (step < totalSteps - 1) {
                const next = route.route[step + 1];
                const angle = Math.atan2(next.lng - point.lng, next.lat - point.lat) * 180 / Math.PI;
                vehicleEl.style.transform = `rotate(${angle}deg)`;
            }

            step++;
            animationRefs.current[route.cabId] = requestAnimationFrame(() => {
                setTimeout(animate, stepDuration);
            });
        };

        animate();
    };

    // Animate all routes simultaneously
    const animateAllRoutes = () => {
        if (routes.length === 0) return;

        setAnimatingAll(true);

        routes.forEach((route, idx) => {
            if (!map.current || route.route.length < 2) return;

            // Create vehicle marker
            const vehicleEl = document.createElement('div');
            vehicleEl.innerHTML = '🚗';
            vehicleEl.style.cssText = `font-size: 24px; filter: drop-shadow(0 0 4px ${route.color});`;

            const vehicleMarker = new mapboxgl.Marker({ element: vehicleEl })
                .setLngLat([route.route[0].lng, route.route[0].lat])
                .addTo(map.current!);

            vehicleMarkers.current[route.cabId] = vehicleMarker;

            let step = 0;
            const totalSteps = route.route.length;
            const stepDuration = 30;

            const animate = () => {
                if (step >= totalSteps) {
                    vehicleMarker.remove();
                    delete vehicleMarkers.current[route.cabId];

                    // Check if all animations are done
                    if (Object.keys(vehicleMarkers.current).length === 0) {
                        setAnimatingAll(false);
                    }
                    return;
                }

                const point = route.route[step];
                vehicleMarker.setLngLat([point.lng, point.lat]);

                if (step < totalSteps - 1) {
                    const next = route.route[step + 1];
                    const angle = Math.atan2(next.lng - point.lng, next.lat - point.lat) * 180 / Math.PI;
                    vehicleEl.style.transform = `rotate(${angle}deg)`;
                }

                step++;
                animationRefs.current[`${route.cabId}-${idx}`] = requestAnimationFrame(() => {
                    setTimeout(animate, stepDuration);
                });
            };

            animate();
        });
    };

    // Stop all animations
    const stopAllAnimations = () => {
        Object.values(animationRefs.current).forEach(id => cancelAnimationFrame(id));
        animationRefs.current = {};

        Object.values(vehicleMarkers.current).forEach(marker => marker.remove());
        vehicleMarkers.current = {};

        setAnimating(false);
        setAnimatingAll(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        🚀 Multi-Cluster Route Optimizer V2 Enhanced
                    </h1>
                    <p className="text-gray-400 text-sm">
                        CSV Data → K-Means Clustering → Cab Assignment → Per-Cab Route Optimization → Multi-Route Animation
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-4">
                <div className="grid lg:grid-cols-12 gap-4">
                    {/* Left Panel - Data & Controls */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Data Source */}
                        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setActiveTab('sample')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${activeTab === 'sample' ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400' : 'bg-white/5 border border-white/10'}`}
                                >
                                    📂 Sample
                                </button>
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${activeTab === 'upload' ? 'bg-purple-500/20 border border-purple-500 text-purple-400' : 'bg-white/5 border border-white/10'}`}
                                >
                                    📤 Upload
                                </button>
                            </div>

                            {activeTab === 'sample' ? (
                                <button
                                    onClick={handleLoadSample}
                                    disabled={loading}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 font-medium hover:opacity-90 disabled:opacity-50"
                                >
                                    {loading ? '⏳ Loading...' : '📂 Load Sample Data'}
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    {(['employees', 'cabs', 'config'] as const).map(type => (
                                        <div key={type}>
                                            <label className="text-xs text-gray-400 capitalize">{type}.csv</label>
                                            <input
                                                type="file"
                                                accept=".csv"
                                                onChange={(e) => e.target.files?.[0] && handleFileUpload(type, e.target.files[0])}
                                                className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-white/10 file:text-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Data Summary */}
                        {dataLoaded && (
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                <h3 className="font-bold mb-2">📊 Data Loaded</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="p-2 rounded-lg bg-white/5 text-center">
                                        <div className="text-xl font-bold text-cyan-400">{employees.length}</div>
                                        <div className="text-xs text-gray-400">Employees</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/5 text-center">
                                        <div className="text-xl font-bold text-purple-400">{cabs.length}</div>
                                        <div className="text-xs text-gray-400">Cabs</div>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-400">
                                    Total capacity: {cabs.reduce((s, c) => s + c.seats, 0)} seats
                                </div>
                            </div>
                        )}

                        {/* Optimize Button */}
                        <button
                            onClick={runOptimization}
                            disabled={loading || !dataLoaded}
                            className="w-full py-3 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 font-bold hover:opacity-90 disabled:opacity-50 shadow-lg"
                        >
                            {loading ? '⏳ Optimizing...' : '🧠 Optimize All Routes'}
                        </button>

                        {/* Animation Controls */}
                        {routes.length > 0 && (
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                <h3 className="font-bold mb-2">🎬 Animation</h3>
                                <button
                                    onClick={animateAllRoutes}
                                    disabled={animating || animatingAll}
                                    className="w-full py-2 mb-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-sm font-medium disabled:opacity-50"
                                >
                                    {animatingAll ? '🚗 Running...' : '▶️ Animate All Cabs'}
                                </button>
                                <button
                                    onClick={stopAllAnimations}
                                    className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm"
                                >
                                    ⏹️ Stop
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500 text-red-400 text-sm">
                                ❌ {error}
                            </div>
                        )}
                    </div>

                    {/* Center - Map */}
                    <div className="lg:col-span-5">
                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-800/50">
                            <div ref={mapContainer} className="w-full h-[450px]" />
                        </div>

                        {/* Legend */}
                        {routes.length > 0 && (
                            <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3">
                                <div className="flex flex-wrap gap-3">
                                    {routes.map((r, idx) => (
                                        <button
                                            key={r.cabId}
                                            onClick={() => {
                                                setSelectedRoute(selectedRoute === idx ? null : idx);
                                                animateRoute(idx);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
                                        >
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                                            <span className="text-xs">{r.cabName}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Results */}
                    <div className="lg:col-span-4 space-y-4">
                        {/* Total Metrics */}
                        {totalMetrics && (
                            <div className="rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 p-4">
                                <h3 className="font-bold mb-2">🏆 Total Summary</h3>
                                <div className="grid grid-cols-4 gap-2 text-sm">
                                    <div className="p-2 rounded-lg bg-white/5 text-center">
                                        <div className="text-lg font-bold text-green-400">{totalMetrics.distance.toFixed(1)}</div>
                                        <div className="text-[10px] text-gray-400">km</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/5 text-center">
                                        <div className="text-lg font-bold text-blue-400">{Math.round(totalMetrics.duration)}</div>
                                        <div className="text-[10px] text-gray-400">min</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/5 text-center">
                                        <div className="text-lg font-bold text-purple-400">{totalMetrics.employees}</div>
                                        <div className="text-[10px] text-gray-400">assigned</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/5 text-center">
                                        <div className="text-lg font-bold text-pink-400">{totalMetrics.cabs}</div>
                                        <div className="text-[10px] text-gray-400">routes</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Per-Route Details */}
                        {routes.length > 0 && (
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 max-h-[400px] overflow-y-auto">
                                <h3 className="font-bold mb-3">🚗 Route Details</h3>
                                {routes.map((r, idx) => (
                                    <div key={r.cabId} className="mb-4 p-3 rounded-xl bg-white/5 border-l-4" style={{ borderColor: r.color }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold">{r.cabName}</div>
                                                <div className="text-xs text-gray-400">{r.driverName} • {r.employees.length} passengers</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold" style={{ color: r.color }}>{r.totalDistance.toFixed(1)}km</div>
                                                <div className="text-xs text-gray-400">{Math.round(r.totalDuration)}min</div>
                                            </div>
                                        </div>

                                        {/* Winner */}
                                        <div className="text-xs bg-yellow-500/20 rounded px-2 py-1 mb-2">
                                            🏆 Winner: {r.winner}
                                        </div>

                                        {/* Algorithm Comparison */}
                                        <div className="text-xs mb-2">
                                            <div className="text-gray-400 mb-1">🔬 Algorithm Comparison:</div>
                                            {r.algorithms.slice(0, 3).map((algo, i) => (
                                                <div key={algo.name} className={`flex justify-between ${i === 0 ? 'text-green-400' : 'text-gray-400'}`}>
                                                    <span>{i === 0 ? '🏆' : '  '} {algo.name}</span>
                                                    <span>{algo.distance.toFixed(2)}km</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Route Order */}
                                        <div className="text-xs">
                                            <div className="text-gray-400 mb-1">📍 Stop Order:</div>
                                            {r.stopOrder.map((stop, i) => (
                                                <div key={i} className="flex justify-between text-gray-300">
                                                    <span>{i + 1}. {stop.name}</span>
                                                    <span className="text-gray-500">{stop.eta}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Animate Button */}
                                        <button
                                            onClick={() => animateRoute(idx)}
                                            disabled={animating}
                                            className="mt-2 w-full py-1 rounded text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50"
                                        >
                                            ▶️ Animate This Route
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Unassigned Warning */}
                        {unassignedEmps.length > 0 && (
                            <div className="rounded-xl bg-orange-500/20 border border-orange-500/30 p-3">
                                <h3 className="font-bold text-sm text-orange-400 mb-1">⚠️ Unassigned ({unassignedEmps.length})</h3>
                                <div className="text-xs text-gray-300 max-h-20 overflow-y-auto">
                                    {unassignedEmps.map((e) => <div key={e.id}>{e.name}</div>)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Full-width Log Panel */}
                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                    <h3 className="font-bold mb-2">📋 Detailed Optimization Log</h3>
                    <div className="h-48 overflow-y-auto bg-black/30 rounded-lg p-3 font-mono text-xs space-y-0.5">
                        {logs.length === 0 ? (
                            <p className="text-gray-500">Load data and click "Optimize" to see detailed logs...</p>
                        ) : (
                            logs.map((log, i) => (
                                <p key={i} className={
                                    log.includes('════') ? 'text-cyan-400 font-bold' :
                                        log.includes('────') ? 'text-cyan-400/50' :
                                            log.includes('🏆') ? 'text-yellow-400' :
                                                log.includes('✅') ? 'text-green-400' :
                                                    log.includes('❌') ? 'text-red-400' :
                                                        log.includes('⚠️') ? 'text-orange-400' :
                                                            log.includes('🔷') ? 'text-blue-400 font-bold' :
                                                                log.includes('🚗') ? 'text-purple-400 font-medium' :
                                                                    log.startsWith('   ') ? 'text-gray-400' : 'text-gray-300'
                                }>{log}</p>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
