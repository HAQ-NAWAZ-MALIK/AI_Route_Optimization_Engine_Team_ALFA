/**
 * Admin Keys API Routes
 * Manage all API keys across platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

// GET - List all API keys
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                prefix: true,
                active: true,
                permissions: true,
                lastUsedAt: true,
                createdAt: true,
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        usageLogs: true,
                    },
                },
            },
        });

        return NextResponse.json({ keys });
    } catch (error) {
        console.error('Failed to fetch API keys:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
