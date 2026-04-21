/**
 * Comprehensive API Test Suite
 * Tests all API endpoints with various scenarios
 */

const API_BASE = 'http://localhost:3000';

// Test API keys
const KEYS = {
    adminPortal: 'ropt_gwnS0PHBaKTSZHVNaHS52i8mx1pt1XYp',
    userPortal: 'ropt_dzYYjHrUXtHnAUjoKz9i0hjfhPawepcJ',
    demoFree: 'demo_free_key_12345',
    demoPro: 'demo_pro_key_67890',
    demoEnterprise: 'demo_enterprise_key_abcde',
    invalid: 'invalid_key_xyz',
};

// Test results tracker
const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; message: string }>,
};

function logTest(name: string, passed: boolean, message: string) {
    if (passed) {
        results.passed++;
        results.tests.push({ name, status: 'PASS', message });
        console.log(`✅ ${name}: ${message}`);
    } else {
        results.failed++;
        results.tests.push({ name, status: 'FAIL', message });
        console.log(`❌ ${name}: ${message}`);
    }
}

async function testHealthEndpoint() {
    console.log('\n━━━ 1. HEALTH ENDPOINT (No Auth) ━━━');

    try {
        const response = await fetch(`${API_BASE}/api/v1/health`);
        const data = await response.json();

        if (response.ok && data.status === 'ok') {
            logTest('Health Check', true, `Status: ${data.status}, Version: ${data.version}`);
        } else {
            logTest('Health Check', false, 'Unexpected response');
        }
    } catch (error) {
        logTest('Health Check', false, `Error: ${error}`);
    }
}

