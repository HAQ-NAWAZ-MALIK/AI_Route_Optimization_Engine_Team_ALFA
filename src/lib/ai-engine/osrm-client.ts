/**
 * OSRM Client
 * Integration with Open Source Routing Machine for real road network routing
 * 
 * Uses the public OSRM server by default: router.project-osrm.org
 * Can be configured to use a self-hosted instance via OSRM_SERVER_URL env var
 */

import type {
    Coordinate,
    OSRMRouteRequest,
    OSRMRouteResponse,
    OSRMTableResponse,
    NavigationStep,
    NavigationManeuver,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Use public OSRM server - works on both client and server
// Note: OSRM_SERVER_URL env var only works server-side, so we default to public
const DEFAULT_OSRM_URL = 'https://router.project-osrm.org';

function getOSRMUrl(): string {
    // Only check env on server side
    if (typeof window === 'undefined' && process.env.OSRM_SERVER_URL) {
        return process.env.OSRM_SERVER_URL;
    }
    return DEFAULT_OSRM_URL;
}

// ============================================================================
// OSRM API CLIENT
// ============================================================================

/**
 * Get route between coordinates
 * Uses Mapbox Directions API as primary, OSRM as fallback
 */
export async function getRoute(
    coordinates: Coordinate[],
    options: Partial<OSRMRouteRequest> = {}
): Promise<OSRMRouteResponse> {
    if (coordinates.length < 2) {
        throw new Error('At least 2 coordinates required for routing');
    }

    // Try Mapbox first (more reliable)
    try {
        const { getMapboxRoute } = await import('./mapbox-directions');
        const mapboxResult = await getMapboxRoute(coordinates, {
            profile: 'driving-traffic',
            alternatives: options.alternatives,
            geometries: options.geometries as any,
            overview: options.overview as any,
            steps: options.steps,
        });
        console.log('[Mapbox] Routing succeeded');
        return mapboxResult;
    } catch (mapboxError) {
        console.warn('Mapbox routing failed, trying OSRM fallback:', mapboxError);
    }

    // Fallback to OSRM
    const coordString = coordinates
        .map(c => `${c.lng},${c.lat}`)
        .join(';');

    const params = new URLSearchParams({
        alternatives: String(options.alternatives ?? false),
        steps: String(options.steps ?? true),
        geometries: options.geometries ?? 'polyline',
        overview: options.overview ?? 'full',
        annotations: String(options.annotations ?? false),
    });

    // Use proxy API in browser, direct OSRM on server
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser
        ? `/api/osrm?service=route&coordinates=${coordString}&${params}`
        : `${getOSRMUrl()}/route/v1/driving/${coordString}?${params}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`OSRM request failed: ${response.status}`);
        }

        const data: OSRMRouteResponse = await response.json();

        if (data.code !== 'Ok') {
            throw new Error(`OSRM error: ${data.code}`);
        }

        console.log('[OSRM] Routing succeeded (fallback)');
        return data;
    } catch (error) {
        console.error('OSRM route request failed:', error);
        throw error;
    }
}



/**
 * Get distance/duration matrix between all pairs of coordinates
 * Useful for TSP and optimization algorithms
 */
export async function getDistanceMatrix(
    sources: Coordinate[],
    destinations?: Coordinate[]
): Promise<OSRMTableResponse> {
    const baseUrl = getOSRMUrl();

    // If no separate destinations, use sources for both
    const coords = destinations
        ? [...sources, ...destinations]
        : sources;

    const coordString = coords
        .map(c => `${c.lng},${c.lat}`)
        .join(';');

    // Build source/destination indices
    const params = new URLSearchParams({
        annotations: 'duration,distance',
    });

    if (destinations) {
        const sourceIndices = sources.map((_, i) => i).join(';');
        const destIndices = destinations.map((_, i) => i + sources.length).join(';');
        params.set('sources', sourceIndices);
        params.set('destinations', destIndices);
    }

    const url = `${baseUrl}/table/v1/driving/${coordString}?${params}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`OSRM table request failed: ${response.status}`);
        }

        const data: OSRMTableResponse = await response.json();

        if (data.code !== 'Ok') {
            throw new Error(`OSRM error: ${data.code}`);
        }

        return data;
    } catch (error) {
        console.error('OSRM table request failed:', error);
        throw error;
    }
}

/**
 * Get trip optimization from OSRM (solves TSP)
 * Note: OSRM trip service finds optimal order to visit waypoints
 */
export async function getOptimizedTrip(
    coordinates: Coordinate[],
    roundtrip: boolean = true
): Promise<OSRMRouteResponse & { waypoints: Array<{ waypoint_index: number }> }> {
    if (coordinates.length < 2) {
        throw new Error('At least 2 coordinates required for trip');
    }

    const baseUrl = getOSRMUrl();
    const coordString = coordinates
        .map(c => `${c.lng},${c.lat}`)
        .join(';');

    const params = new URLSearchParams({
        roundtrip: String(roundtrip),
        source: 'first',
        destination: roundtrip ? 'any' : 'last',
        steps: 'true',
        geometries: 'polyline',
        overview: 'full',
    });

    const url = `${baseUrl}/trip/v1/driving/${coordString}?${params}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`OSRM trip request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok') {
            throw new Error(`OSRM error: ${data.code}`);
        }

        return data;
    } catch (error) {
        console.error('OSRM trip request failed:', error);
        throw error;
    }
}

