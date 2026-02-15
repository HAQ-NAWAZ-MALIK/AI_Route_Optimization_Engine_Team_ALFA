/**
 * API Keys Management Page
 * List, create, and revoke API keys
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateKeyModal } from '@/components/portal/api-keys/create-key-modal';
import { ApiKeyDisplay } from '@/components/portal/api-keys/key-display';

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    permissions: string[];
    lastUsedAt: string | null;
    createdAt: string;
}

export default function ApiKeysPage() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);

    const fetchKeys = async () => {
        try {
            const response = await fetch('/api/portal/keys');
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

    const handleCreateSuccess = (key: string) => {
        setNewApiKey(key);
        setShowCreateModal(false);
        fetchKeys();
    };

    const handleRevoke = async (keyId: string) => {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
            return;
        }

        try {
            await fetch(`/api/portal/keys/${keyId}`, {
                method: 'DELETE',
            });
            fetchKeys();
        } catch (error) {
            console.error('Failed to revoke key:', error);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">API Keys</h1>
                        <p className="page-description">
                            Manage your API keys for accessing the RouteOptimizer API
                        </p>
                    </div>
                    <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        + Create New Key
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="card">
                    <p style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--gray-500)' }}>
                        Loading API keys...
                    </p>
                </div>
            ) : keys.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <svg width="80" height="80" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="40" cy="40" r="30" />
                            <path d="M40 20a20 20 0 0120 20M23 33l14 14 20-20" />
                        </svg>
                    </div>
                    <h3 className="empty-state-title">No API keys yet</h3>
                    <p className="empty-state-description">
                        Create your first API key to start using the RouteOptimizer API
                    </p>
                    <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        Create Your First Key
                    </Button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {keys.map((key) => (
                        <div key={key.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--white)' }}>
                                            {key.name}
                                        </h3>
                                        <Badge variant="neutral">
                                            {key.prefix}...
                                        </Badge>
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: 'var(--space-1)' }}>
                                                Created
                                            </p>
                                            <p style={{ fontSize: '13px', color: 'var(--gray-300)' }}>
                                                {new Date(key.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: 'var(--space-1)' }}>
                                                Last Used
                                            </p>
                                            <p style={{ fontSize: '13px', color: 'var(--gray-300)' }}>
                                                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {key.permissions.map(perm => (
                                            <Badge key={perm} variant="info" style={{ fontSize: '11px' }}>
                                                {perm}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <Button variant="danger" size="sm" onClick={() => handleRevoke(key.id)}>
                                    Revoke
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateKeyModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleCreateSuccess}
            />

            {newApiKey && (
                <ApiKeyDisplay
                    apiKey={newApiKey}
                    onClose={() => setNewApiKey(null)}
                />
            )}
        </div>
    );
}