async function testAuthValidation() {
    console.log('\n━━━ 2. AUTHENTICATION VALIDATION ━━━');

    // Test 2.1: No API key
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: { id: '1', lat: 28.6, lng: 77.2 },
                destinations: [{ id: '2', lat: 28.7, lng: 77.3 }],
                tripType: 'pickup',
                constraints: { departureTime: '09:00' },
            }),
        });

        if (response.status === 401) {
            logTest('No API Key', true, 'Correctly rejected with 401');
        } else {
            logTest('No API Key', false, `Expected 401, got ${response.status}`);
        }
    } catch (error) {
        logTest('No API Key', false, `Error: ${error}`);
    }

    // Test 2.2: Invalid API key
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.invalid,
            },
            body: JSON.stringify({
                origin: { id: '1', lat: 28.6, lng: 77.2 },
                destinations: [{ id: '2', lat: 28.7, lng: 77.3 }],
                tripType: 'pickup',
                constraints: { departureTime: '09:00' },
            }),
        });

        if (response.status === 401) {
            logTest('Invalid API Key', true, 'Correctly rejected with 401');
        } else {
            logTest('Invalid API Key', false, `Expected 401, got ${response.status}`);
        }
    } catch (error) {
        logTest('Invalid API Key', false, `Error: ${error}`);
    }

    // Test 2.3: Valid demo key
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoFree,
            },
            body: JSON.stringify({
                origin: { id: '1', lat: 28.6, lng: 77.2, name: 'Start', address: '' },
                destinations: [{ id: '2', lat: 28.7, lng: 77.3, name: 'End', address: '' }],
                tripType: 'pickup',
                constraints: { departureTime: '09:00' },
            }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
            logTest('Demo Free Key', true, `Request ID: ${data.requestId}`);
        } else {
            logTest('Demo Free Key', false, `${data.error || 'Failed'}: ${data.message || ''}`);
        }
    } catch (error) {
        logTest('Demo Free Key', false, `Error: ${error}`);
    }

    // Test 2.4: Portal admin key
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${KEYS.adminPortal}`,
            },
            body: JSON.stringify({
                origin: { id: '1', lat: 28.6, lng: 77.2, name: 'Start', address: '' },
                destinations: [{ id: '2', lat: 28.7, lng: 77.3, name: 'End', address: '' }],
                tripType: 'pickup',
                constraints: { departureTime: '09:00' },
            }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
            logTest('Portal Admin Key', true, `Request ID: ${data.requestId}`);
        } else {
            logTest('Portal Admin Key', false, `${data.error || 'Failed'}: ${data.message || ''}`);
        }
    } catch (error) {
        logTest('Portal Admin Key', false, `Error: ${error}`);
    }
}

async function testRouteOptimization() {
    console.log('\n━━━ 3. ROUTE OPTIMIZATION ENDPOINT ━━━');

    const testData = {
        origin: {
            id: 'origin-1',
            lat: 28.6139,
            lng: 77.2090,
            name: 'New Delhi',
            address: 'Connaught Place',
        },
        destinations: [
            { id: 'dest-1', lat: 28.6562, lng: 77.2410, name: 'Red Fort', address: '' },
            { id: 'dest-2', lat: 28.6129, lng: 77.2295, name: 'India Gate', address: '' },
            { id: 'dest-3', lat: 28.5244, lng: 77.1855, name: 'Qutub Minar', address: '' },
        ],
        tripType: 'pickup' as const,
        constraints: {
            departureTime: '09:00',
            maxTotalDuration: 7200,
            bufferPerStop: 300,
        },
        options: {
            algorithm: 'genetic',
            useRealRoads: true,
            considerTraffic: false,
            generateAlternatives: true,
            maxAlternatives: 2,
        },
    };

    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoPro,
            },
            body: JSON.stringify(testData),
        });

        const data = await response.json();
        if (response.ok && data.success) {
            logTest('Route Optimization', true,
                `Optimized ${data.result.route.stops.length} stops, ` +
                `Distance: ${data.result.route.totalDistance.toFixed(2)}km, ` +
                `Duration: ${Math.round(data.result.route.totalDuration / 60)}min`
            );
        } else {
            logTest('Route Optimization', false, `${data.error || 'Failed'}: ${data.message || ''}`);
        }
    } catch (error) {
        logTest('Route Optimization', false, `Error: ${error}`);
    }
}

async function testMultiClusterOptimization() {
    console.log('\n━━━ 4. MULTI-CLUSTER OPTIMIZATION ━━━');

    const testData = {
        employees: [
            { id: 'emp-1', lat: 28.6, lng: 77.2, name: 'Employee 1' },
            { id: 'emp-2', lat: 28.65, lng: 77.25, name: 'Employee 2' },
            { id: 'emp-3', lat: 28.55, lng: 77.15, name: 'Employee 3' },
            { id: 'emp-4', lat: 28.7, lng: 77.3, name: 'Employee 4' },
        ],
        office: { id: 'office', lat: 28.6139, lng: 77.2090, name: 'Office' },
        cabs: [
            { id: 'cab-1', capacity: 4, location: { lat: 28.6, lng: 77.2 } },
            { id: 'cab-2', capacity: 4, location: { lat: 28.65, lng: 77.25 } },
        ],
        tripType: 'pickup' as const,
    };

    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/multi-cluster`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoPro,
            },
            body: JSON.stringify(testData),
        });

        const data = await response.json();
        if (response.ok && data.success) {
            logTest('Multi-Cluster Optimization', true,
                `Assigned ${data.result.clusters.length} clusters`
            );
        } else {
            logTest('Multi-Cluster Optimization', false, `${data.error || 'Failed'}: ${data.message || ''}`);
        }
    } catch (error) {
        logTest('Multi-Cluster Optimization', false, `Error: ${error}`);
    }
}

