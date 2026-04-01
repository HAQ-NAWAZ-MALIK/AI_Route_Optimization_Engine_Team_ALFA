/**
 * Delete API Key Route
 * Revoke/delete a specific API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Verify the key belongs to the user
        const apiKey = await prisma.apiKey.findUnique({
            where: { id },
            select: { userId: true },
        });

        if (!apiKey) {
            return NextResponse.json({ error: 'API key not found' }, { status: 404 });
        }

        if (apiKey.userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete the key
        await prisma.apiKey.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'API key revoked successfully' });
    } catch (error) {
        console.error('Failed to delete API key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
