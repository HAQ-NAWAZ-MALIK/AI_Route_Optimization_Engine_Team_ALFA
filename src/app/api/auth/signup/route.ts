/**
 * Signup API Route
 * Create new user account
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, validatePassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
    try {
        const { name, email, password } = await request.json();

        // Validate input
        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Name, email, and password are required' },
                { status: 400 }
            );
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: 'Password does not meet security requirements', details: passwordValidation.errors },
                { status: 400 }
            );
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                emailVerified: new Date(),
                role: 'USER',
            },
        });

        // Create FREE subscription
        await prisma.subscription.create({
            data: {
                userId: user.id,
                plan: 'FREE',
                status: 'ACTIVE',
            },
        });

        // TODO: Send verification email
        // await sendVerificationEmail(user.email);

        return NextResponse.json(
            {
                message: 'Account created successfully. Please check your email to verify your account.',
                userId: user.id,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Failed to create account. Please try again.' },
            { status: 500 }
        );
    }
}
