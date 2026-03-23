/**
 * Admin API Keys Oversight
 * Monitor and manage all API keys across the platform
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    active: boolean;
    permissions: string[];
    lastUsedAt: string | null;
    createdAt: string;
    user: {
        email: string;
        name: string | null;
    };
    _count: {
        usageLogs: number;
    };
}

export default function AdminKeysPage() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('all');
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const fetchKeys = async () => {
        try {
            const response = await fetch('/api/admin/keys');
            const data = await response.json();
            setKeys(data.keys || []);
        } catch (error) {
            console.error('Failed to fetch keys:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleRevoke = async (keyId: string) => {
        if (!confirm('Revoke this API key? This action cannot be undone.')) return;

        setRevokingId(keyId);
        try {
            const res = await fetch(`/api/admin/keys/${keyId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                // Update UI immediately — mark this key as inactive
                setKeys(prev => prev.map(k => k.id === keyId ? { ...k, active: false } : k));
            } else {
                alert(data.error || 'Failed to revoke key');
            }
        } catch (error) {
            console.error('Failed to revoke key:', error);
            alert('Failed to revoke key — network error');
        } finally {
            setRevokingId(null);
        }
    };

    const filteredKeys = keys
        .filter(key => {
            if (filter === 'active') return key.active;
            if (filter === 'revoked') return !key.active;
            return true;
        })
        .filter(key =>
            key.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            key.prefix.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const activeCount = keys.filter(k => k.active).length;
    const revokedCount = keys.filter(k => !k.active).length;

    return (
        <div style={{ padding: 'var(--space-6)' }}>
            <div className="page-header">
                <h1 className="page-title">API Key Oversight</h1>
                <p className="page-description">Monitor and manage all platform API keys</p>
            </div>

            {/* Stats bar */}
            <div style={{
                display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
            }}>
                <div style={{
                    padding: 'var(--space-3) var(--space-5)',
                    background: 'rgba(48, 209, 88, 0.08)',
                    border: '1px solid rgba(48, 209, 88, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                }}>
                    <span style={{ color: '#30d158', fontWeight: 600 }}>{activeCount}</span>
                    <span style={{ color: 'var(--gray-400)', marginLeft: 6 }}>Active</span>
                </div>
                <div style={{
                    padding: 'var(--space-3) var(--space-5)',
                    background: 'rgba(255, 59, 48, 0.08)',
                    border: '1px solid rgba(255, 59, 48, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                }}>
                    <span style={{ color: '#ff3b30', fontWeight: 600 }}>{revokedCount}</span>
                    <span style={{ color: 'var(--gray-400)', marginLeft: 6 }}>Revoked</span>
                </div>
            </div>

            {/* Search + Filter */}
            <div style={{
                display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
                alignItems: 'flex-end',
            }}>
                <div style={{ flex: 1 }}>
                    <Input
                        id="search"
                        placeholder="Search by user email, key name, or prefix..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    {(['all', 'active', 'revoked'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '8px 14px',
                                fontSize: 12,
                                fontWeight: filter === f ? 600 : 400,
                                color: filter === f ? 'var(--white)' : 'var(--gray-400)',
                                background: filter === f ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                border: '1px solid',
                                borderColor: filter === f ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                transition: 'all 0.15s',
                            }}
                        >
                            {f} {f === 'all' ? `(${keys.length})` : f === 'active' ? `(${activeCount})` : `(${revokedCount})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Keys Table */}
            <div className="card">
                <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title">
                        {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Revoked'} API Keys ({filteredKeys.length})
                    </h3>
                </div>

                {isLoading ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        Loading API keys...
                    </p>
                ) : filteredKeys.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        No API keys found
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>User</th>
                                    <th>Key Name</th>
                                    <th>Prefix</th>
                                    <th>Permissions</th>
                                    <th>Requests</th>
                                    <th>Last Used</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredKeys.map((key) => (
                                    <tr key={key.id} style={{
                                        opacity: key.active ? 1 : 0.55,
                                        transition: 'opacity 0.3s',
                                    }}>
                                        <td>
                                            <Badge variant={key.active ? 'success' : 'error'} style={{ fontSize: '11px' }}>
                                                {key.active ? '● Active' : '● Revoked'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: '500', color: 'var(--white)', fontSize: '13px' }}>
                                                    {key.user.name || 'N/A'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                                                    {key.user.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{key.name}</td>
                                        <td>
                                            <Badge variant="neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                                {key.prefix}...
                                            </Badge>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                                {key.permissions.slice(0, 2).map((perm, i) => (
                                                    <Badge key={i} variant="info" style={{ fontSize: '10px' }}>
                                                        {perm}
                                                    </Badge>
                                                ))}
                                                {key.permissions.length > 2 && (
                                                    <Badge variant="neutral" style={{ fontSize: '10px' }}>
                                                        +{key.permissions.length - 2}
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td>{key._count.usageLogs.toLocaleString()}</td>
                                        <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                            {key.lastUsedAt
                                                ? new Date(key.lastUsedAt).toLocaleDateString()
                                                : 'Never'}
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                            {new Date(key.createdAt).toLocaleDateString()}
                                        </td>
                                        <td>
                                            {key.active ? (
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => handleRevoke(key.id)}
                                                    disabled={revokingId === key.id}
                                                >
                                                    {revokingId === key.id ? 'Revoking…' : 'Revoke'}
                                                </Button>
                                            ) : (
                                                <span style={{ fontSize: 12, color: 'var(--gray-500)', fontStyle: 'italic' }}>
                                                    Revoked
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
