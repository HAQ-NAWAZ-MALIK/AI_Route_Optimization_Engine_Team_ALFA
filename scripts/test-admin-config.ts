/**
 * Admin Config E2E Test Script
 * 
 * Tests all admin config features quickly:
 * 1. Auth — login as admin, get session cookie
 * 2. Config API — GET/PUT platform config
 * 3. Rate Limits — change tier limits, verify they take effect
 * 4. Plan Quotas — change plan limits, verify they take effect
 * 5. Feature Flags — toggle flags, verify persistence
 * 6. Maintenance Mode — enable/disable, verify
 * 7. Cleanup — reset to defaults
 * 
 * Usage: npx tsx scripts/test-admin-config.ts
 */

const BASE = 'http://localhost:3000';

// ─── Helpers ───────────────────────────────────────────

let sessionCookie = '';

async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('json')) {
        data = await res.json();
    }
    return { status: res.status, data, headers: res.headers };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

// ─── Login ─────────────────────────────────────────────

async function login() {
    console.log('\n🔐 Step 1: Admin Login');

    // Get CSRF token
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: 'manual' });
    const csrfData: any = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    const cookies = csrfRes.headers.getSetCookie?.() || [];
    let cookieStr = cookies.map((c: string) => c.split(';')[0]).join('; ');

    assert(!!csrfToken, 'Got CSRF token');

    // Login
    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieStr,
        },
        body: new URLSearchParams({
            csrfToken,
            email: 'admin@test.com',
            password: 'AdminPass123!',
        }).toString(),
        redirect: 'manual',
    });

    const loginCookies = loginRes.headers.getSetCookie?.() || [];
    const allCookies = [...cookies, ...loginCookies].map((c: string) => c.split(';')[0]);
    sessionCookie = allCookies.join('; ');

    assert(loginRes.status === 302 || loginRes.status === 200, 'Login succeeded', `status=${loginRes.status}`);

    // Verify session
    const sessionRes = await fetch(`${BASE}/api/auth/session`, {
        headers: { 'Cookie': sessionCookie },
    });
    const session: any = await sessionRes.json();
    assert(session?.user?.role === 'ADMIN', 'Session is admin', `role=${session?.user?.role}`);
}

// ─── Test Config API ───────────────────────────────────

async function testConfigAPI() {
    console.log('\n📋 Step 2: Config API — GET');

    const { status, data } = await api('GET', '/api/admin/config');
    assert(status === 200, 'GET /api/admin/config returns 200', `status=${status}`);
    assert(data?.success === true, 'Response has success=true');
    assert(!!data?.config, 'Response has config object');

    if (data?.config) {
        assert(!!data.config.tierLimits, 'Config has tierLimits');
        assert(!!data.config.planLimits, 'Config has planLimits');
        assert(data.config.features !== undefined, 'Config has features');
        assert(data.config.maintenance !== undefined, 'Config has maintenance');
    }

    return data?.config;
}

// ─── Test Rate Limits ──────────────────────────────────

async function testRateLimits(originalConfig: any) {
    console.log('\n⚡ Step 3: Rate Limits — Update & Verify');

    // Change free tier limits
    const newLimits = {
        tierLimits: {
            ...originalConfig.tierLimits,
            free: { requestsPerDay: 50, requestsPerMinute: 5, maxDestinations: 10 },
        },
    };

    const { status, data } = await api('PUT', '/api/admin/config', newLimits);
    assert(status === 200, 'PUT rate limits returns 200', `status=${status}`);
    assert(data?.success === true, 'Update succeeded');
    assert(data?.config?.tierLimits?.free?.requestsPerDay === 50, 'Free tier requestsPerDay updated to 50');
    assert(data?.config?.tierLimits?.free?.requestsPerMinute === 5, 'Free tier requestsPerMinute updated to 5');
    assert(data?.config?.tierLimits?.free?.maxDestinations === 10, 'Free tier maxDestinations updated to 10');

    // Verify pro/enterprise untouched
    assert(
        data?.config?.tierLimits?.pro?.requestsPerDay === originalConfig.tierLimits.pro.requestsPerDay,
        'Pro tier unchanged'
    );

    // Read back
    const { data: readBack } = await api('GET', '/api/admin/config');
    assert(readBack?.config?.tierLimits?.free?.requestsPerDay === 50, 'GET confirms persisted value');
}

// ─── Test Plan Quotas ──────────────────────────────────

async function testPlanQuotas(originalConfig: any) {
    console.log('\n📊 Step 4: Plan Quotas — Update & Verify');

    const newPlan = {
        planLimits: {
            ...originalConfig.planLimits,
            FREE: { requestsPerMonth: 50, maxLocations: 5, maxCabs: 1 },
        },
    };

    const { status, data } = await api('PUT', '/api/admin/config', newPlan);
    assert(status === 200, 'PUT plan quotas returns 200');
    assert(data?.config?.planLimits?.FREE?.requestsPerMonth === 50, 'FREE plan requestsPerMonth updated to 50');
    assert(data?.config?.planLimits?.FREE?.maxLocations === 5, 'FREE plan maxLocations updated to 5');
    assert(data?.config?.planLimits?.FREE?.maxCabs === 1, 'FREE plan maxCabs updated to 1');

    // PRO should be untouched
    assert(
        data?.config?.planLimits?.PRO?.requestsPerMonth === originalConfig.planLimits.PRO.requestsPerMonth,
        'PRO plan unchanged'
    );
}

