# Enterprise API Portal - Quick Start Guide

## Prerequisites

Before testing, ensure you have:
- ✅ Node.js 18+ installed
- ✅ PostgreSQL running (or use SQLite for testing)
- ✅ All dependencies installed

## Setup Steps

### 1. Install Dependencies (if not done)

```bash
npm install
```

Check status of the installation from earlier. If needed, run again.

### 2. Configure Environment

```bash
# Copy the example
copy .env.example .env

# Edit .env and set these minimal values for testing:
```

**Minimal `.env` for testing:**
```.env
# Database (choose one)
# Option A: PostgreSQL (recommended)
DATABASE_URL="postgresql://postgres:password@localhost:5432/transport_optimizer"

# Option B: SQLite (quick testing)
# DATABASE_URL="file:./dev.db"

# Auth (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
NEXTAUTH_SECRET="your_generated_secret_here_min_32_chars"
NEXTAUTH_URL="http://localhost:3000"

# Email (optional for now - can test without)
RESEND_API_KEY="re_test_key"
EMAIL_FROM="noreply@test.com"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

This creates the TypeScript client from your schema.

### 4. Set Up Database

**Option A: Push to Development DB (quick)**
```bash
npx prisma db push
```

**Option B: Create Migration (production-ready)**
```bash
npx prisma migrate dev --name init
```

### 5. Run Foundation Tests

```bash
npx tsx test-foundation.ts
```

This will test:
- ✅ Password hashing & validation
- ✅ API key generation & verification
- ✅ Permission system
- ✅ Billing plan limits

### 6. Explore Database (Optional)

```bash
npx prisma studio
```

Opens a GUI at `http://localhost:5555` to view/edit database.

### 7. Create a Test User

In Prisma Studio or using SQL:

```sql
-- Create user
INSERT INTO users (id, email, name, password, role, "emailVerified", "createdAt", "updatedAt")
VALUES (
  'test_user_1',
  'admin@test.com',
  'Test Admin',
  -- Password: TestPass123! (will need to hash this - use test script)
  '$2a$12$abcdefghijklmnopqrstuvwxyz123456789',
  'ADMIN',
  NOW(),
  NOW(),
  NOW()
);

-- Create subscription
INSERT INTO subscriptions (id, "userId", plan, status, "createdAt", "updatedAt")
VALUES (
  'sub_1',
  'test_user_1',
  'PRO',
  'ACTIVE',
  NOW(),
  NOW()
);
```

**Or use this helper script:**

```bash
npx tsx scripts/create-test-user.ts
```

## Testing the API

### Test 1: Password Utilities

```bash
node -e "
const { hashPassword } = require('./src/lib/auth/password.ts');
hashPassword('TestPass123!').then(hash => console.log('Hash:', hash));
"
```

### Test 2: API Key Generation

```bash
npx tsx -e "
import { generateApiKey } from './src/lib/api-keys/generator';
generateApiKey(false).then(key => {
  console.log('Generated API Key:', key.key);
  console.log('Store this hash in DB:', key.keyHash);
  console.log('Show user this prefix:', key.prefix);
});
"
```

### Test 3: Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## What Can You Test Now?

### ✅ Core Utilities
- Password hashing/verification
- API key generation
- Permission checking
- Plan limit validation

### ⏳ Requires UI (Next Phase)
- User login/signup
- Dashboard
- API key management
- Billing pages

## Common Issues

### Issue: Prisma Client Not Generated
```bash
npx prisma generate
```

### Issue: Database Connection Failed
Check your `DATABASE_URL` in `.env` and ensure PostgreSQL is running:
```bash
# Windows
net start postgresql-x64-14

# Or use SQLite for quick testing
DATABASE_URL="file:./dev.db"
```

### Issue: TypeScript Errors
```bash
npm install --save-dev @types/bcryptjs
npx prisma generate
```

## Next Steps

Once foundation tests pass:

1. **Create Authentication Pages**
   - `/login` page
   - `/signup` page
   - `/verify-email` page

2. **Build User Portal**
   - `/dashboard` - Usage overview
   - `/api-keys` - Key management
   - `/billing` - Subscription
   - `/usage` - Analytics

3. **Build Admin Portal**
   - `/admin/dashboard` - Platform metrics
   - `/admin/users` - User management
   - `/admin/analytics` - System analytics

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run migrations (production)
npx prisma migrate dev

# View database
npx prisma studio

# Run foundation tests
npx tsx test-foundation.ts

# Start development server
npm run dev

# Start MCP server
npm run mcp:http
```

## File Structure Created

```
✅ prisma/schema.prisma          - Database schema
✅ src/lib/db/prisma.ts           - Database client
✅ src/lib/auth/config.ts         - NextAuth config
✅ src/lib/auth/password.ts       - Password utils
✅ src/lib/api-keys/generator.ts  - Key generation
✅ src/lib/api-keys/permissions.ts - Permission system
✅ src/lib/billing/plans.ts       - Subscription tiers
✅ src/types/next-auth.d.ts       - TypeScript types
✅ test-foundation.ts             - Test suite
```

---

**Ready to code!** 🚀 The foundation is solid. Run the tests to verify everything works!
