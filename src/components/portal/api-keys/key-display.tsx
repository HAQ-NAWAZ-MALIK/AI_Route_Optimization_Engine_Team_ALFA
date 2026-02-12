/**
 * API Key Display Component
 * Shows the full API key once (copy to clipboard)
 */

'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface ApiKeyDisplayProps {
    apiKey: string;
    onClose: () => void;
}

export function ApiKeyDisplay({ apiKey, onClose }: ApiKeyDisplayProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="API Key Created">
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <p style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-4)' }}>
                    Please copy your API key now. For security reasons, you won't be able to see it again.
                </p>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    wordBreak: 'break-all',
                    marginBottom: 'var(--space-4)',
                }}>
                    {apiKey}
                </div>

                <Button variant="primary" onClick={handleCopy} style={{ width: '100%' }}>
                    {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                </Button>
            </div>

            <div style={{
                background: 'rgba(255, 159, 10, 0.1)',
                border: '1px solid rgba(255, 159, 10, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
            }}>
                <p style={{ fontSize: '13px', color: 'var(--orange)' }}>
                    ⚠️ Store this key securely. It provides access to your account.
                </p>
            </div>

            <Button variant="ghost" onClick={onClose} style={{ width: '100%' }}>
                I've Saved My Key
            </Button>
        </Modal>
    );
}
