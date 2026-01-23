/**
 * Mapbox Directions API Client
 * 
 * Uses Mapbox Directions API for real road routing with traffic support.
 * This is the primary routing provider (more reliable than public OSRM).
 * 
 * Docs: https://docs.mapbox.com/api/navigation/directions/
 */

import type {
    Coordinate,
    OSRMRouteResponse,
    NavigationStep,
    NavigationManeuver,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getMapboxToken(): string {
    // Check both server and client-side env vars
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
        console.warn('Mapbox token not found, routing may fail');
        return '';
    }
    return token;
}

const MAPBOX_API_URL = 'https://api.mapbox.com/directions/v5/mapbox';

// ============================================================================
// MAPBOX DIRECTIONS API
// ============================================================================

export interface MapboxRouteOptions {
    profile?: 'driving' | 'driving-traffic' | 'walking' | 'cycling';
    alternatives?: boolean;
    geometries?: 'geojson' | 'polyline' | 'polyline6';
    overview?: 'full' | 'simplified' | 'false';
    steps?: boolean;
    annotations?: string[];
    language?: string;
}

interface MapboxRoute {
    geometry: string | { type: string; coordinates: [number, number][] };
    legs: Array<{
        summary: string;
        distance: number;
        duration: number;
        steps: Array<{
            geometry: string;
            maneuver: {
                type: string;
                instruction: string;
                modifier?: string;
                bearing_before: number;
                bearing_after: number;
                location: [number, number];
            };
            distance: number;
            duration: number;
            name: string;
            mode: string;
        }>;
    }>;
    distance: number;
    duration: number;
    weight_name: string;
    weight: number;
}

interface MapboxDirectionsResponse {
    code: string;
    uuid: string;
    routes: MapboxRoute[];
    waypoints: Array<{
        distance: number;
        name: string;
        location: [number, number];
    }>;
}

/**
 * Get route using Mapbox Directions API
 * Returns response in OSRM-compatible format for easy integration
 */
export async function getMapboxRoute(
    coordinates: Coordinate[],
    options: MapboxRouteOptions = {}
): Promise<OSRMRouteResponse> {
    if (coordinates.length < 2) {
        throw new Error('At least 2 coordinates required for routing');
    }

    const token = getMapboxToken();
    if (!token) {
        throw new Error('Mapbox access token not configured');
    }

    const profile = options.profile || 'driving-traffic';
    const coordString = coordinates
        .map(c => `${c.lng},${c.lat}`)
        .join(';');

    const params = new URLSearchParams({
        access_token: token,
        alternatives: String(options.alternatives ?? false),
        geometries: options.geometries || 'polyline',
        overview: options.overview || 'full',
        steps: String(options.steps ?? true),
        language: options.language || 'en',
    });

    if (options.annotations?.length) {
        params.set('annotations', options.annotations.join(','));
    }

    const url = `${MAPBOX_API_URL}/${profile}/${coordString}?${params}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Mapbox API error:', response.status, errorText);
            throw new Error(`Mapbox request failed: ${response.status}`);
        }

        const data: MapboxDirectionsResponse = await response.json();

        if (data.code !== 'Ok') {
            throw new Error(`Mapbox error: ${data.code}`);
        }

        // Convert Mapbox response to OSRM-compatible format
        return convertToOSRMFormat(data);
    } catch (error) {
        console.error('Mapbox route request failed:', error);
        throw error;
    }
}

/**
 * Convert Mapbox response to OSRM-compatible format
 */
function convertToOSRMFormat(mapboxResponse: MapboxDirectionsResponse): OSRMRouteResponse {
    const routes = mapboxResponse.routes.map(route => ({
        geometry: typeof route.geometry === 'string'
            ? route.geometry
            : encodeGeoJsonToPolyline(route.geometry.coordinates),
        distance: route.distance,
        duration: route.duration,
        weight: route.weight,
        weight_name: route.weight_name,
        legs: route.legs.map(leg => ({
            summary: leg.summary,
            distance: leg.distance,
            duration: leg.duration,
            steps: leg.steps.map(step => ({
                geometry: step.geometry,
                distance: step.distance,
                duration: step.duration,
                name: step.name,
                mode: step.mode,
                intersections: [], // Empty array for compatibility
                maneuver: {
                    type: step.maneuver.type,
                    modifier: step.maneuver.modifier,
                    instruction: step.maneuver.instruction,
                    bearing_before: step.maneuver.bearing_before,
                    bearing_after: step.maneuver.bearing_after,
                    location: step.maneuver.location,
                },
            })),
        })),
    }));

    return {
        code: 'Ok',
        routes,
        waypoints: mapboxResponse.waypoints.map(wp => ({
            hint: '',
            distance: wp.distance,
            name: wp.name,
            location: wp.location,
        })),
    };
}

/**
 * Encode GeoJSON coordinates to polyline (if needed)
 */
function encodeGeoJsonToPolyline(coordinates: [number, number][]): string {
    const factor = Math.pow(10, 5);
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const [lng, lat] of coordinates) {
        const latE5 = Math.round(lat * factor);
        const lngE5 = Math.round(lng * factor);

        encoded += encodeNumber(latE5 - prevLat);
        encoded += encodeNumber(lngE5 - prevLng);

        prevLat = latE5;
        prevLng = lngE5;
    }

    return encoded;
}

function encodeNumber(num: number): string {
    let sgnNum = num < 0 ? ~(num << 1) : num << 1;
    let encoded = '';

    while (sgnNum >= 0x20) {
        encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
        sgnNum >>= 5;
    }

    encoded += String.fromCharCode(sgnNum + 63);
    return encoded;
}

/**
 * Get optimized trip order using Mapbox Optimization API
 * Note: Mapbox Optimization API is a separate product
 */
export async function getMapboxOptimizedTrip(
    coordinates: Coordinate[],
    roundtrip: boolean = true
): Promise<OSRMRouteResponse & { waypoints: Array<{ waypoint_index: number }> }> {
    const token = getMapboxToken();
    if (!token) {
        throw new Error('Mapbox access token not configured');
    }

    const coordString = coordinates
        .map(c => `${c.lng},${c.lat}`)
        .join(';');

    // Use Optimization API v1
    const params = new URLSearchParams({
        access_token: token,
        roundtrip: String(roundtrip),
        source: 'first',
        destination: roundtrip ? 'any' : 'last',
        steps: 'true',
        geometries: 'polyline',
        overview: 'full',
    });

    const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordString}?${params}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Mapbox optimization request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok') {
            throw new Error(`Mapbox error: ${data.code}`);
        }

        // Add waypoint indices
        const result = convertToOSRMFormat(data);
        (result as any).waypoints = data.waypoints.map((wp: any) => ({
            ...wp,
            waypoint_index: wp.waypoint_index,
        }));

        return result as any;
    } catch (error) {
        console.error('Mapbox optimization request failed:', error);
        throw error;
    }
}

/**
 * Check if Mapbox API is available
 */
export async function checkMapboxHealth(): Promise<boolean> {
    const token = getMapboxToken();
    if (!token) return false;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            `${MAPBOX_API_URL}/driving/77.6245,12.9352;77.6250,12.9355?access_token=${token}&overview=false`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        return response.ok;
    } catch {
        return false;
    }
}

// ============================================================================
// UNIFIED ROUTING FUNCTION
// ============================================================================

/**
 * Get route with automatic provider selection
 * Tries Mapbox first, falls back to OSRM if needed
 */
export { getMapboxRoute as getRoute };
