/**
 * Quick diagnostic to check if Stripe env variables are loaded
 * Run: npx tsx scripts/check-stripe-env.ts
 */

console.log('🔍 Checking Stripe Environment Variables\n');

const envVars = {
    'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    'STRIPE_PRICE_ID_PRO': process.env.STRIPE_PRICE_ID_PRO,
    'STRIPE_PRICE_ID_ENTERPRISE': process.env.STRIPE_PRICE_ID_ENTERPRISE,
    'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET,
};

let allSet = true;

for (const [key, value] of Object.entries(envVars)) {
    if (!value) {
        console.log(`❌ ${key}: NOT SET`);
        allSet = false;
    } else {
        // Show first 10 and last 4 characters for verification
        const masked = value.length > 14
            ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
            : value.substring(0, 10) + '...';
        console.log(`✅ ${key}: ${masked} (${value.length} chars)`);
    }
}

console.log('\n' + '='.repeat(60));

if (!allSet) {
    console.log('\n⚠️  ISSUE DETECTED: Some Stripe variables are missing!\n');
    console.log('📋 Steps to fix:');
    console.log('   1. Make sure your .env file exists');
    console.log('   2. Check that variables are in this format:');
    console.log('      STRIPE_SECRET_KEY=sk_test_...');
    console.log('   3. NO SPACES around the = sign');
    console.log('   4. NO quotes around values');
    console.log('   5. Restart your dev server after editing .env\n');
    process.exit(1);
} else {
    console.log('\n✅ All Stripe environment variables are set!\n');
    console.log('If you\'re still getting errors, the issue might be:');
    console.log('   - Invalid API keys (check Stripe dashboard)');
    console.log('   - Wrong price IDs');
    console.log('   - API key not in test mode\n');
    process.exit(0);
}
