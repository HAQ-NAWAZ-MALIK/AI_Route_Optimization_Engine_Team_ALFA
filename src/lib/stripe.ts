/**
 * Lazily-constructed Stripe client.
 *
 * The Stripe SDK throws ("Neither apiKey nor config.authenticator provided")
 * if constructed without a key. Constructing it at module top-level breaks
 * `next build`, which imports every route module during page-data collection
 * when STRIPE_SECRET_KEY is not present. Constructing on first use instead
 * keeps the build green and surfaces a clear error at request time if the key
 * is missing in production.
 */

import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripe(): Stripe {
    if (!client) {
        const apiKey = process.env.STRIPE_SECRET_KEY;
        if (!apiKey) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        client = new Stripe(apiKey, {
            apiVersion: '2025-12-15.clover',
        });
    }
    return client;
}
