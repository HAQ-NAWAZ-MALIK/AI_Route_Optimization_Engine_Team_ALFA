/**
 * API Key Generator
 * Generates secure, prefixed API keys for route optimization service
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const KEY_PREFIX = 'ropt_';
const TEST_KEY_PREFIX = 'ropt_test_';
const KEY_LENGTH = 32; // characters after prefix

/**
 * Generate a new API key
 * @param isTest - Whether to generate a test mode key
 * @returns Object with plaintext key and hash
 */
export async function generateApiKey(isTest: boolean = false): Promise<{
    key: string;
    keyHash: string;
    prefix: string;
}> {
    const prefix = isTest ? TEST_KEY_PREFIX : KEY_PREFIX;

    // Generate random bytes and convert to base62 (alphanumeric)
    const randomBytes = crypto.randomBytes(24);
    const randomString = randomBytes.toString('base64')
        .replace(/\+/g, '0')
        .replace(/\//g, '0')
        .replace(/=/g, '')
        .slice(0, KEY_LENGTH);

    const key = `${prefix}${randomString}`;
    const keyHash = await hashApiKey(key);
    const displayPrefix = key.slice(0, 12); // First 12 chars for display

    return {
        key,
        keyHash,
        prefix: displayPrefix,
    };
}

/**
 * Hash an API key for secure storage
 */
export async function hashApiKey(key: string): Promise<string> {
    return await bcrypt.hash(key, 10);
}

/**
 * Verify an API key against a hash
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(key, hash);
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(key: string): boolean {
    const validPrefixes = [KEY_PREFIX, TEST_KEY_PREFIX];
    const hasValidPrefix = validPrefixes.some(prefix => key.startsWith(prefix));

    if (!hasValidPrefix) return false;

    // Check length (prefix + KEY_LENGTH)
    const expectedLength = KEY_PREFIX.length + KEY_LENGTH;
    const testExpectedLength = TEST_KEY_PREFIX.length + KEY_LENGTH;

    return key.length === expectedLength || key.length === testExpectedLength;
}

/**
 * Extract key type from key string
 */
export function getKeyType(key: string): 'production' | 'test' | 'invalid' {
    if (key.startsWith(TEST_KEY_PREFIX)) return 'test';
    if (key.startsWith(KEY_PREFIX)) return 'production';
    return 'invalid';
}
