/**
 * User Management Page
 * Admin interface with clean, professional UI for user management
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
    emailVerified: string | null;
    _count: {
        apiKeys: number;
        usageLogs: number;
    };
    subscriptions: Array<{
        plan: string;
        status: string;
    }>;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showActionsModal, setShowActionsModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [selectedRole, setSelectedRole] = useState<'USER' | 'ADMIN'>('USER');
    const [selectedPlan, setSelectedPlan] = useState('PRO');
    const [planReason, setPlanReason] = useState('');

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/admin/users');
            const data = await response.json();
            setUsers(data.users || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleChangeRole = async () => {
        if (!selectedUser) return;

        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: selectedRole }),
            });

            if (response.ok) {
                alert('Role changed successfully!');
                fetchUsers();
                setShowRoleModal(false);
                setShowActionsModal(false);
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to change role');
            }
        } catch (error) {
            console.error('Failed to change role:', error);
            alert('Failed to change role');
        }
    };

    const handleSuspend = async (suspend: boolean) => {
        if (!selectedUser) return;

        if (suspend && suspendReason.length < 10) {
            alert('Please provide a reason (at least 10 characters)');
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}/suspend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    suspended: suspend,
                    reason: suspend ? suspendReason : undefined,
                }),
            });

            if (response.ok) {
                alert(suspend ? 'User suspended successfully!' : 'User activated successfully!');
                fetchUsers();
                setShowSuspendModal(false);
                setShowActionsModal(false);
                setSuspendReason('');
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to update user');
            }
        } catch (error) {
            console.error('Failed to suspend user:', error);
            alert('Failed to update user');
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;

        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                alert('User deleted successfully!');
                fetchUsers();
                setShowDeleteModal(false);
                setShowActionsModal(false);
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user');
        }
    };

    const handleSetPlan = async () => {
        if (!selectedUser) return;

        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}/subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: selectedPlan, reason: planReason || undefined }),
            });

            if (response.ok) {
                alert(`User plan set to ${selectedPlan}!`);
                fetchUsers();
                setShowPlanModal(false);
                setShowActionsModal(false);
                setPlanReason('');
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to set plan');
            }
        } catch (error) {
            console.error('Failed to set plan:', error);
            alert('Failed to set plan');
        }
    };

    return (
        <div style={{ padding: 'var(--space-6)' }}>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h1 className="page-title">User Management</h1>
                        <p className="page-description">View and manage all platform users</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <Input
                    id="search"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Users Table */}
            <div className="card">
                <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title">All Users ({filteredUsers.length})</h3>
                </div>

                {isLoading ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        Loading users...
                    </p>
                ) : filteredUsers.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-500)' }}>
                        No users found
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Subscription</th>
                                    <th>API Keys</th>
                                    <th>Requests</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: '500', color: 'var(--white)' }}>
                                                    {user.name || 'N/A'}
                                                </div>
                                                {user.emailVerified && (
                                                    <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '2px' }}>
                                                        ✓ Verified
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '13px' }}>{user.email}</td>
                                        <td>
                                            <Badge variant={user.role === 'ADMIN' ? 'warning' : 'neutral'}>
                                                {user.role}
                                            </Badge>
                                        </td>
                                        <td>
                                            {user.subscriptions[0] ? (
                                                <Badge
                                                    variant={
                                                        user.subscriptions[0].status === 'ACTIVE' ? 'success' : 'warning'
                                                    }
                                                >
                                                    {user.subscriptions[0].plan}
                                                </Badge>
                                            ) : (
                                                <span style={{ color: 'var(--gray-500)' }}>FREE</span>
                                            )}
                                        </td>
                                        <td>{user._count.apiKeys}</td>
                                        <td>{user._count.usageLogs.toLocaleString()}</td>
                                        <td style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setSelectedRole(user.role as 'USER' | 'ADMIN');
                                                    setShowActionsModal(true);
                                                }}
                                            >
                                                Manage
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* User Actions Modal */}
            {showActionsModal && selectedUser && (
                <Modal isOpen={showActionsModal} onClose={() => setShowActionsModal(false)} title="Manage User">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                            <div style={{ fontSize: '15px', color: 'var(--white)', fontWeight: '500', marginBottom: '4px' }}>
                                {selectedUser.name || 'N/A'}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                                {selectedUser.email}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>API Keys</div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--white)' }}>
                                    {selectedUser._count.apiKeys}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Requests</div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--white)' }}>
                                    {selectedUser._count.usageLogs.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                            <Button
                                variant="primary"
                                onClick={() => setShowRoleModal(true)}
                                style={{ width: '100%' }}
                            >
                                Change Role (Current: {selectedUser.role})
                            </Button>

                            <Button
                                variant="primary"
                                onClick={() => {
                                    setSelectedPlan(selectedUser.subscriptions[0]?.plan || 'PRO');
                                    setShowPlanModal(true);
                                }}
                                style={{ width: '100%' }}
                            >
                                Upgrade Plan ({selectedUser.subscriptions[0]?.plan || 'FREE'})
                            </Button>

                            <Button
                                variant="warning"
                                onClick={() => setShowSuspendModal(true)}
                                style={{ width: '100%' }}
                            >
                                Suspend User
                            </Button>

                            <Button
                                variant="danger"
                                onClick={() => setShowDeleteModal(true)}
                                style={{ width: '100%' }}
                            >
                                Delete User
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Change Role Modal */}
            {showRoleModal && selectedUser && (
                <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} title="Change User Role">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                            Change role for <strong>{selectedUser.email}</strong>
                        </p>

                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                New Role
                            </label>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as 'USER' | 'ADMIN')}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-2)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--white)',
                                    fontSize: '14px',
                                }}
                            >
                                <option value="USER">USER</option>
                                <option value="ADMIN">ADMIN</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <Button variant="ghost" onClick={() => setShowRoleModal(false)} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleChangeRole} style={{ flex: 1 }}>
                                Change Role
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Suspend User Modal */}
            {showSuspendModal && selectedUser && (
                <Modal isOpen={showSuspendModal} onClose={() => setShowSuspendModal(false)} title="Suspend User">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                            Suspend <strong>{selectedUser.email}</strong>? This will disable all their API keys.
                        </p>

                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                Reason (required, min 10 characters)
                            </label>
                            <textarea
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="Enter reason for suspension..."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: 'var(--space-2)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--white)',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button variant="ghost" onClick={() => setShowSuspendModal(false)} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button variant="warning" onClick={() => handleSuspend(true)} style={{ flex: 1 }}>
                                Suspend User
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete User Modal */}
            {showDeleteModal && selectedUser && (
                <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete User">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ padding: 'var(--space-3)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '14px', color: 'var(--red)', fontWeight: '500', marginBottom: 'var(--space-2)' }}>
                                Warning: This action cannot be undone!
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--gray-300)' }}>
                                Deleting <strong>{selectedUser.email}</strong> will permanently remove:
                                <ul style={{ marginTop: 'var(--space-2)', marginLeft: 'var(--space-4)' }}>
                                    <li>User account</li>
                                    <li>All API keys ({selectedUser._count.apiKeys})</li>
                                    <li>Usage logs ({selectedUser._count.usageLogs.toLocaleString()} requests)</li>
                                    <li>Subscription data</li>
                                </ul>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button variant="ghost" onClick={() => setShowDeleteModal(false)} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button variant="danger" onClick={handleDelete} style={{ flex: 1 }}>
                                Delete User
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Set Plan Modal */}
            {showPlanModal && selectedUser && (
                <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} title="Set User Plan">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                            Set plan for <strong>{selectedUser.email}</strong>
                        </p>

                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                New Plan
                            </label>
                            <select
                                value={selectedPlan}
                                onChange={(e) => setSelectedPlan(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-2)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--white)',
                                    fontSize: '14px',
                                }}
                            >
                                <option value="FREE">FREE</option>
                                <option value="TRIAL">TRIAL</option>
                                <option value="PRO">PRO</option>
                                <option value="ENTERPRISE">ENTERPRISE</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--gray-400)', display: 'block', marginBottom: 'var(--space-2)' }}>
                                Reason (optional)
                            </label>
                            <Input
                                id="plan-reason"
                                value={planReason}
                                onChange={(e) => setPlanReason(e.target.value)}
                                placeholder="e.g. Loyalty reward, Beta tester..."
                            />
                        </div>

                        <div style={{
                            padding: 'var(--space-3)',
                            background: 'rgba(16, 185, 129, 0.06)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px',
                            color: 'var(--gray-300)',
                        }}>
                            This will grant the user <strong>{selectedPlan}</strong> plan for free (no payment required). An audit log will be created.
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <Button variant="ghost" onClick={() => setShowPlanModal(false)} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleSetPlan} style={{ flex: 1 }}>
                                Set Plan
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
