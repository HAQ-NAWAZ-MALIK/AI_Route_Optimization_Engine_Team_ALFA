/**
 * Signup Page
 * User registration with email verification
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validatePassword } from '@/lib/auth/password';

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ valid: false, errors: [] as string[] });

    const handlePasswordChange = (password: string) => {
        setFormData({ ...formData, password });
        setPasswordStrength(validatePassword(password));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        setIsLoading(true);

        // Validate
        const newErrors: Record<string, string> = {};
        if (!formData.name) newErrors.name = 'Name is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!passwordStrength.valid) newErrors.password = 'Password does not meet requirements';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                setErrors({ submit: data.error || 'Failed to create account' });
            } else {
                router.push('/login?registered=true');
            }
        } catch (err) {
            setErrors({ submit: 'An error occurred. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                Create your account
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: 'var(--space-8)' }}>
                Get started with RouteOptimizer AI
            </p>

            <form onSubmit={handleSubmit}>
                <Input
                    id="name"
                    label="Full Name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={errors.name}
                    required
                />

                <Input
                    id="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={errors.email}
                    required
                />

                <Input
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    error={errors.password}
                    required
                />

                {formData.password && !passwordStrength.valid && (
                    <div style={{ marginTop: '-var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: 'var(--space-2)' }}>
                            Password must include:
                        </p>
                        <ul style={{ fontSize: '12px', paddingLeft: 'var(--space-5)' }}>
                            {passwordStrength.errors.map((error, i) => (
                                <li key={i} style={{ color: 'var(--red)' }}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {errors.submit && (
                    <p style={{ color: 'var(--red)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
                        {errors.submit}
                    </p>
                )}

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: '13px', color: 'var(--gray-400)', marginBottom: 'var(--space-6)' }}>
                    <input type="checkbox" required style={{ marginTop: '2px' }} />
                    <span>
                        I agree to the <Link href="/terms" style={{ color: 'var(--blue-light)', textDecoration: 'none' }}>Terms of Service</Link> and <Link href="/privacy" style={{ color: 'var(--blue-light)', textDecoration: 'none' }}>Privacy Policy</Link>
                    </span>
                </label>

                <Button type="submit" variant="primary" isLoading={isLoading} style={{ width: '100%' }}>
                    Create Account
                </Button>
            </form>

            <p style={{ marginTop: 'var(--space-8)', textAlign: 'center', fontSize: '14px', color: 'var(--gray-400)' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--blue-light)', textDecoration: 'none', fontWeight: '500' }}>
                    Sign in
                </Link>
            </p>
        </div>
    );
}
