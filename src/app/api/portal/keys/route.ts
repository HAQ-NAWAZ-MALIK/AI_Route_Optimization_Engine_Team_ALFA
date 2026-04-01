/**
 * API Keys API Routes
 * CRUD operations for API keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { generateApiKey } from '@/lib/api-keys/generator';
import { validatePermissions } from '@/lib/api-keys/permissions';
import { notifyApiKeyCreated } from '@/lib/notifications/notification-service';

// GET - List all user's API keys
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const keys = await prisma.apiKey.findMany({
            where: { userId: session.user.id, active: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                prefix: true,
                permissions: true,
                lastUsedAt: true,
                createdAt: true,
                rateLimit: true,
            },
        });

        return NextResponse.json({ keys });
    } catch (error) {
        console.error('Failed to fetch API keys:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, permissions } = await request.json();

        // Validate input
        if (!name || !permissions || !Array.isArray(permissions)) {
            return NextResponse.json(
                { error: 'Name and permissions are required' },
                { status: 400 }
            );
        }

        // Validate permissions
        const permValidation = validatePermissions(permissions);
        if (!permValidation.valid) {
            return NextResponse.json(
                { error: 'Invalid permissions', details: permValidation.errors },
                { status: 400 }
            );
        }

        // Generate API key
        const { key, keyHash, prefix } = await generateApiKey(false);

        // Save to database
        const apiKey = await prisma.apiKey.create({
            data: {
                name,
                keyHash,
                prefix,
                userId: session.user.id,
                permissions,
                rateLimit: 100, // default rate limit
            },
        });

        // Fire security notification (async)
        notifyApiKeyCreated(session.user.id, name).catch(console.error);

        // Return the full key (only time it's shown)
        return NextResponse.json({
            key, // Full key - only shown once!
            id: apiKey.id,
            name: apiKey.name,
            prefix: apiKey.prefix,
        }, { status: 201 });
    } catch (error) {
        console.error('Failed to create API key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
