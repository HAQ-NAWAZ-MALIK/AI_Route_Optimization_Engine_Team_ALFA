/**
 * Admin Promo Code Detail API
 * DELETE /api/admin/promo-codes/[id] — Disable a promo code
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, Errors } from '@/lib/api/error-handler';
import { requireAdmin } from '@/lib/api/permissions';
import { logAuditEvent } from '@/lib/audit/logger';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await requireAdmin();

        const code = await prisma.promoCode.findUnique({ where: { id } });
        if (!code) {
            throw Errors.notFound('Promo code');
        }

        await prisma.promoCode.update({
            where: { id },
            data: { active: false },
        });

        await logAuditEvent('PROMO_CODE_DISABLED', session.user.id, {
            promoCodeId: id,
            code: code.code,
        });

        return NextResponse.json({ success: true, message: 'Promo code disabled' });
    } catch (error) {
        return handleApiError(error);
    }
}
