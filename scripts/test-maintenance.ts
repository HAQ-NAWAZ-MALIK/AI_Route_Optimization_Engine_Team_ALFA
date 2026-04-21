/**
 * Test: Maintenance Mode API Blocking
 * 
 * Verifies that enabling maintenance mode returns 503 for all API calls
 * and that disabling it restores normal operation.
 * 
 * Usage: npx tsx scripts/test-maintenance.ts
 */

const BASE = 'http://localhost:3000';

// ─── Cookie management (same as test-admin-config.ts) ──────────

let sessionCookie = '';

async function api(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            ...extraHeaders,
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

function check(label: string, condition: boolean, detail?: string) {
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

    // Get CSRF token + csrf cookie
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: 'manual' });
    const csrfData: any = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
    let cookieStr = csrfCookies.map((c: string) => c.split(';')[0]).join('; ');

    check('Got CSRF token', !!csrfToken);

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
    const allCookies = [...csrfCookies, ...loginCookies].map((c: string) => c.split(';')[0]);
    sessionCookie = allCookies.join('; ');

    check('Login succeeded', loginRes.status === 302 || loginRes.status === 200, `status=${loginRes.status}`);

    // Verify session
    const sessionRes = await fetch(`${BASE}/api/auth/session`, {
        headers: { 'Cookie': sessionCookie },
    });
    const session: any = await sessionRes.json();
    check('Session is admin', session?.user?.role === 'ADMIN', `role=${session?.user?.role}`);
}

// ─── Tests ─────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  Maintenance Mode E2E Test');
    console.log('═══════════════════════════════════════════');

    const start = Date.now();

    try {
        await login();

        // Step 2: Ensure clean state
        console.log('\n🧹 Step 2: Ensure Clean State');
        const { data: cleanData } = await api('PUT', '/api/admin/config', {
            maintenance: { enabled: false, message: '' },
        });
        check('Reset: maintenance disabled', cleanData?.success === true, `data=${JSON.stringify(cleanData?.error)}`);

        // Step 3: API works when maintenance is off
        console.log('\n🟢 Step 3: API Works When Maintenance OFF');
        const { status: s0 } = await api(
            'POST',
            '/api/v1/optimize/route',
            { origin: { lat: 12.97, lng: 77.59 }, destination: { lat: 12.93, lng: 77.63 } },
            { 'X-API-Key': 'ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG', Cookie: '' }
        );
        check(`POST /optimize/route → ${s0} (not 503)`, s0 !== 503);

        // Step 4: Enable maintenance mode
        console.log('\n🔧 Step 4: Enable Maintenance Mode');
        const { data: enableData } = await api('PUT', '/api/admin/config', {
            maintenance: { enabled: true, message: 'System upgrade in progress — please wait' },
        });
        check('PUT returns success', enableData?.success === true, `error=${enableData?.error}`);
        check('Maintenance enabled', enableData?.config?.maintenance?.enabled === true);
        check('Message persisted', enableData?.config?.maintenance?.message?.includes('System upgrade'));
        console.log(`     → Message: "${enableData?.config?.maintenance?.message}"`);

        // Step 5: API calls should return 503
        console.log('\n🚫 Step 5: API Calls Blocked During Maintenance');

        const { status: s1, data: d1, headers: h1 } = await api(
            'POST',
            '/api/v1/optimize/route',
            { origin: { lat: 12.97, lng: 77.59 }, destination: { lat: 12.93, lng: 77.63 } },
            { 'X-API-Key': 'ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG', Cookie: '' }
        );
        check(`POST /optimize/route → ${s1} (should be 503)`, s1 === 503);
        check('Error is "Service Unavailable"', d1?.error === 'Service Unavailable');
        check('Message from admin', d1?.message?.includes('System upgrade'));
        check('Retry-After header = 300', h1.get('retry-after') === '300');

        const { status: s2 } = await api(
            'POST',
            '/api/v1/optimize/multi-cluster',
            { locations: [] },
            { 'X-API-Key': 'ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG', Cookie: '' }
        );
        check(`POST /optimize/multi-cluster → ${s2} (should be 503)`, s2 === 503);

        // Step 6: Disable maintenance
        console.log('\n🟢 Step 6: Disable Maintenance Mode');
        const { data: disableData } = await api('PUT', '/api/admin/config', {
            maintenance: { enabled: false, message: '' },
        });
        check('PUT returns success', disableData?.success === true);
        check('Maintenance disabled', disableData?.config?.maintenance?.enabled === false);

        // Step 7: API works again
        console.log('\n🟢 Step 7: API Works After Maintenance Disabled');
        const { status: s4 } = await api(
            'POST',
            '/api/v1/optimize/route',
            { origin: { lat: 12.97, lng: 77.59 }, destination: { lat: 12.93, lng: 77.63 } },
            { 'X-API-Key': 'ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG', Cookie: '' }
        );
        check(`POST /optimize/route → ${s4} (should NOT be 503)`, s4 !== 503);

    } catch (err) {
        console.error('\n💥 Unexpected error:', err);
        failed++;
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  Results: ${passed} passed, ${failed} failed  (${elapsed}s)`);
    console.log('═══════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main();
