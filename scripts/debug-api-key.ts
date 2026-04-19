/**
 * Debug API Key Validation
 * Check if portal keys exist in database and can be validated
 */

import { PrismaClient } from '@prisma/client';
import { verifyApiKey } from '../src/lib/api-keys/generator';

const prisma = new PrismaClient();

const TEST_KEYS = {
    admin: 'ropt_nC2MUwuuebyvyXJ0kLm3JF6c4bmYm1L6',
    user: 'ropt_h7eToeO1C7Tqa74wI05LVLpQnatIprgX',
};

async function debugKey(keyName: string, fullKey: string) {
    console.log(`\n━━━ Debugging ${keyName.toUpperCase()} Key ━━━`);
    console.log(`Full Key: ${fullKey}`);

    // Extract prefix
    const prefix = fullKey.substring(0, 13);
    console.log(`Prefix: ${prefix}`);

    // Check if key exists in database
    const dbKey = await prisma.apiKey.findFirst({
        where: { prefix },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    subscriptions: {
                        where: { status: 'ACTIVE' },
                        select: { plan: true, status: true },
                    },
                },
            },
        },
    });

    if (!dbKey) {
        console.log(`❌ Key NOT found in database!`);
        console.log(`   Searching for prefix: ${prefix}`);

        // Check if any keys exist
        const allKeys = await prisma.apiKey.findMany({
            select: { prefix: true, name: true },
        });
        console.log(`\n   Available keys in database (${allKeys.length}):`);
        allKeys.forEach(k => console.log(`   - ${k.prefix} (${k.name})`));
        return;
    }

    console.log(`✅ Key found in database!`);
    console.log(`   ID: ${dbKey.id}`);
    console.log(`   Name: ${dbKey.name}`);
    console.log(`   User: ${dbKey.user.email} (${dbKey.user.role})`);
    console.log(`   Subscription: ${dbKey.user.subscriptions[0]?.plan || 'NONE'}`);
    console.log(`   Expires: ${dbKey.expiresAt?.toISOString() || 'Never'}`);

    // Check if expired
    if (dbKey.expiresAt && dbKey.expiresAt < new Date()) {
        console.log(`❌ Key is EXPIRED!`);
        return;
    }

    // Verify hash
    console.log(`\n🔐 Verifying hash...`);
    console.log(`   Stored hash: ${dbKey.keyHash.substring(0, 20)}...`);

    try {
        const isValid = await verifyApiKey(fullKey, dbKey.keyHash);
        if (isValid) {
            console.log(`✅ Hash verification PASSED!`);
        } else {
            console.log(`❌ Hash verification FAILED!`);
            console.log(`   This means the key doesn't match the stored hash`);
        }
    } catch (error) {
        console.log(`❌ Hash verification ERROR: ${error}`);
    }

    // Check permissions
    console.log(`\n🔑 Permissions: ${dbKey.permissions.join(', ')}`);
    console.log(`⏱️  Rate Limit: ${dbKey.rateLimit} requests/15min`);
}

async function main() {
    console.log('🔍 API Key Diagnostic Tool\n');

    try {
        // Check database connection
        await prisma.$connect();
        console.log('✅ Database connected\n');

        // Debug admin key
        await debugKey('admin', TEST_KEYS.admin);

        // Debug user key
        await debugKey('user', TEST_KEYS.user);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Diagnostic complete!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
