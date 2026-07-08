import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        version: 'demo',
        timestamp: new Date().toISOString(),
        services: { optimizer: true },
    });
}
