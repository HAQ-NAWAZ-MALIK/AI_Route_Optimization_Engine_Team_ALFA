/**
 * Database seed script
 *
 * Idempotent: safe to run multiple times. Uses upserts keyed on unique
 * fields so re-running never creates duplicates.
 *
 * Conventions mirror the app:
 *   - passwords: bcrypt, 12 salt rounds (src/lib/auth/password.ts)
 *   - api keys:  "ropt_" prefix, bcrypt hash @ 10 rounds (src/lib/api-keys/generator.ts)
 *
 * Run with:  npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PASSWORD_SALT_ROUNDS = 12;
const API_KEY_PREFIX = 'ropt_';
const API_KEY_LENGTH = 32;

function generateApiKey() {
  const randomString = crypto
    .randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '0')
    .replace(/\//g, '0')
    .replace(/=/g, '')
    .slice(0, API_KEY_LENGTH);
  const key = `${API_KEY_PREFIX}${randomString}`;
  return { key, prefix: key.slice(0, 12) };
}

async function main() {
  console.log('🌱  Seeding database...\n');

  // ── Users ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin123!', PASSWORD_SALT_ROUNDS);
  const demoPassword = await bcrypt.hash('Demo1234!', PASSWORD_SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@routeoptimizer.dev' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@routeoptimizer.dev',
      name: 'Platform Admin',
      password: adminPassword,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });
  console.log(`👤  Admin:  ${admin.email}  (password: Admin123!)`);

  const demo = await prisma.user.upsert({
    where: { email: 'demo@routeoptimizer.dev' },
    update: {},
    create: {
      email: 'demo@routeoptimizer.dev',
      name: 'Demo User',
      password: demoPassword,
      role: 'USER',
      emailVerified: new Date(),
    },
  });
  console.log(`👤  User:   ${demo.email}  (password: Demo1234!)`);

  // ── Subscriptions (FREE plan for each) ─────────────────────────────────────
  for (const user of [admin, demo]) {
    const existing = await prisma.subscription.findFirst({ where: { userId: user.id } });
    if (!existing) {
      await prisma.subscription.create({
        data: { userId: user.id, plan: 'FREE', status: 'ACTIVE' },
      });
    }
  }
  console.log('💳  FREE subscriptions ensured for both users');

  // ── API key for the demo user ──────────────────────────────────────────────
  // The plaintext key can't be recovered from the hash, so only create one if
  // the demo user has none yet, and print it once.
  const hasKey = await prisma.apiKey.findFirst({ where: { userId: demo.id } });
  if (!hasKey) {
    const { key, prefix } = generateApiKey();
    const keyHash = await bcrypt.hash(key, 10);
    await prisma.apiKey.create({
      data: {
        name: 'Demo Default Key',
        keyHash,
        prefix,
        userId: demo.id,
        permissions: ['route:optimize', 'route:read'],
        rateLimit: 100,
      },
    });
    console.log(`🔑  Demo API key (shown once): ${key}`);
  } else {
    console.log('🔑  Demo API key already exists — skipping');
  }

  // ── Platform config ────────────────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where: { id: 'platform_config' },
    update: {},
    create: {
      id: 'platform_config',
      updatedBy: admin.id,
      config: {
        maintenanceMode: false,
        signupsEnabled: true,
        defaultPlan: 'FREE',
        defaultRateLimit: 100,
        supportEmail: 'support@routeoptimizer.dev',
        plans: {
          FREE: { rateLimit: 100, priceCents: 0 },
          PRO: { rateLimit: 1000, priceCents: 4900 },
          ENTERPRISE: { rateLimit: 10000, priceCents: 29900 },
        },
      },
    },
  });
  console.log('⚙️   Platform config ensured');

  // ── Promo codes ────────────────────────────────────────────────────────────
  const promos = [
    { code: 'LAUNCH50', discountPercent: 50, maxRedemptions: 100 },
    { code: 'WELCOME10', discountPercent: 10, maxRedemptions: 1000 },
  ];
  for (const p of promos) {
    await prisma.promoCode.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        discountPercent: p.discountPercent,
        maxRedemptions: p.maxRedemptions,
        applicablePlans: ['PRO', 'ENTERPRISE'],
        createdBy: admin.id,
      },
    });
  }
  console.log(`🏷️   Promo codes ensured: ${promos.map((p) => p.code).join(', ')}`);

  // ── Welcome broadcast notification ─────────────────────────────────────────
  const welcomeTitle = 'Welcome to AI Route Optimizer';
  const existingWelcome = await prisma.notification.findFirst({ where: { title: welcomeTitle } });
  if (!existingWelcome) {
    await prisma.notification.create({
      data: {
        type: 'ANNOUNCEMENT',
        priority: 'NORMAL',
        title: welcomeTitle,
        body: 'Your account is ready. Generate an API key and start optimizing routes.',
        actionUrl: '/docs',
        userId: null, // broadcast to everyone
        sentAt: new Date(),
        createdBy: admin.id,
      },
    });
    console.log('🔔  Welcome broadcast notification created');
  } else {
    console.log('🔔  Welcome notification already exists — skipping');
  }

  console.log('\n✅  Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
