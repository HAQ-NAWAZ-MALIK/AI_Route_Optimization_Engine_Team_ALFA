/**
 * Admin Billing Stats API
 * GET /api/admin/billing/stats — Revenue, subscriber counts, promo usage
 */

import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { getBillingStats } from '@/lib/billing/subscription-service';

export async function GET() {
    try {
        await requireAdmin();
        const stats = await getBillingStats();
        return NextResponse.json({ success: true, stats });
    } catch (error) {
        return handleApiError(error);
    }
}
