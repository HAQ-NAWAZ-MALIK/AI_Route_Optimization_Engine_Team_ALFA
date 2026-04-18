# Stripe Setup Guide

## Overview

This guide will help you set up Stripe billing for your AI Transport Optimizer application. We'll use Stripe's **Test Mode** so no real money is involved during development.

## Step 1: Create a Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Click **Sign up** and create your account
3. Complete the registration process
4. You'll land on your Stripe Dashboard

> **Note:** You DON'T need to activate your account or provide business details for testing. Test mode works immediately.

## Step 2: Get Your API Keys

1. In your Stripe Dashboard, click **Developers** in the top menu
2. Click **API keys** in the left sidebar
3. Make sure **Test mode** is enabled (toggle in top right)
4. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) - Click "Reveal test key"

5. Copy both keys and save them temporarily

## Step 3: Create Products and Prices

### Create Pro Plan Product

1. Click **Products** in the left sidebar
2. Click **+ Add Product**
3. Fill in:
   - **Name:** Pro Plan
   - **Description:** For growing businesses and production use
   - **Price:** 49.00
   - **Billing period:** Monthly
   - **Currency:** USD
4. Click **Save product**
5. **Copy the Price ID** (starts with `price_...`) - you'll need this

### Create Enterprise Plan Product

1. Click **+ Add Product** again
2. Fill in:
   - **Name:** Enterprise Plan
   - **Description:** For large-scale operations
   - **Price:** 499.00
   - **Billing period:** Monthly
   - **Currency:** USD
3. Click **Save product**
4. **Copy the Price ID** (starts with `price_...`)

## Step 4: Configure Environment Variables

1. Open your `.env` file (create it from `.env.example` if it doesn't exist)
2. Add/update these variables:

```env
# Stripe API Keys (from Step 2)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Stripe Price IDs (from Step 3)
STRIPE_PRICE_ID_PRO=price_your_pro_price_id_here
STRIPE_PRICE_ID_ENTERPRISE=price_your_enterprise_price_id_here

# Webhook Secret (we'll set this up later)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

3. Save the file

## Step 5: Restart Your Development Server

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then restart it:
npm run dev
```

## Step 6: Test the Integration

1. Login to your app: http://localhost:3000/login
   - Use: `user@test.com` / `UserPass123!`

2. Go to billing page: http://localhost:3000/billing

3. Click **Upgrade** on the Pro plan

4. You should be redirected to Stripe's checkout page

5. Use Stripe's test card:
   - **Card Number:** 4242 4242 4242 4242
   - **Expiry:** Any future date (e.g., 12/25)
   - **CVC:** Any 3 digits (e.g., 123)
   - **ZIP:** Any 5 digits (e.g., 12345)

6. Complete the checkout

7. You should be redirected back to `/billing?success=true`

## Step 7: Set Up Webhooks (Optional for local development)

For local testing, you can use the Stripe CLI:

1. Download Stripe CLI: https://stripe.com/docs/stripe-cli
2. Install it
3. Run:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
4. Copy the webhook signing secret (starts with `whsec_...`)
5. Add it to your `.env` as `STRIPE_WEBHOOK_SECRET`

## Test Cards Reference

**Successful payments:**
- `4242 4242 4242 4242` - Visa
- `5555 5555 5555 4444` - Mastercard

**Failed payments (for testing):**
- `4000 0000 0000 0002` - Card declined

**3D Secure (requires authentication):**
- `4000 0025 0000 3155` - Requires authentication

## Troubleshooting

### "Stripe price not configured" Error
- Make sure you've added `STRIPE_PRICE_ID_PRO` and `STRIPE_PRICE_ID_ENTERPRISE` to your `.env`
- Restart the development server after updating `.env`

### Checkout page doesn't load
- Verify your `STRIPE_SECRET_KEY` is correct
- Check browser console for errors
- Make sure you're in Test Mode in Stripe Dashboard

### Payment succeeds but subscription not updated
- Set up webhooks (Step 7)
- Check server logs for webhook errors

## Going to Production

When ready for production:

1. Switch to **Live Mode** in Stripe Dashboard
2. Get your live API keys (start with `sk_live_` and `pk_live_`)
3. Create live products with real prices
4. Update `.env` with live keys
5. Set up production webhooks in Stripe Dashboard → Webhooks

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Test Cards: https://stripe.com/docs/testing
- Stripe CLI: https://stripe.com/docs/stripe-cli
