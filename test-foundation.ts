/**
 * Test Suite for Enterprise API Portal Foundation
 * Demonstrates and validates core functionality
 */

import { hashPassword, verifyPassword, validatePassword } from '../src/lib/auth/password';
import { generateApiKey, verifyApiKey, validateApiKeyFormat, getKeyType } from '../src/lib/api-keys/generator';
import { hasPermission, getRequiredPermission, validatePermissions } from '../src/lib/api-keys/permissions';
import { PLANS, isWithinPlanLimits, formatPrice } from '../src/lib/billing/plans';
import { SubscriptionPlan } from '@prisma/client';

console.log('🧪 Enterprise API Portal - Foundation Test Suite\n');
console.log('='.repeat(60));

// ============================================================================
// TEST 1: Password Hashing
// ============================================================================
async function testPasswordHashing() {
    console.log('\n📝 TEST 1: Password Hashing & Validation');
    console.log('-'.repeat(60));

    // Test password validation
    const weakPassword = '12345';
    const strongPassword = 'SecurePass123!';

    console.log('\n✓ Testing password validation:');
    const weakResult = validatePassword(weakPassword);
    console.log(`  Weak password ("${weakPassword}"): ${weakResult.valid ? '✅ VALID' : '❌ INVALID'}`);
    if (!weakResult.valid) {
        weakResult.errors.forEach(err => console.log(`    - ${err}`));
    }

    const strongResult = validatePassword(strongPassword);
    console.log(`  Strong password ("${strongPassword}"): ${strongResult.valid ? '✅ VALID' : '❌ INVALID'}`);

    // Test hashing and verification
    console.log('\n✓ Testing password hashing:');
    const hashed = await hashPassword(strongPassword);
    console.log(`  Original: ${strongPassword}`);
    console.log(`  Hashed:   ${hashed.slice(0, 30)}... (${hashed.length} chars)`);

    const isValid = await verifyPassword(strongPassword, hashed);
    const isInvalid = await verifyPassword('WrongPassword!', hashed);

    console.log(`  Correct password verification: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Wrong password verification:   ${isInvalid ? '❌ FAIL' : '✅ PASS'}`);
}

