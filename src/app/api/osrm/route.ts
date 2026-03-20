/**
 * OSRM Proxy API Route
 * 
 * Proxies requests to the public OSRM server to avoid CORS issues
 * when calling from the browser. Includes timeout and retry logic.
 */

import { NextRequest, NextResponse } from 'next/server';

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const TIMEOUT_MS = 30000; // 30 second timeout

export const runtime = 'edge'; // Use Edge runtime for better performance

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Routify/1.0',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const service = searchParams.get('service') || 'route';
    const coordinates = searchParams.get('coordinates');

    if (!coordinates) {
        return NextResponse.json(
            { error: 'Coordinates parameter is required', code: 'BadRequest' },
            { status: 400 }
        );
    }

    // Build query params from remaining params
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
        if (key !== 'service' && key !== 'coordinates') {
            params.set(key, value);
        }
    });

    const url = `${OSRM_BASE_URL}/${service}/v1/driving/${coordinates}?${params}`;

    try {
        console.log(`[OSRM Proxy] Requesting: ${service} with ${coordinates.split(';').length} coordinates`);

        const response = await fetchWithTimeout(url, TIMEOUT_MS);

        if (!response.ok) {
            console.error(`[OSRM Proxy] OSRM returned ${response.status}`);
            return NextResponse.json(
                { error: `OSRM request failed: ${response.status}`, code: 'OSRMError' },
                { status: response.status }
            );
        }

        const data = await response.json();

        console.log(`[OSRM Proxy] Success: ${data.code}`);

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
            },
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[OSRM Proxy] Request timed out after 30s');
            return NextResponse.json(
                { error: 'OSRM request timed out', code: 'Timeout' },
                { status: 504 }
            );
        }

        console.error('[OSRM Proxy] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch from OSRM server', code: 'ProxyError' },
            { status: 502 }
        );
    }
}
