/**
 * Settings Page
 * User profile, security, and account settings
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile');

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'security', label: 'Security' },
        { id: 'notifications', label: 'Notifications' },
    ];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-description">Manage your account preferences</p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-8)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: 'var(--space-4) var(--space-6)',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: activeTab === tab.id ? 'var(--white)' : 'var(--gray-400)',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all var(--duration-fast) var(--ease-out)',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Profile Information</h3>

                    <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <Input
                            id="name"
                            label="Full Name"
                            placeholder="John Doe"
                            defaultValue="Test Admin"
                        />

                        <Input
                            id="email"
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            defaultValue="admin@test.com"
                        />

                        <Input
                            id="company"
                            label="Company (Optional)"
                            placeholder="Acme Inc."
                        />

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                            <Button type="submit" variant="primary">
                                Save Changes
                            </Button>
                            <Button type="button" variant="ghost">
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Change Password</h3>

                        <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <Input
                                id="current-password"
                                label="Current Password"
                                type="password"
                                placeholder="••••••••"
                            />

                            <Input
                                id="new-password"
                                label="New Password"
                                type="password"
                                placeholder="••••••••"
                            />

                            <Input
                                id="confirm-password"
                                label="Confirm New Password"
                                type="password"
                                placeholder="••••••••"
                            />

                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                                <Button type="submit" variant="primary">
                                    Update Password
                                </Button>
                                <Button type="button" variant="ghost">
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </div>

                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-2)' }}>Two-Factor Authentication</h3>
                        <p className="card-description" style={{ marginBottom: 'var(--space-6)' }}>
                            Add an extra layer of security to your account
                        </p>

                        <Button variant="secondary">
                            Enable 2FA
                        </Button>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Email Notifications</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {[
                            { id: 'usage-alerts', label: 'Usage alerts', description: 'Get notified when you reach 80% of your quota' },
                            { id: 'billing', label: 'Billing updates', description: 'Invoices, payment confirmations, and billing issues' },
                            { id: 'security', label: 'Security alerts', description: 'Unusual activity and security notifications' },
                            { id: 'product', label: 'Product updates', description: 'New features and product announcements' },
                        ].map((item) => (
                            <label
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-4)',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                }}
                            >
                                <input type="checkbox" defaultChecked style={{ marginTop: '3px' }} />
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--white)', marginBottom: 'var(--space-1)' }}>
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                        {item.description}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div style={{ marginTop: 'var(--space-6)' }}>
                        <Button variant="primary">
                            Save Preferences
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
