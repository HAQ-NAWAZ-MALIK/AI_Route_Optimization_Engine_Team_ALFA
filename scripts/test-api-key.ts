/**
 * Test API Key Script
 * Quick script to test API key validation and rate limiting
 */

const API_BASE = 'http://localhost:3000';
const API_KEY = 'ropt_nC2MUwuuebyvyXJ0kLm3JF6c4bmYm1L6'; // Admin key from reset script

async function testApiKey() {
    console.log('🧪 Testing API Key Middleware\n');

    // Test 1: Status endpoint (no auth required)
    console.log('Test 1: Public status endpoint');
    try {
        const response = await fetch(`${API_BASE}/api/v1`);
        const data = await response.json();
        console.log('✅ Status:', data.status);
        console.log('   Version:', data.version);
    } catch (error) {
        console.error('❌ Failed:', error);
    }
    console.log();

    // Test 2: Protected endpoint without API key
    console.log('Test 2: Protected endpoint without API key');
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locations: [{ lat: 28.6, lon: 77.2 }],
                vehicleCount: 1,
            }),
        });
        const data = await response.json();
        if (response.status === 401) {
            console.log('✅ Correctly rejected:', data.message);
        } else {
            console.log('❌ Should have been rejected');
        }
    } catch (error) {
        console.error('❌ Failed:', error);
    }
    console.log();

    // Test 3: Protected endpoint with valid API key
    console.log('Test 3: Protected endpoint with valid API key');
    try {
        const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                locations: [
                    { lat: 28.6, lon: 77.2 },
                    { lat: 28.7, lon: 77.3 },
                    { lat: 28.8, lon: 77.4 },
                ],
                vehicleCount: 2,
            }),
        });
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Request successful');
            console.log('   Request ID:', data.requestId);
            console.log('   Routes:', data.optimization.routes.length);

            // Check rate limit headers
            console.log('\n   Rate Limit Info:');
            console.log('   - Limit:', response.headers.get('X-RateLimit-Limit'));
            console.log('   - Remaining:', response.headers.get('X-RateLimit-Remaining'));
            console.log('   - Reset:', new Date(parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000).toLocaleTimeString());
        } else {
            console.log('❌ Request failed:', data);
        }
    } catch (error) {
        console.error('❌ Failed:', error);
    }
    console.log();

    // Test 4: Rate limiting
    console.log('Test 4: Testing rate limiting (sending 5 rapid requests)');
    for (let i = 1; i <= 5; i++) {
        try {
            const response = await fetch(`${API_BASE}/api/v1/optimize/route`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({
                    locations: [{ lat: 28.6, lon: 77.2 }],
                    vehicleCount: 1,
                }),
            });

            const remaining = response.headers.get('X-RateLimit-Remaining');
            if (response.status === 429) {
                const data = await response.json();
                console.log(`   Request ${i}: ❌ Rate limited - ${data.message}`);
            } else {
                console.log(`   Request ${i}: ✅ Success - ${remaining} requests remaining`);
            }
        } catch (error) {
            console.error(`   Request ${i}: ❌ Failed:`, error);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n✅ API middleware testing complete!');
}

// Run tests
testApiKey().catch(console.error);
