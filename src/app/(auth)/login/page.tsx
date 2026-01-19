/**
 * Login Page
 * User authentication with NextAuth
 */

'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({
        google: false,
        github: false,
    });

    const registered = searchParams.get('registered') === 'true';

    useEffect(() => {
        fetch('/api/auth/providers-status')
            .then((res) => res.json())
            .then((data) => setProviders(data))
            .catch(() => { });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
            } else {
                router.push('/dashboard');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const hasOAuth = providers.google || providers.github;

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                Welcome back
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: 'var(--space-8)' }}>
                Sign in to your account to continue
            </p>

            {registered && (
                <p style={{ color: 'var(--green, #22c55e)', fontSize: '14px', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                    Account created successfully! Please sign in.
                </p>
            )}

            <form onSubmit={handleSubmit}>
                <Input
                    id="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    error={error && email === '' ? 'Email is required' : undefined}
                />

                <Input
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    error={error && password === '' ? 'Password is required' : undefined}
                />

                {error && (
                    <p style={{ color: 'var(--red)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
                        {error}
                    </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '14px', color: 'var(--gray-400)' }}>
                        <input type="checkbox" />
                        Remember me
                    </label>
                    <Link href="/forgot-password" style={{ fontSize: '14px', color: 'var(--blue-light)', textDecoration: 'none' }}>
                        Forgot password?
                    </Link>
                </div>

                <Button type="submit" variant="primary" isLoading={isLoading} style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
                    Sign In
                </Button>

                {hasOAuth && (
                    <>
                        <div style={{ position: 'relative', textAlign: 'center', margin: 'var(--space-6) 0' }}>
                            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                            <span style={{ position: 'relative', background: 'rgba(255, 255, 255, 0.03)', padding: '0 var(--space-4)', fontSize: '12px', color: 'var(--gray-500)' }}>
                                OR
                            </span>
                        </div>

                        {providers.google && (
                            <Button type="button" variant="ghost" style={{ width: '100%', marginBottom: 'var(--space-3)' }} onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
                                <svg width="18" height="18" viewBox="0 0 18 18">
                                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                                    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
                                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                                </svg>
                                Continue with Google
                            </Button>
                        )}

                        {providers.github && (
                            <Button type="button" variant="ghost" style={{ width: '100%' }} onClick={() => signIn('github', { callbackUrl: '/dashboard' })}>
                                <svg width="18" height="18" fill="currentColor">
                                    <path d="M9 0C4.029 0 0 4.029 0 9c0 3.975 2.579 7.345 6.154 8.534.45.082.615-.195.615-.433 0-.213-.008-.777-.012-1.526-2.504.544-3.033-1.207-3.033-1.207-.409-1.039-1-1.315-1-1.315-.817-.559.062-.547.062-.547.903.063 1.378.927 1.378.927.803 1.376 2.107.978 2.62.748.082-.582.314-.978.572-1.203-2-.227-4.103-1-4.103-4.449 0-.983.351-1.786.927-2.416-.093-.228-.402-1.144.088-2.383 0 0 .756-.242 2.475.923a8.615 8.615 0 012.25-.303c.764.004 1.533.103 2.25.303 1.718-1.165 2.475-.923 2.475-.923.49 1.239.18 2.155.088 2.383.576.63.927 1.433.927 2.416 0 3.458-2.107 4.218-4.113 4.441.323.279.612.828.612 1.669 0 1.205-.011 2.176-.011 2.471 0 .24.163.52.619.432C15.424 16.342 18 12.973 18 9c0-4.971-4.029-9-9-9z" />
                                </svg>
                                Continue with GitHub
                            </Button>
                        )}
                    </>
                )}
            </form>

            <p style={{ marginTop: 'var(--space-8)', textAlign: 'center', fontSize: '14px', color: 'var(--gray-400)' }}>
                Don't have an account?{' '}
                <Link href="/signup" style={{ color: 'var(--blue-light)', textDecoration: 'none', fontWeight: '500' }}>
                    Sign up
                </Link>
            </p>
        </div>
    );
}
