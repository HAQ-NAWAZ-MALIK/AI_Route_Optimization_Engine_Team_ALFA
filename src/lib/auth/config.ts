/**
 * NextAuth.js v5 Configuration
 * Handles authentication with email/password and OAuth providers
 */

import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { UserRole } from '@prisma/client';

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    // Required for self-hosted deployments behind a reverse proxy (k8s ingress).
    // Without this, NextAuth v5 rejects requests with UntrustedHost in production,
    // which surfaces as a 500 on every /api/auth/* endpoint.
    trustHost: true,
    session: { strategy: 'jwt' },
    pages: {
        signIn: '/login',
        signOut: '/login',
        error: '/login',
        newUser: '/dashboard',
    },
    providers: [
        // Email & Password
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                // NextAuth v5: return null for any auth failure. Throwing here is
                // reclassified as a server "Configuration" error, which both
                // mislabels the failure and bypasses the login form's inline
                // "Invalid email or password" handling (causing a full redirect
                // to /login?error=Configuration).
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                // Emails are always stored lowercase (see signup route), so
                // normalize the lookup to avoid rejecting logins over casing or
                // stray whitespace (e.g. mobile keyboard auto-capitalization).
                const email = (credentials.email as string).trim().toLowerCase();

                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user || !user.password) {
                    return null;
                }

                const isValid = await verifyPassword(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),

        // OAuth Providers (optional)
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                Google({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                }),
            ]
            : []),

        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? [
                GitHub({
                    clientId: process.env.GITHUB_CLIENT_ID,
                    clientSecret: process.env.GITHUB_CLIENT_SECRET,
                }),
            ]
            : []),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role as UserRole;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as UserRole;
            }
            return session;
        },
    },
});

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
    const session = await auth();
    return session?.user;
}

/**
 * Require authentication (throw if not authenticated)
 */
export async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
}

/**
 * Require admin role
 */
export async function requireAdmin() {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
        throw new Error('Forbidden: Admin access required');
    }
    return user;
}
