/**
 * Create API Key Modal
 * Form to create a new API key
 */

'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (key: string) => void;
}

export function CreateKeyModal({ isOpen, onClose, onSuccess }: CreateKeyModalProps) {
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<string[]>(['route:read', 'route:optimize']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const availablePermissions = [
        { id: 'route:read', label: 'Read Routes' },
        { id: 'route:optimize', label: 'Optimize Routes' },
        { id: 'cluster:optimize', label: 'Multi-Cluster Optimization' },
        { id: 'matrix:calculate', label: 'Distance Matrix' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/portal/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, permissions }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to create API key');
            } else {
                onSuccess(data.key);
                setName('');
                setPermissions(['route:read', 'route:optimize']);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const togglePermission = (perm: string) => {
        setPermissions(prev =>
            prev.includes(perm)
                ? prev.filter(p => p !== perm)
                : [...prev, perm]
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create API Key">
            <form onSubmit={handleSubmit}>
                <Input
                    id="key-name"
                    label="Key Name"
                    placeholder="Production API Key"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    helper="A friendly name to identify this key"
                    required
                />

                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <label className="input-label">Permissions</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {availablePermissions.map(perm => (
                            <label
                                key={perm.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    padding: 'var(--space-3)',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={permissions.includes(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                />
                                <span style={{ fontSize: '14px', color: 'var(--white)' }}>
                                    {perm.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {error && (
                    <p style={{ color: 'var(--red)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
                        {error}
                    </p>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isLoading} style={{ flex: 1 }}>
                        Create Key
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
