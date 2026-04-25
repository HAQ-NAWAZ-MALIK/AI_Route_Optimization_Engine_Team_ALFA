# Stripe Checkout Error - Environment Variables Not Loaded

## 🔍 Problem Identified

When you clicked the "Upgrade" button, the checkout API returned a 500 error with the message:
```
Failed to create checkout session.
```

**Root Cause:** All Stripe environment variables are **NOT SET**. The server cannot create a checkout session without valid Stripe credentials.

## ✅ Diagnosis Results

Ran diagnostic: `npx tsx scripts/check-stripe-env.ts`

```
❌ STRIPE_SECRET_KEY: NOT SET
❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: NOT SET  
❌ STRIPE_PRICE_ID_PRO: NOT SET
❌ STRIPE_PRICE_ID_ENTERPRISE: NOT SET
❌ STRIPE_WEBHOOK_SECRET: NOT SET
```

## 🛠️ How to Fix

### Step 1: Check Your `.env` File Format

Open your `.env` file and make sure the Stripe variables look **EXACTLY** like this:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51abc123...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51xyz789...
STRIPE_PRICE_ID_PRO=price_1abc123...
STRIPE_PRICE_ID_ENTERPRISE=price_1xyz789...
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

**Common Mistakes to Avoid:**
- ❌ Spaces around `=` sign: `STRIPE_SECRET_KEY = sk_test_...`
- ❌ Quotes around values: `STRIPE_SECRET_KEY="sk_test_..."`
- ❌ Missing values: `STRIPE_SECRET_KEY=`
- ❌ Comments on the same line: `STRIPE_SECRET_KEY=sk_test_... # my key`

**Correct Format:**
- ✅ `STRIPE_SECRET_KEY=sk_test_...` (no spaces, no quotes)

### Step 2: Verify Your Keys

Make sure you copied the FULL keys from Stripe:
- **Secret Key** should start with `sk_test_` (107+ characters)
- **Publishable Key** should start with `pk_test_` (107+ characters)  
- **Price IDs** should start with `price_` (20-30 characters)

### Step 3: Restart the Development Server

After fixing your `.env` file, you MUST restart the server:

1. **Stop the current server:**
   - Go to the terminal running `npm run dev`
   - Press `Ctrl+C`

2. **Start it again:**
   ```bash
   npm run dev
   ```

### Step 4: Verify Variables Are Loaded

Run the diagnostic again to confirm:
```bash
npx tsx scripts/check-stripe-env.ts
```

You should see:
```
✅ STRIPE_SECRET_KEY: sk_test_51...xyz (107 chars)
✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_51...abc (107 chars)
✅ STRIPE_PRICE_ID_PRO: price_1...456 (28 chars)
✅ STRIPE_PRICE_ID_ENTERPRISE: price_1...789 (28 chars)
```

###  Step 5: Test Checkout Again

1. Go to http://localhost:3000/billing
2. Click "Upgrade" on the Pro plan
3. You should be redirected to Stripe's checkout page

## 📝 Example `.env` Format

Here's a template showing the exact format:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transport_optimizer

# Auth
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000

# Stripe (COPY YOUR ACTUAL VALUES HERE)
STRIPE_SECRET_KEY=sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_ID_PRO=price_1Hxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_ID_ENTERPRISE=price_1Hxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email
RESEND_API_KEY=re_test_key
EMAIL_FROM=noreply@test.com
```

## 🎯 Quick Checklist

- [ ] Open `.env` file
- [ ] Add/fix Stripe variables with correct format
- [ ] No spaces around `=`
- [ ] No quotes around values
- [ ] Keys start with `sk_test_`, `pk_test_`, `price_`
- [ ] Save the file
- [ ] Stop dev server (Ctrl+C)
- [ ] Restart dev server (`npm run dev`)
- [ ] Run diagnostic (`npx tsx scripts/check-stripe-env.ts`)
- [ ] Test checkout at http://localhost:3000/billing

## ❓ Still Having Issues?

If you've followed all steps and still see errors:

1. **Make sure you're in TEST mode in Stripe Dashboard**
2. **Double-check you copied the FULL keys** (they're very long)
3. **Verify the Price IDs** match your products in Stripe
4. **Check for typos** in the variable names (must be exact)

Once your `.env` is fixed and server restarted, the checkout should work! 🎉
