/**
 * Admin Users API Routes
 * List and manage all users
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

// GET - List all users
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        // Check if admin
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                emailVerified: true,
                createdAt: true,
                _count: {
                    select: {
                        apiKeys: true,
                        usageLogs: true,
                    },
                },
                subscriptions: {
                    select: {
                        plan: true,
                        status: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
