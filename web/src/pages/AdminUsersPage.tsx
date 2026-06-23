import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { AdminUserSummary, UserRole, UserStatus } from '../types';
import './AdminUsersPage.css';

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<AdminUserSummary[]>('/admin/users', { token });
      setUsers(data);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const updateStatus = async (userId: string, status: UserStatus) => {
    if (!token) return;
    setUpdatingId(userId);
    try {
      const updated = await apiRequest<AdminUserSummary>(`/admin/users/${userId}/status`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setUsers((current) => current.map((user) => (user.uid === userId ? updated : user)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setUpdatingId('');
    }
  };

  const updateRole = async (userId: string, role: UserRole) => {
    if (!token) return;
    setUpdatingId(userId);
    try {
      const updated = await apiRequest<AdminUserSummary>(`/admin/users/${userId}/role`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((user) => (user.uid === userId ? updated : user)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="admin-users-page">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Approve users and manage admin access</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void loadUsers()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {loading ? (
        <div className="dashboard-loading">Loading users...</div>
      ) : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Has Profile</th>
                <th>Applications</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid}>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${user.status}`}>{user.status}</span>
                  </td>
                  <td>{user.profileCount > 0 ? 'Yes' : 'No'}</td>
                  <td>{user.applicationCount}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="admin-users-actions">
                    {user.role === 'admin' ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={updatingId === user.uid}
                        onClick={() => void updateRole(user.uid, 'user')}
                      >
                        Make user
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={updatingId === user.uid}
                          onClick={() => void updateRole(user.uid, 'admin')}
                        >
                          Make admin
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={updatingId === user.uid || user.status === 'approved'}
                          onClick={() => void updateStatus(user.uid, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={updatingId === user.uid || user.status === 'rejected'}
                          onClick={() => void updateStatus(user.uid, 'rejected')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
