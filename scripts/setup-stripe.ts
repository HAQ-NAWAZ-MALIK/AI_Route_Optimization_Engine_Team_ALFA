/**
 * Stripe Configuration Helper
 * Run this script to add your Stripe credentials to .env file
 * Usage: npx tsx scripts/setup-stripe.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function setupStripe() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       Stripe Configuration Setup                     ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('📚 Setup Guide: Follow STRIPE_SETUP.md for detailed instructions\n');
    console.log('Press Ctrl+C to exit at any time\n');

    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    // Read existing .env if it exists
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
        console.log('✓ Found existing .env file\n');
    } else {
        console.log('⚠ No .env file found, will create a new one\n');
    }

    // Ask for Stripe credentials
    console.log('🔐 Stripe API Keys (from: Dashboard → Developers → API keys)');
    console.log('   Make sure you\'re in TEST MODE\n');

    const secretKey = await question('Enter your Stripe Secret Key (sk_test_...): ');
    if (!secretKey.startsWith('sk_test_')) {
        console.log('\n⚠ Warning: This doesn\'t look like a test key. Are you sure?');
    }

    const publishableKey = await question('Enter your Stripe Publishable Key (pk_test_...): ');
    if (!publishableKey.startsWith('pk_test_')) {
        console.log('\n⚠ Warning: This doesn\'t look like a test key. Are you sure?');
    }

    console.log('\n💰 Stripe Price IDs (from: Dashboard → Products)');
    console.log('   Create two products: Pro Plan ($49/mo) and Enterprise Plan ($499/mo)\n');

    const proPriceId = await question('Enter your Pro Plan Price ID (price_...): ');
    if (!proPriceId.startsWith('price_')) {
        console.log('\n⚠ Warning: Price IDs usually start with "price_"');
    }

    const enterprisePriceId = await question('Enter your Enterprise Plan Price ID (price_...): ');
    if (!enterprisePriceId.startsWith('price_')) {
        console.log('\n⚠ Warning: Price IDs usually start with "price_"');
    }

    console.log('\n🔔 Webhook Secret (Optional - needed for production)');
    console.log('   For local testing, you can skip this (press Enter)\n');
    const webhookSecret = await question('Enter your Webhook Secret (whsec_...) or press Enter to skip: ');

    rl.close();

    // Update or add environment variables
    const updates: Record<string, string> = {
        'STRIPE_SECRET_KEY': secretKey,
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': publishableKey,
        'STRIPE_PRICE_ID_PRO': proPriceId,
        'STRIPE_PRICE_ID_ENTERPRISE': enterprisePriceId,
    };

    if (webhookSecret) {
        updates['STRIPE_WEBHOOK_SECRET'] = webhookSecret;
    }

    // Update .env content
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            // Update existing value
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            // Add new value
            envContent += `\n${key}=${value}`;
        }
    }

    // Write updated .env file
    fs.writeFileSync(envPath, envContent.trim() + '\n');

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                 ✓ Setup Complete!                    ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('✅ Stripe credentials saved to .env\n');
    console.log('📋 Next steps:');
    console.log('   1. Restart your development server:');
    console.log('      npm run dev\n');
    console.log('   2. Login to your app:');
    console.log('      http://localhost:3000/login\n');
    console.log('   3. Go to billing page:');
    console.log('      http://localhost:3000/billing\n');
    console.log('   4. Click "Upgrade" on any paid plan\n');
    console.log('   5. Use test card: 4242 4242 4242 4242\n');
    console.log('🎉 Happy testing!\n');
}

setupStripe().catch((error) => {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
});