/**
 * Find nearest road point to a given coordinate
 */
export async function getNearestPoint(
    coordinate: Coordinate
): Promise<{ location: Coordinate; distance: number; name: string }> {
    const baseUrl = getOSRMUrl();
    const url = `${baseUrl}/nearest/v1/driving/${coordinate.lng},${coordinate.lat}?number=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok' || !data.waypoints?.length) {
            throw new Error('No nearest point found');
        }

        const wp = data.waypoints[0];
        return {
            location: { lat: wp.location[1], lng: wp.location[0] },
            distance: wp.distance,
            name: wp.name || 'Unknown',
        };
    } catch (error) {
        console.error('OSRM nearest request failed:', error);
        throw error;
    }
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Convert OSRM route steps to navigation instructions
 */
export function extractNavigationSteps(osrmRoute: OSRMRouteResponse): NavigationStep[] {
    const steps: NavigationStep[] = [];

    if (!osrmRoute.routes?.[0]?.legs) {
        return steps;
    }

    for (const leg of osrmRoute.routes[0].legs) {
        for (const step of leg.steps) {
            steps.push({
                instruction: formatInstruction(step),
                distance: step.distance,
                duration: step.duration,
                type: mapManeuverType(step.maneuver.type),
                modifier: step.maneuver.modifier,
                name: step.name || undefined,
                bearing: step.maneuver.bearing_after,
            });
        }
    }

    return steps;
}

/**
 * Format human-readable navigation instruction
 */
function formatInstruction(step: {
    maneuver: { type: string; modifier?: string };
    name: string;
    distance: number;
}): string {
    const { maneuver, name, distance } = step;
    const distanceStr = formatDistance(distance);

    switch (maneuver.type) {
        case 'depart':
            return `Start on ${name || 'the road'}`;
        case 'arrive':
            return `Arrive at destination${name ? ` on ${name}` : ''}`;
        case 'turn':
            return `Turn ${maneuver.modifier || 'onto'} ${name || 'the road'} (${distanceStr})`;
        case 'continue':
            return `Continue on ${name || 'the road'} for ${distanceStr}`;
        case 'merge':
            return `Merge ${maneuver.modifier || 'onto'} ${name || 'the road'}`;
        case 'roundabout':
            return `Enter roundabout and take exit onto ${name || 'the road'}`;
        case 'fork':
            return `Take the ${maneuver.modifier || 'fork'} onto ${name || 'the road'}`;
        case 'end of road':
            return `At end of road, turn ${maneuver.modifier || ''} onto ${name || 'the road'}`;
        case 'new name':
            return `Continue onto ${name || 'the road'} (${distanceStr})`;
        default:
            return `Continue for ${distanceStr}`;
    }
}

/**
 * Map OSRM maneuver types to our navigation types
 */
function mapManeuverType(osrmType: string): NavigationManeuver {
    const typeMap: Record<string, NavigationManeuver> = {
        'depart': 'depart',
        'arrive': 'arrive',
        'turn': 'turn',
        'continue': 'continue',
        'merge': 'merge',
        'on ramp': 'merge',
        'off ramp': 'fork',
        'roundabout': 'roundabout',
        'rotary': 'roundabout',
        'roundabout turn': 'roundabout',
        'fork': 'fork',
        'end of road': 'end_of_road',
        'new name': 'new_name',
        'notification': 'notification',
    };

    return typeMap[osrmType] || 'continue';
}

/**
 * Format distance in human-readable form
 */
function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Decode polyline to coordinates
 * OSRM uses polyline encoding for geometry
 */
export function decodePolyline(encoded: string, precision: number = 5): Coordinate[] {
    const factor = Math.pow(10, precision);
    const coordinates: Coordinate[] = [];
    let lat = 0;
    let lng = 0;
    let index = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte: number;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        coordinates.push({
            lat: lat / factor,
            lng: lng / factor,
        });
    }

    return coordinates;
}

/**
 * Encode coordinates to polyline
 */
export function encodePolyline(coordinates: Coordinate[], precision: number = 5): string {
    const factor = Math.pow(10, precision);
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const coord of coordinates) {
        const lat = Math.round(coord.lat * factor);
        const lng = Math.round(coord.lng * factor);

        encoded += encodeNumber(lat - prevLat);
        encoded += encodeNumber(lng - prevLng);

        prevLat = lat;
        prevLng = lng;
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
 * Check if OSRM server is available
 */
export async function checkOSRMHealth(): Promise<boolean> {
    const baseUrl = getOSRMUrl();
    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            // Try a simple nearest request which is lightweight
            const response = await fetch(
                `${baseUrl}/nearest/v1/driving/77.6245,12.9352?number=1`,
                {
                    method: 'GET',
                    signal: controller.signal,
                }
            );
            clearTimeout(timeoutId);

            if (!response.ok) return false;

            const data = await response.json();
            return data.code === 'Ok';
        } catch (err) {
            clearTimeout(timeoutId);
            console.warn('OSRM health check failed:', err);
            return false;
        }
    } catch {
        return false;
    }
}
