/**
 * Admin Platform Config API
 * 
 * GET  /api/admin/config — Read full platform config
 * PUT  /api/admin/config — Update platform config (partial merge)
 * 
 * Admin-only. Requires authenticated admin session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getConfig, updateConfig, type PlatformConfigData } from '@/lib/config/platform-config';
import { prisma } from '@/lib/db/prisma';

// ============================================================================
// Helpers
// ============================================================================

async function requireAdmin() {
    const session = await auth();
    if (!session?.user) {
        return { error: 'Unauthorized', status: 401, user: null };
    }
    if (session.user.role !== 'ADMIN') {
        return { error: 'Forbidden — admin access required', status: 403, user: null };
    }
    return { error: null, status: 200, user: session.user };
}

// ============================================================================
// GET — Read platform config
// ============================================================================

export async function GET() {
    const { error, status } = await requireAdmin();
    if (error) {
        return NextResponse.json({ success: false, error }, { status });
    }

    const config = await getConfig();
    return NextResponse.json({ success: true, config });
}

// ============================================================================
// PUT — Update platform config
// ============================================================================

export async function PUT(request: NextRequest) {
    const { error, status, user } = await requireAdmin();
    if (error) {
        return NextResponse.json({ success: false, error }, { status });
    }

    let body: Partial<PlatformConfigData>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
        );
    }

    // Basic validation — only allow known top-level keys
    const allowedKeys = ['tierLimits', 'planLimits', 'features', 'maintenance'];
    const invalidKeys = Object.keys(body).filter(k => !allowedKeys.includes(k));
    if (invalidKeys.length > 0) {
        return NextResponse.json(
            { success: false, error: `Unknown config keys: ${invalidKeys.join(', ')}` },
            { status: 400 }
        );
    }

    // Validate tier limits if provided
    if (body.tierLimits) {
        for (const [tier, limits] of Object.entries(body.tierLimits)) {
            if (typeof limits.requestsPerDay !== 'number' ||
                typeof limits.requestsPerMinute !== 'number' ||
                typeof limits.maxDestinations !== 'number') {
                return NextResponse.json(
                    { success: false, error: `Invalid tier limits for "${tier}" — all fields must be numbers` },
                    { status: 400 }
                );
            }
        }
    }

    // Validate plan limits if provided
    if (body.planLimits) {
        for (const [plan, limits] of Object.entries(body.planLimits)) {
            if (typeof limits.requestsPerMonth !== 'number' ||
                typeof limits.maxLocations !== 'number' ||
                typeof limits.maxCabs !== 'number') {
                return NextResponse.json(
                    { success: false, error: `Invalid plan limits for "${plan}" — all fields must be numbers` },
                    { status: 400 }
                );
            }
        }
    }

    try {
        const updated = await updateConfig(body, user!.id);

        // Write audit log
        try {
            await prisma.auditLog.create({
                data: {
                    userId: user!.id,
                    action: 'UPDATE_PLATFORM_CONFIG',
                    details: {
                        resource: 'platform_config',
                        updatedKeys: Object.keys(body),
                        timestamp: new Date().toISOString(),
                    },
                },
            });
        } catch (auditError) {
            console.error('Audit log failed:', auditError);
        }

        return NextResponse.json({ success: true, config: updated });
    } catch (err) {
        console.error('Failed to update config:', err);
        return NextResponse.json(
            { success: false, error: 'Failed to persist config changes' },
            { status: 500 }
        );
    }
}