// ─── Test Feature Flags ────────────────────────────────

async function testFeatureFlags() {
    console.log('\n🚀 Step 5: Feature Flags — Toggle & Verify');

    // Disable webhooks and enable them
    const { data: d1 } = await api('PUT', '/api/admin/config', {
        features: { signup: true, oauth: true, trial: true, webhooks: true, aiFeatures: true },
    });
    assert(d1?.config?.features?.webhooks === true, 'Webhooks enabled');

    const { data: d2 } = await api('PUT', '/api/admin/config', {
        features: { signup: true, oauth: true, trial: true, webhooks: false, aiFeatures: true },
    });
    assert(d2?.config?.features?.webhooks === false, 'Webhooks disabled');

    // Disable signup
    const { data: d3 } = await api('PUT', '/api/admin/config', {
        features: { signup: false, oauth: true, trial: true, webhooks: false, aiFeatures: true },
    });
    assert(d3?.config?.features?.signup === false, 'Signup disabled');
}

// ─── Test Maintenance Mode ─────────────────────────────

async function testMaintenanceMode() {
    console.log('\n🔧 Step 6: Maintenance Mode — Enable & Disable');

    // Enable
    const { data: d1 } = await api('PUT', '/api/admin/config', {
        maintenance: { enabled: true, message: 'Test maintenance — please wait' },
    });
    assert(d1?.config?.maintenance?.enabled === true, 'Maintenance enabled');
    assert(d1?.config?.maintenance?.message === 'Test maintenance — please wait', 'Maintenance message set');

    // Verify persisted
    const { data: read } = await api('GET', '/api/admin/config');
    assert(read?.config?.maintenance?.enabled === true, 'GET confirms maintenance is on');

    // Disable
    const { data: d2 } = await api('PUT', '/api/admin/config', {
        maintenance: { enabled: false, message: '' },
    });
    assert(d2?.config?.maintenance?.enabled === false, 'Maintenance disabled');
}

// ─── Test Validation ───────────────────────────────────

async function testValidation() {
    console.log('\n🛡️  Step 7: Input Validation');

    // Unknown keys
    const { status: s1, data: d1 } = await api('PUT', '/api/admin/config', { garbage: 'bad' });
    assert(s1 === 400, 'Rejects unknown config keys', `status=${s1}`);

    // Invalid tier limit types
    const { status: s2 } = await api('PUT', '/api/admin/config', {
        tierLimits: { free: { requestsPerDay: 'not-a-number', requestsPerMinute: 10, maxDestinations: 20 } },
    });
    assert(s2 === 400, 'Rejects non-numeric tier values', `status=${s2}`);

    // No auth → 401
    const noAuthRes = await fetch(`${BASE}/api/admin/config`, { redirect: 'manual' });
    assert(noAuthRes.status === 401, 'No auth returns 401');
}

// ─── Cleanup ───────────────────────────────────────────

async function cleanup() {
    console.log('\n🧹 Step 8: Cleanup — Reset to Defaults');

    const defaults = {
        tierLimits: {
            free: { requestsPerDay: 100, requestsPerMinute: 10, maxDestinations: 20 },
            pro: { requestsPerDay: 1000, requestsPerMinute: 60, maxDestinations: 100 },
            enterprise: { requestsPerDay: -1, requestsPerMinute: -1, maxDestinations: 500 },
        },
        planLimits: {
            FREE: { requestsPerMonth: 100, maxLocations: 10, maxCabs: 2 },
            TRIAL: { requestsPerMonth: 1000, maxLocations: 50, maxCabs: 10 },
            PRO: { requestsPerMonth: 10000, maxLocations: 100, maxCabs: 50 },
            ENTERPRISE: { requestsPerMonth: -1, maxLocations: 500, maxCabs: 200 },
        },
        features: { signup: true, oauth: true, trial: true, webhooks: false, aiFeatures: true },
        maintenance: { enabled: false, message: '' },
    };

    const { status, data } = await api('PUT', '/api/admin/config', defaults);
    assert(status === 200, 'Reset to defaults succeeded');
    assert(data?.config?.tierLimits?.free?.requestsPerDay === 100, 'Free tier back to 100 req/day');
    assert(data?.config?.maintenance?.enabled === false, 'Maintenance off');
}

// ─── Main ──────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  Admin Config E2E Tests');
    console.log('═══════════════════════════════════════════');

    const start = Date.now();

    try {
        await login();
        const config = await testConfigAPI();
        if (config) {
            await testRateLimits(config);
            await testPlanQuotas(config);
        }
        await testFeatureFlags();
        await testMaintenanceMode();
        await testValidation();
        await cleanup();
    } catch (err) {
        console.error('\n💥 Unexpected error:', err);
        failed++;
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log('\n═══════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed  (${elapsed}s)`);
    console.log('═══════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main();
