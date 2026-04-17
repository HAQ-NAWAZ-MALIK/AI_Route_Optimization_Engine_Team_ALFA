/**
 * Standalone Create Test User Script
 * Inlines dependencies to avoid ts-node import issues
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function createTestUser() {
    console.log('🔧 Creating test admin user (Standalone)...\n');

    try {
        // Hash passwords
        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash('AdminPass123!', salt);
        const userPassword = await bcrypt.hash('UserPass123!', salt);

        // API Key generation helper
        const createApiKey = (role: string) => {
            const prefix = role === 'ADMIN' ? 'admin_key' : 'user_key';
            const buffer = crypto.randomBytes(32);
            const key = `${prefix}_${buffer.toString('hex')}`;
            const keyHash = crypto.createHash('sha256').update(key).digest('hex');
            return { key, keyHash, prefix };
        };

        // 1. Create ADMIN User
        const admin = await prisma.user.upsert({
            where: { email: 'admin@test.com' },
            update: { password: adminPassword, role: 'ADMIN' },
            create: {
                email: 'admin@test.com',
                name: 'Test Admin',
                password: adminPassword,
                role: 'ADMIN',
                emailVerified: new Date(),
            },
        });
        console.log('✅ Admin User:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Password: AdminPass123!`);
        console.log(`   Role: ${admin.role}\n`);

        const adminKeyData = createApiKey('ADMIN');
        await prisma.apiKey.create({
            data: {
                name: 'Admin Test Key',
                keyHash: adminKeyData.keyHash,
                prefix: adminKeyData.prefix,
                userId: admin.id,
                permissions: ['*'],
                rateLimit: 1000,
            },
        });
        console.log(`   API Key: ${adminKeyData.key}\n`);


        // 2. Create STANDARD User
        const user = await prisma.user.upsert({
            where: { email: 'user@test.com' },
            update: { password: userPassword, role: 'USER' },
            create: {
                email: 'user@test.com',
                name: 'Test User',
                password: userPassword,
                role: 'USER',
                emailVerified: new Date(),
            },
        });
        console.log('✅ Standard User:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: UserPass123!`);
        console.log(`   Role: ${user.role}\n`);

        const userKeyData = createApiKey('USER');
        await prisma.apiKey.create({
            data: {
                name: 'User Test Key',
                keyHash: userKeyData.keyHash,
                prefix: userKeyData.prefix,
                userId: user.id,
                permissions: ['optimize:read', 'optimize:create'],
                rateLimit: 100,
            },
        });
        console.log(`   API Key: ${userKeyData.key}\n`);

    } catch (error) {
        console.error('❌ Error creating test user:');
        console.error(JSON.stringify(error, null, 2));
        if (error instanceof Error) {
            console.error(error.message);
            console.error(error.stack);
        }
    } finally {
        await prisma.$disconnect();
    }
}

createTestUser();
