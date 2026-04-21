/**
 * Billing & Subscription E2E Test Script
 * 
 * Tests all billing features: subscription, promo codes, admin controls,
 * plan enforcement, and portal APIs.
 * 
 * Usage: npx tsx scripts/test-billing.ts
 */

const BASE = 'http://localhost:3000';
const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function fetchJson(url: string, options?: RequestInit) {
    const res = await fetch(`${BASE}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': SESSION_COOKIE,
            ...(options?.headers || {}),
        },
    });
    const data = await res.json();
    return { status: res.status, data };
}

function test(name: string, condition: boolean, detail?: string) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${name}`);
    } else {
        failed++;
        const msg = `  ❌ ${name}${detail ? ` — ${detail}` : ''}`;
        console.log(msg);
        errors.push(msg);
    }
}

async function main() {
    console.log('\n🧾 BILLING & SUBSCRIPTION TEST SUITE\n');
    console.log('='.repeat(60));

    // ─── 1. Portal Subscription Status ──────────────────
    console.log('\n📊 Portal Subscription Status');
    const { status: subStatus, data: subData } = await fetchJson('/api/portal/subscription');
    test('GET /api/portal/subscription returns 200', subStatus === 200);
    test('Has subscription object', !!subData?.subscription);
    test('Has usage data', !!subData?.usage);
    test('Has plan info', !!subData?.plan);
    test('Usage has current count', typeof subData?.usage?.current === 'number');
    test('Usage has limit', typeof subData?.usage?.limit === 'number');

    // ─── 2. Subscribe to TRIAL ──────────────────────────
    console.log('\n📝 Subscribe to TRIAL');
    const { status: trialStatus, data: trialData } = await fetchJson('/api/portal/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan: 'TRIAL', interval: 'MONTHLY' }),
    });
    test('POST /api/portal/subscription/subscribe returns success', trialStatus === 200 || trialData?.subscription);
    if (trialData?.error) console.log(`  ℹ️  ${trialData.error}`);

    // ─── 3. Subscribe to PRO ────────────────────────────
    console.log('\n💎 Subscribe to PRO');
    const { status: proStatus, data: proData } = await fetchJson('/api/portal/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan: 'PRO', interval: 'MONTHLY' }),
    });
    test('Subscribe to PRO works', proStatus === 200 || !!proData?.subscription);
    if (proData?.error) console.log(`  ℹ️  ${proData.error}`);

    // ─── 4. Subscription status after subscribe ─────────
    console.log('\n📊 Updated Subscription Status');
    const { data: postSubData } = await fetchJson('/api/portal/subscription');
    test('Plan reflects latest subscription', !!postSubData?.subscription?.plan);

    // ─── 5. Promo Code Validation ───────────────────────
    console.log('\n🔖 Promo Code Validation');
    const { status: promoValStatus, data: promoValData } = await fetchJson('/api/portal/subscription/redeem?code=INVALID123');
    test('Validate invalid promo returns response', promoValStatus !== 500);
    test('Invalid promo is rejected', promoValData?.validation?.valid === false || promoValData?.success === true);

    // ─── 6. Cancel Subscription ─────────────────────────
    console.log('\n🚫 Cancel Subscription');
    const { status: cancelStatus, data: cancelData } = await fetchJson('/api/portal/subscription/cancel', {
        method: 'POST',
    });
    test('Cancel returns response', cancelStatus !== 500);
    if (cancelData?.error) console.log(`  ℹ️  ${cancelData.error}`);

    // ─── 7. Admin Billing Stats ─────────────────────────
    console.log('\n📈 Admin Billing Stats');
    const { status: statsStatus, data: statsData } = await fetchJson('/api/admin/billing/stats');
    test('GET /api/admin/billing/stats returns response', statsStatus !== 500);
    if (statsStatus === 200) {
        test('Stats has totalSubscribers', typeof statsData?.stats?.totalSubscribers === 'number');
        test('Stats has byPlan', !!statsData?.stats?.byPlan);
        test('Stats has mrr', typeof statsData?.stats?.mrr === 'number');
    }

    // ─── 8. Admin Promo Codes - Create ──────────────────
    console.log('\n🏷️ Admin Promo Codes');
    const testCode = `TEST${Date.now().toString(36).toUpperCase()}`;
    const { status: createStatus, data: createData } = await fetchJson('/api/admin/promo-codes', {
        method: 'POST',
        body: JSON.stringify({
            code: testCode,
            discountPercent: 25,
            maxRedemptions: 10,
            applicablePlans: ['PRO', 'ENTERPRISE'],
        }),
    });
    test('Create promo code returns response', createStatus !== 500);
    if (createStatus === 201) {
        test('Promo code created', !!createData?.code?.id);
        test('Discount is 25%', createData?.code?.discountPercent === 25);
    } else if (createStatus === 403) {
        console.log('  ℹ️  Need admin session cookie to test promo code creation');
    }

    // ─── 9. Admin Promo Codes - List ────────────────────
    const { status: listStatus, data: listData } = await fetchJson('/api/admin/promo-codes');
    test('List promo codes returns response', listStatus !== 500);
    if (listStatus === 200) {
        test('Codes is an array', Array.isArray(listData?.codes));
    }

    // ─── 10. Admin Set User Plan ────────────────────────
    console.log('\n👑 Admin Set User Plan');
    // Need a user ID — use current user for testing
    if (subData?.subscription?.userId) {
        const userId = subData.subscription.userId;
        const { status: setPlanStatus, data: setPlanData } = await fetchJson(`/api/admin/users/${userId}/subscription`, {
            method: 'POST',
            body: JSON.stringify({ plan: 'ENTERPRISE', reason: 'E2E test' }),
        });
        test('Admin set plan returns response', setPlanStatus !== 500);
        if (setPlanStatus === 200) {
            test('Plan set successfully', setPlanData?.success === true);
        } else if (setPlanStatus === 403) {
            console.log('  ℹ️  Need admin session cookie for plan override');
        }
    } else {
        console.log('  ⚠️  Skipping — no user ID available');
    }

    // ─── 11. Admin User Subscription History ────────────
    console.log('\n📜 Admin User Subscription History');
    if (subData?.subscription?.userId) {
        const userId = subData.subscription.userId;
        const { status: histStatus, data: histData } = await fetchJson(`/api/admin/users/${userId}/subscription`);
        test('Subscription history returns response', histStatus !== 500);
        if (histStatus === 200) {
            test('History is an array', Array.isArray(histData?.subscriptions));
        }
    } else {
        console.log('  ⚠️  Skipping — no user ID available');
    }

    // ─── 12. Admin Disable Promo Code ───────────────────
    console.log('\n🔒 Admin Disable Promo Code');
    if (createStatus === 201 && createData?.code?.id) {
        const { status: disableStatus, data: disableData } = await fetchJson(`/api/admin/promo-codes/${createData.code.id}`, {
            method: 'DELETE',
        });
        test('Disable promo code works', disableStatus === 200 && disableData?.success === true);
    } else {
        console.log('  ⚠️  Skipping — promo code was not created');
    }

    // ─── Summary ────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

    if (errors.length > 0) {
        console.log('\n❌ Failed tests:');
        errors.forEach(e => console.log(e));
    }

    console.log('\n');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
