'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { User, UserRole } from '@shared/types';

const ALL_ROLES: UserRole[] = ['funder', 'owner', 'auditor', 'admin'];

const ROLE_COLORS: Record<UserRole, string> = {
  funder: 'bg-blue-100 text-blue-700',
  owner: 'bg-green-100 text-green-700',
  auditor: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
};

function UserManagementPage() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({ ...d.data(), userId: d.id } as User));
      setUsers(data);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userProfile) fetchUsers();
  }, [userProfile, fetchUsers]);

  const filteredUsers = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole, updatedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, role: newRole } : u)));
      showToast('success', `Role updated to ${newRole}`);
    } catch {
      showToast('error', 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleApprovalToggle(userId: string, currentApproval: boolean) {
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved: !currentApproval, updatedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, isApproved: !currentApproval } : u)));
      showToast('success', !currentApproval ? 'User approved' : 'Approval revoked');
    } catch {
      showToast('error', 'Failed to update approval status');
    } finally {
      setUpdatingId(null);
    }
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const roleCounts = ALL_ROLES.reduce((acc, role) => {
    acc[role] = users.filter((u) => u.role === role).length;
    return acc;
  }, {} as Record<UserRole, number>);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-foreground/60 mt-1">View and manage all platform users, roles, and approval status.</p>
        </div>

        {/* Role Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
              className={`rounded-xl border p-4 text-left transition-all ${roleFilter === role ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <p className="text-xs font-medium text-foreground/60 uppercase capitalize">{role}s</p>
              <p className="text-2xl font-bold text-foreground mt-1">{roleCounts[role]}</p>
            </button>
          ))}
        </div>

        {/* Filter indicator */}
        {roleFilter !== 'all' && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-foreground/60">Showing <strong className="capitalize">{roleFilter}s</strong> ({filteredUsers.length})</span>
            <button onClick={() => setRoleFilter('all')} className="text-sm text-primary-600 font-medium hover:underline">Clear filter</button>
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-6 w-16 bg-gray-200 rounded-full" />
                <div className="h-8 w-24 bg-gray-200 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchUsers} className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100">Retry</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-semibold text-foreground">No users found</p>
            <p className="text-sm text-foreground/60 mt-1">
              {roleFilter === 'all' ? 'No users have registered yet.' : `No ${roleFilter}s registered.`}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-foreground/70">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground/70">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground/70">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground/70">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground/70">Country</th>
                    <th className="text-right px-4 py-3 font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.userId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{user.name}</p>
                        {user.organizationName && (
                          <p className="text-xs text-foreground/50">{user.organizationName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground/70">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.userId, e.target.value as UserRole)}
                          disabled={updatingId === user.userId}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer ${ROLE_COLORS[user.role]} disabled:opacity-50`}
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {user.isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground/70">{user.country}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleApprovalToggle(user.userId, user.isApproved)}
                          disabled={updatingId === user.userId}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            user.isApproved
                              ? 'text-amber-700 border border-amber-300 hover:bg-amber-50'
                              : 'text-green-700 border border-green-300 hover:bg-green-50'
                          }`}
                        >
                          {user.isApproved ? 'Revoke' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <UserManagementPage />
    </ProtectedRoute>
  );
}
