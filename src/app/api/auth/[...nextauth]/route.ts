/**
 * NextAuth.js API Route Handler
 * Handles all authentication requests
 */

import { handlers } from '@/lib/auth/config';

export const { GET, POST } = handlers;
