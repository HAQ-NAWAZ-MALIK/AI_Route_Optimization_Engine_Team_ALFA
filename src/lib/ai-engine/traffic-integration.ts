/**
 * Traffic Integration
 * 
 * Integrates with traffic APIs for real-time traffic data:
 * - TomTom Traffic Flow API (primary)
 * - Traffic incident detection
 * - Dynamic travel time adjustment
 * 
 * Note: TomTom API key to be provided later via TOMTOM_API_KEY env var
 */

import type {
    Coordinate,
    TrafficData,
    TrafficSegment,
    TrafficIncident,
    CongestionLevel,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOMTOM_BASE_URL = 'https://api.tomtom.com';

function getTomTomApiKey(): string | null {
    return process.env.TOMTOM_API_KEY || null;
}

/**
 * Check if traffic API is available
 */
export function isTrafficApiAvailable(): boolean {
    return getTomTomApiKey() !== null;
}

// ============================================================================
// TOMTOM TRAFFIC FLOW API
// ============================================================================

interface TomTomFlowResponse {
    flowSegmentData: {
        frc: string;
        currentSpeed: number;
        freeFlowSpeed: number;
        currentTravelTime: number;
        freeFlowTravelTime: number;
        confidence: number;
        coordinates: {
            coordinate: Array<{ latitude: number; longitude: number }>;
        };
    };
}

/**
 * Get traffic flow data for a specific coordinate
 */
export async function getTrafficFlow(
    coordinate: Coordinate,
    zoom: number = 18
): Promise<TrafficSegment | null> {
    const apiKey = getTomTomApiKey();

    if (!apiKey) {
        console.warn('TomTom API key not configured, skipping traffic data');
        return null;
    }

    const url = `${TOMTOM_BASE_URL}/traffic/services/4/flowSegmentData/relative0/${zoom}/json`;
    const params = new URLSearchParams({
        key: apiKey,
        point: `${coordinate.lat},${coordinate.lng}`,
        unit: 'KMPH',
    });

    try {
        const response = await fetch(`${url}?${params}`);

        if (!response.ok) {
            throw new Error(`TomTom API error: ${response.status}`);
        }

        const data: TomTomFlowResponse = await response.json();
        const flow = data.flowSegmentData;

        return {
            start: coordinate,
            end: coordinate, // Single point flow
            currentSpeed: flow.currentSpeed,
            freeFlowSpeed: flow.freeFlowSpeed,
            congestionLevel: calculateCongestionLevel(flow.currentSpeed, flow.freeFlowSpeed),
            delay: Math.max(0, flow.currentTravelTime - flow.freeFlowTravelTime),
        };
    } catch (error) {
        console.error('Error fetching traffic flow:', error);
        return null;
    }
}

/**
 * Get traffic data along a route (multiple points)
 */
export async function getRouteTrafficData(
    coordinates: Coordinate[]
): Promise<TrafficData> {
    const apiKey = getTomTomApiKey();
    const segments: TrafficSegment[] = [];
    const incidents: TrafficIncident[] = [];

    if (!apiKey) {
        // Return empty traffic data with estimated values
        return createFallbackTrafficData(coordinates);
    }

    // Sample points along the route
    const samplePoints = sampleCoordinates(coordinates, 5); // Max 5 points to limit API calls

    const flows = await Promise.all(
        samplePoints.map(coord => getTrafficFlow(coord))
    );

    for (let i = 0; i < flows.length; i++) {
        if (flows[i]) {
            segments.push(flows[i]!);
        }
    }

    // Get incidents (if we have a bounding box)
    if (coordinates.length >= 2) {
        const bbox = calculateBoundingBox(coordinates);
        const routeIncidents = await getTrafficIncidents(bbox);
        incidents.push(...routeIncidents);
    }

    return {
        timestamp: new Date(),
        segments,
        incidents,
    };
}

// ============================================================================
// TRAFFIC INCIDENTS
// ============================================================================

interface TomTomIncidentsResponse {
    incidents: Array<{
        id: string;
        type: string;
        properties: {
            description?: string;
            delay?: number;
            magnitudeOfDelay?: number;
            startTime?: string;
            endTime?: string;
        };
        geometry: {
            coordinates: [number, number];
        };
    }>;
}

/**
 * Get traffic incidents in a bounding box
 */
export async function getTrafficIncidents(
    bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): Promise<TrafficIncident[]> {
    const apiKey = getTomTomApiKey();

    if (!apiKey) {
        return [];
    }

    const url = `${TOMTOM_BASE_URL}/traffic/services/5/incidentDetails`;
    const params = new URLSearchParams({
        key: apiKey,
        boundingBox: `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`,
        fields: '{incidents{id,type,properties{description,delay,magnitudeOfDelay,startTime,endTime},geometry{coordinates}}}',
        language: 'en-US',
    });

    try {
        const response = await fetch(`${url}?${params}`);

        if (!response.ok) {
            throw new Error(`TomTom incidents API error: ${response.status}`);
        }

        const data: TomTomIncidentsResponse = await response.json();

        return data.incidents.map(incident => ({
            id: incident.id,
            type: mapIncidentType(incident.type),
            location: {
                lat: incident.geometry.coordinates[1],
                lng: incident.geometry.coordinates[0],
            },
            severity: mapSeverity(incident.properties.magnitudeOfDelay ?? 0),
            description: incident.properties.description ?? 'Unknown incident',
            expectedDelay: Math.ceil((incident.properties.delay ?? 0) / 60), // Convert to minutes
            startTime: incident.properties.startTime ? new Date(incident.properties.startTime) : undefined,
            endTime: incident.properties.endTime ? new Date(incident.properties.endTime) : undefined,
        }));
    } catch (error) {
        console.error('Error fetching traffic incidents:', error);
        return [];
    }
}

// ============================================================================
// TRAVEL TIME ADJUSTMENT
// ============================================================================

/**
 * Adjust travel time based on traffic conditions
 */
export function adjustTravelTime(
    baseTimeMinutes: number,
    trafficData: TrafficData | null
): number {
    if (!trafficData || trafficData.segments.length === 0) {
        // Apply default rush hour adjustment if no traffic data
        return applyDefaultTrafficAdjustment(baseTimeMinutes);
    }

    // Calculate average congestion factor
    let totalDelay = 0;
    for (const segment of trafficData.segments) {
        const speedRatio = segment.freeFlowSpeed > 0
            ? segment.currentSpeed / segment.freeFlowSpeed
            : 1;

        // Lower speed ratio = more congestion = more delay
        const segmentDelay = baseTimeMinutes * (1 / speedRatio - 1) / trafficData.segments.length;
        totalDelay += Math.max(0, segmentDelay);
    }

    // Add incident delays
    for (const incident of trafficData.incidents || []) {
        totalDelay += incident.expectedDelay * 0.5; // Partial impact
    }

    return baseTimeMinutes + totalDelay;
}

/**
 * Default traffic adjustment based on time of day
 */
export function applyDefaultTrafficAdjustment(
    baseTimeMinutes: number,
    currentHour?: number
): number {
    const hour = currentHour ?? new Date().getHours();

    let multiplier = 1.0;

    // Morning rush (7-10 AM)
    if (hour >= 7 && hour <= 10) {
        multiplier = 1.5;
    }
    // Evening rush (5-8 PM)
    else if (hour >= 17 && hour <= 20) {
        multiplier = 1.5;
    }
    // Lunch time (12-2 PM)
    else if (hour >= 12 && hour <= 14) {
        multiplier = 1.2;
    }
    // Night (10 PM - 6 AM)
    else if (hour >= 22 || hour <= 6) {
        multiplier = 0.8; // Faster at night
    }

    return baseTimeMinutes * multiplier;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateCongestionLevel(
    currentSpeed: number,
    freeFlowSpeed: number
): CongestionLevel {
    if (freeFlowSpeed === 0) return 'free';

    const ratio = currentSpeed / freeFlowSpeed;

    if (ratio >= 0.9) return 'free';
    if (ratio >= 0.7) return 'light';
    if (ratio >= 0.5) return 'moderate';
    if (ratio >= 0.3) return 'heavy';
    return 'severe';
}

function mapIncidentType(
    tomtomType: string
): 'accident' | 'construction' | 'road_closure' | 'event' | 'weather' {
    const typeMap: Record<string, 'accident' | 'construction' | 'road_closure' | 'event' | 'weather'> = {
        'ACCIDENT': 'accident',
        'CONSTRUCTION': 'construction',
        'ROAD_CLOSURE': 'road_closure',
        'ROAD_CLOSED': 'road_closure',
        'EVENT': 'event',
        'WEATHER': 'weather',
        'FOG': 'weather',
        'RAIN': 'weather',
        'ICE': 'weather',
        'SNOW': 'weather',
    };

    return typeMap[tomtomType.toUpperCase()] ?? 'event';
}

function mapSeverity(magnitudeOfDelay: number): 1 | 2 | 3 | 4 | 5 {
    if (magnitudeOfDelay <= 0) return 1;
    if (magnitudeOfDelay <= 1) return 2;
    if (magnitudeOfDelay <= 2) return 3;
    if (magnitudeOfDelay <= 3) return 4;
    return 5;
}

function sampleCoordinates(
    coordinates: Coordinate[],
    maxSamples: number
): Coordinate[] {
    if (coordinates.length <= maxSamples) {
        return coordinates;
    }

    const samples: Coordinate[] = [];
    const step = (coordinates.length - 1) / (maxSamples - 1);

    for (let i = 0; i < maxSamples; i++) {
        const index = Math.min(Math.floor(i * step), coordinates.length - 1);
        samples.push(coordinates[index]);
    }

    return samples;
}

function calculateBoundingBox(
    coordinates: Coordinate[]
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const coord of coordinates) {
        minLat = Math.min(minLat, coord.lat);
        maxLat = Math.max(maxLat, coord.lat);
        minLng = Math.min(minLng, coord.lng);
        maxLng = Math.max(maxLng, coord.lng);
    }

    // Add small buffer
    const buffer = 0.01;
    return {
        minLat: minLat - buffer,
        maxLat: maxLat + buffer,
        minLng: minLng - buffer,
        maxLng: maxLng + buffer,
    };
}

function createFallbackTrafficData(coordinates: Coordinate[]): TrafficData {
    // Create synthetic traffic segments with default congestion estimates
    const segments: TrafficSegment[] = [];
    const hour = new Date().getHours();

    // Estimate congestion based on time of day
    let congestionLevel: CongestionLevel = 'light';
    if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20)) {
        congestionLevel = 'moderate';
    } else if (hour >= 22 || hour <= 6) {
        congestionLevel = 'free';
    }

    for (let i = 0; i < coordinates.length - 1; i++) {
        segments.push({
            start: coordinates[i],
            end: coordinates[i + 1],
            currentSpeed: congestionLevel === 'free' ? 40 : congestionLevel === 'light' ? 30 : 20,
            freeFlowSpeed: 40,
            congestionLevel,
            delay: 0,
        });
    }

    return {
        timestamp: new Date(),
        segments,
        incidents: [],
    };
}

// ============================================================================
// EXPORTS FOR FUTURE USE
// ============================================================================

export { CongestionLevel };
