/**
 * Create Test User Script
 * Quickly set up a test admin user in the database
 */

import { prisma } from '../src/lib/db/prisma';
import { hashPassword } from '../src/lib/auth/password';
import { generateApiKey } from '../src/lib/api-keys/generator';
import { getDefaultUserPermissions } from '../src/lib/api-keys/permissions';

async function createTestUser() {
    console.log('🔧 Creating test admin user...\n');

    try {
        // Check if user already exists
        const existing = await prisma.user.findUnique({
            where: { email: 'admin@test.com' },
        });

        if (existing) {
            console.log('⚠️  User admin@test.com already exists!');
            console.log('   Use this to login or delete the user first.\n');
            return;
        }

        // Create admin user
        const hashedPassword = await hashPassword('AdminPass123!');

        const user = await prisma.user.create({
            data: {
                email: 'admin@test.com',
                name: 'Test Admin',
                password: hashedPassword,
                role: 'ADMIN',
                emailVerified: new Date(), // Already verified for testing
            },
        });

        console.log('✅ User created:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: AdminPass123!`);
        console.log(`   Role: ${user.role}\n`);

        // Create subscription
        const subscription = await prisma.subscription.create({
            data: {
                userId: user.id,
                plan: 'PRO',
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });

        console.log('✅ Subscription created:');
        console.log(`   Plan: ${subscription.plan}`);
        console.log(`   Status: ${subscription.status}\n`);

        // Create API key
        const apiKeyData = await generateApiKey(false);

        const apiKey = await prisma.apiKey.create({
            data: {
                name: 'Test API Key',
                keyHash: apiKeyData.keyHash,
                prefix: apiKeyData.prefix,
                userId: user.id,
                permissions: getDefaultUserPermissions(),
                rateLimit: 100,
            },
        });

        console.log('✅ API Key created:');
        console.log(`   Key: ${apiKeyData.key}`);
        console.log(`   ⚠️  SAVE THIS! It won't be shown again.`);
        console.log(`   Permissions: ${apiKey.permissions.join(', ')}\n`);

        console.log('🎉 Test user setup complete!\n');
        console.log('You can now:');
        console.log('  1. Login at http://localhost:3000/login');
        console.log('     Email: admin@test.com');
        console.log('     Password: AdminPass123!');
        console.log('  2. Use the API key for API requests');
        console.log('  3. Access admin portal at /admin\n');

    } catch (error) {
        console.error('❌ Error creating test user:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createTestUser();