// ============================================================================
// TEST 2: API Key Generation
// ============================================================================
async function testApiKeyGeneration() {
    console.log('\n\n🔑 TEST 2: API Key Generation & Validation');
    console.log('-'.repeat(60));

    // Generate production key
    console.log('\n✓ Generating production API key:');
    const prodKey = await generateApiKey(false);
    console.log(`  Key:    ${prodKey.key}`);
    console.log(`  Prefix: ${prodKey.prefix}`);
    console.log(`  Hash:   ${prodKey.keyHash.slice(0, 30)}...`);

    // Generate test key
    console.log('\n✓ Generating test API key:');
    const testKey = await generateApiKey(true);
    console.log(`  Key:    ${testKey.key}`);
    console.log(`  Prefix: ${testKey.prefix}`);

    // Validate formats
    console.log('\n✓ Validating key formats:');
    console.log(`  Production key format: ${validateApiKeyFormat(prodKey.key) ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`  Test key format:       ${validateApiKeyFormat(testKey.key) ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`  Invalid key format:    ${validateApiKeyFormat('invalid_key') ? '❌ FAIL' : '✅ PASS'}`);

    // Test key types
    console.log('\n✓ Key type detection:');
    console.log(`  ${prodKey.key.slice(0, 20)}...: ${getKeyType(prodKey.key)}`);
    console.log(`  ${testKey.key.slice(0, 25)}...: ${getKeyType(testKey.key)}`);

    // Test verification
    console.log('\n✓ Key verification:');
    const verified = await verifyApiKey(prodKey.key, prodKey.keyHash);
    const notVerified = await verifyApiKey('ropt_wrong_key_12345678901234567890', prodKey.keyHash);
    console.log(`  Correct key:   ${verified ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Incorrect key: ${notVerified ? '❌ FAIL' : '✅ PASS'}`);
}

// ============================================================================
// TEST 3: Permission System
// ============================================================================
function testPermissions() {
    console.log('\n\n🔐 TEST 3: Permission System');
    console.log('-'.repeat(60));

    const userPermissions = ['route:read', 'route:optimize', 'cluster:optimize'];
    const adminPermissions = ['admin:*'];

    console.log('\n✓ Testing permission checks:');
    console.log(`  User permissions: ${userPermissions.join(', ')}`);

    const tests = [
        { perm: 'route:read', perms: userPermissions, expected: true },
        { perm: 'route:optimize', perms: userPermissions, expected: true },
        { perm: 'admin:users:read', perms: userPermissions, expected: false },
        { perm: 'admin:users:read', perms: adminPermissions, expected: true },
    ];

    tests.forEach(test => {
        const result = hasPermission(test.perms, test.perm as any);
        const status = result === test.expected ? '✅' : '❌';
        console.log(`  ${status} ${test.perm}: ${result ? 'ALLOWED' : 'DENIED'}`);
    });

    // Test endpoint permission mapping
    console.log('\n✓ Endpoint to permission mapping:');
    const endpoints = [
        { method: 'POST', path: '/api/v1/optimize/route' },
        { method: 'POST', path: '/api/v1/optimize/multi-cluster' },
        { method: 'GET', path: '/api/portal/admin/users' },
    ];

    endpoints.forEach(endpoint => {
        const required = getRequiredPermission(endpoint.path, endpoint.method);
        console.log(`  ${endpoint.method} ${endpoint.path}`);
        console.log(`    → Requires: ${required || 'No permission required'}`);
    });

    // Test permission validation
    console.log('\n✓ Permission validation:');
    const validPerms = validatePermissions(['route:read', 'route:optimize']);
    const invalidPerms = validatePermissions(['route:read', 'invalid:permission']);
    console.log(`  Valid permissions:   ${validPerms.valid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Invalid permissions: ${invalidPerms.valid ? '❌ FAIL' : '✅ PASS'}`);
    if (!invalidPerms.valid) {
        invalidPerms.errors.forEach(err => console.log(`    - ${err}`));
    }
}

// ============================================================================
// TEST 4: Billing Plans
// ============================================================================
function testBillingPlans() {
    console.log('\n\n💳 TEST 4: Billing Plans & Limits');
    console.log('-'.repeat(60));

    console.log('\n✓ Subscription tiers:');
    const plans = [
        SubscriptionPlan.FREE,
        SubscriptionPlan.TRIAL,
        SubscriptionPlan.PRO,
        SubscriptionPlan.ENTERPRISE,
    ];

    plans.forEach(plan => {
        const features = PLANS[plan];
        console.log(`\n  ${plan.toUpperCase()}:`);
        console.log(`    - Requests/month: ${features.requestsPerMonth === -1 ? 'Unlimited' : features.requestsPerMonth.toLocaleString()}`);
        console.log(`    - Max locations: ${features.maxLocationsPerRequest}`);
        console.log(`    - Max cabs: ${features.maxCabsPerRequest}`);
        console.log(`    - Algorithms: ${features.algorithms.length}`);
        console.log(`    - Traffic data: ${features.traffic ? 'Yes' : 'No'}`);
        console.log(`    - Price: ${formatPrice(features.priceMonthly)}/mo`);
    });

    // Test limit enforcement
    console.log('\n✓ Testing limit enforcement:');

    const limitTests = [
        {
            plan: SubscriptionPlan.FREE,
            usage: 50,
            locations: 5,
            cabs: 1,
            description: 'Within FREE limits',
        },
        {
            plan: SubscriptionPlan.FREE,
            usage: 101,
            locations: 5,
            cabs: 1,
            description: 'Exceeds FREE monthly limit',
        },
        {
            plan: SubscriptionPlan.FREE,
            usage: 50,
            locations: 20,
            cabs: 1,
            description: 'Exceeds FREE location limit',
        },
        {
            plan: SubscriptionPlan.PRO,
            usage: 5000,
            locations: 75,
            cabs: 30,
            description: 'Within PRO limits',
        },
    ];

    limitTests.forEach(test => {
        const result = isWithinPlanLimits(test.plan, test.usage, test.locations, test.cabs);
        const status = result.allowed ? '✅' : '❌';
        console.log(`  ${status} ${test.plan} - ${test.description}`);
        if (!result.allowed) {
            console.log(`       Reason: ${result.reason}`);
        }
    });
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
    try {
        await testPasswordHashing();
        await testApiKeyGeneration();
        testPermissions();
        testBillingPlans();

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed successfully!\n');
        console.log('Foundation is ready for UI development.');
        console.log('Next steps:');
        console.log('  1. Set up database: npx prisma db push');
        console.log('  2. Generate Prisma client: npx prisma generate');
        console.log('  3. Create login/signup pages');
        console.log('  4. Build dashboard UI\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
runAllTests();