async function testDistanceMatrix() {
    console.log('\n━━━ 5. DISTANCE MATRIX ENDPOINT ━━━');

    const testData = {
        coordinates: [
            { lat: 28.6139, lng: 77.2090 },
            { lat: 28.6562, lng: 77.2410 },
            { lat: 28.6129, lng: 77.2295 },
            { lat: 28.5244, lng: 77.1855 },
        ],
        useRealRoads: true,
    };

    try {
        const response = await fetch(`${API_BASE}/api/v1/matrix/distance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoEnterprise,
            },
            body: JSON.stringify(testData),
        });

        const data = await response.json();
        if (response.ok && data.success) {
            logTest('Distance Matrix', true,
                `Matrix: ${data.result.distances.length}x${data.result.distances[0].length}`
            );
        } else {
            logTest('Distance Matrix', false, `${data.error || 'Failed'}: ${data.message || ''}`);
        }
    } catch (error) {
        logTest('Distance Matrix', false, `Error: ${error}`);
    }
}

async function testRateLimiting() {
    console.log('\n━━━ 6. RATE LIMITING ━━━');

    const requests = [];
    for (let i = 0; i < 15; i++) {
        requests.push(
            fetch(`${API_BASE}/api/v1/optimize/route`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': KEYS.demoFree, // Free tier: 10 req/min
                },
                body: JSON.stringify({
                    origin: { id: '1', lat: 28.6, lng: 77.2, name: 'A', address: '' },
                    destinations: [{ id: '2', lat: 28.7, lng: 77.3, name: 'B', address: '' }],
                    tripType: 'pickup',
                    constraints: { departureTime: '09:00' },
                }),
            })
        );

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r.status === 429).length;
        const successful = responses.filter(r => r.ok).length;

        if (rateLimited > 0) {
            logTest('Rate Limiting', true,
                `${successful} successful, ${rateLimited} rate-limited (working correctly)`
            );
        } else {
            logTest('Rate Limiting', false, 'No requests were rate-limited (may need adjustment)');
        }
    } catch (error) {
        logTest('Rate Limiting', false, `Error: ${error}`);
    }
}

async function testValidationErrors() {
    console.log('\n━━━ 7. INPUT VALIDATION ━━━');

    // Test 7.1: Missing required fields
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoPro,
            },
            body: JSON.stringify({ origin: { id: '1', lat: 28.6, lng: 77.2 } }), // Missing destinations
        });

        if (response.status === 400) {
            logTest('Missing Fields Validation', true, 'Correctly rejected invalid input');
        } else {
            logTest('Missing Fields Validation', false, `Expected 400, got ${response.status}`);
        }
    } catch (error) {
        logTest('Missing Fields Validation', false, `Error: ${error}`);
    }

    // Test 7.2: Invalid coordinates
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoPro,
            },
            body: JSON.stringify({
                origin: { id: '1', lat: 999, lng: 999, name: '', address: '' }, // Invalid coords
                destinations: [{ id: '2', lat: 28.7, lng: 77.3, name: '', address: '' }],
                tripType: 'pickup',
                constraints: { departureTime: '09:00' },
            }),
        });

        if (response.status === 400) {
            logTest('Invalid Coordinates', true, 'Correctly rejected invalid coordinates');
        } else {
            logTest('Invalid Coordinates', false, `Expected 400, got ${response.status}`);
        }
    } catch (error) {
        logTest('Invalid Coordinates', false, `Error: ${error}`);
    }
}

async function testDifferentAuthMethods() {
    console.log('\n━━━ 8. AUTHENTICATION METHODS ━━━');

    const testPayload = {
        origin: { id: '1', lat: 28.6, lng: 77.2, name: 'A', address: '' },
        destinations: [{ id: '2', lat: 28.7, lng: 77.3, name: 'B', address: '' }],
        tripType: 'pickup' as const,
        constraints: { departureTime: '09:00' },
    };

    // Test 8.1: X-API-Key header
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KEYS.demoPro,
            },
            body: JSON.stringify(testPayload),
        });

        if (response.ok) {
            logTest('X-API-Key Header', true, 'Authentication successful');
        } else {
            logTest('X-API-Key Header', false, `Failed with status ${response.status}`);
        }
    } catch (error) {
        logTest('X-API-Key Header', false, `Error: ${error}`);
    }

    // Test 8.2: Authorization Bearer header
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${KEYS.demoPro}`,
            },
            body: JSON.stringify(testPayload),
        });

        if (response.ok) {
            logTest('Authorization Bearer', true, 'Authentication successful');
        } else {
            logTest('Authorization Bearer', false, `Failed with status ${response.status}`);
        }
    } catch (error) {
        logTest('Authorization Bearer', false, `Error: ${error}`);
    }
}

async function runAllTests() {
    console.log('🧪 COMPREHENSIVE API TEST SUITE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Testing API at: ${API_BASE}`);
    console.log(`Start time: ${new Date().toISOString()}\n`);

    await testHealthEndpoint();
    await testAuthValidation();
    await testRouteOptimization();
    await testMultiClusterOptimization();
    await testDistanceMatrix();
    await testRateLimiting();
    await testValidationErrors();
    await testDifferentAuthMethods();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Tests: ${results.passed + results.failed}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.failed > 0) {
        console.log('❌ FAILED TESTS:');
        results.tests
            .filter(t => t.status === 'FAIL')
            .forEach(t => console.log(`   ${t.name}: ${t.message}`));
        console.log();
    }

    console.log(`End time: ${new Date().toISOString()}`);
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
