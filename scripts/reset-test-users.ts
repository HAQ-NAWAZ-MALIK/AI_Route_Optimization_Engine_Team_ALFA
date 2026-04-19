/**
 * Reset Test Users Script
 * Deletes all users and creates 2 clean test users:
 * 1. Admin user
 * 2. Regular user
 */

import { prisma } from '../src/lib/db/prisma';
import { hashPassword } from '../src/lib/auth/password';
import { generateApiKey } from '../src/lib/api-keys/generator';

async function resetTestUsers() {
    console.log('🗑️  Deleting all existing users...\n');

    // Delete all data (cascade will handle related records)
    await prisma.user.deleteMany({});

    console.log('✅ All users deleted\n');

    // Create Admin User
    console.log('👑 Creating admin user...');
    const adminPassword = await hashPassword('AdminPass123!');

    const adminUser = await prisma.user.create({
        data: {
            name: 'Admin User',
            email: 'admin@test.com',
            password: adminPassword,
            role: 'ADMIN',
            emailVerified: new Date(),
        },
    });

    // Create PRO subscription for admin
    await prisma.subscription.create({
        data: {
            userId: adminUser.id,
            plan: 'PRO',
            status: 'ACTIVE',
        },
    });

    // Create API key for admin
    const { key: adminKey, keyHash: adminKeyHash, prefix: adminPrefix } = await generateApiKey(false);

    await prisma.apiKey.create({
        data: {
            name: 'Admin API Key',
            keyHash: adminKeyHash,
            prefix: adminPrefix,
            userId: adminUser.id,
            permissions: ['route:read', 'route:optimize', 'cluster:optimize', 'matrix:calculate', 'admin:*'],
            rateLimit: 1000,
        },
    });

    console.log('✅ Admin user created:');
    console.log('   Email: admin@test.com');
    console.log('   Password: AdminPass123!');
    console.log(`   API Key: ${adminKey}\n`);

    // Create Regular User
    console.log('👤 Creating regular user...');
    const userPassword = await hashPassword('UserPass123!');

    const regularUser = await prisma.user.create({
        data: {
            name: 'Test User',
            email: 'user@test.com',
            password: userPassword,
            role: 'USER',
            emailVerified: new Date(),
        },
    });

    // Create FREE subscription for regular user
    await prisma.subscription.create({
        data: {
            userId: regularUser.id,
            plan: 'FREE',
            status: 'ACTIVE',
        },
    });

    // Create API key for regular user
    const { key: userKey, keyHash: userKeyHash, prefix: userPrefix } = await generateApiKey(false);

    await prisma.apiKey.create({
        data: {
            name: 'User API Key',
            keyHash: userKeyHash,
            prefix: userPrefix,
            userId: regularUser.id,
            permissions: ['route:read', 'route:optimize'],
            rateLimit: 100,
        },
    });

    console.log('✅ Regular user created:');
    console.log('   Email: user@test.com');
    console.log('   Password: UserPass123!');
    console.log(`   API Key: ${userKey}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Database reset complete!\n');
    console.log('📋 Summary:');
    console.log('   • 2 users created');
    console.log('   • 1 Admin (PRO plan, full permissions)');
    console.log('   • 1 User (FREE plan, basic permissions)');
    console.log('   • 2 API keys created');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔐 Login Credentials:');
    console.log('\nAdmin:');
    console.log('  Email: admin@test.com');
    console.log('  Password: AdminPass123!');
    console.log('\nUser:');
    console.log('  Email: user@test.com');
    console.log('  Password: UserPass123!');
}

resetTestUsers()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error resetting users:', error);
        process.exit(1);
    });
