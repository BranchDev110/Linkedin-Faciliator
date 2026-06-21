import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

function NavIcon({ name }: { name: 'dashboard' | 'profiles' | 'applications' }) {
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    profiles: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    applications: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  };
  return icons[name];
}

export default function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <div className="layout">
      <aside className="sidebar">
        <NavLink to="/dashboard" className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>
          <span>LI Facilitator</span>
        </NavLink>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            end
          >
            <NavIcon name="dashboard" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/profiles"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <NavIcon name="profiles" />
            <span>Profiles</span>
          </NavLink>
          <NavLink
            to="/applications"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <NavIcon name="applications" />
            <span>Applications</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email">{user?.email}</div>
              <div className="sidebar-user-label">Signed in</div>
            </div>
          </div>
          <button className="sidebar-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <main className="main-content">
          <div className="container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
