import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">⚡ SmartCollab</div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>🏠 Dashboard</NavLink>
          <NavLink to="/tasks">✅ Tasks</NavLink>
          <NavLink to="/integrations">🔌 Integrations</NavLink>
        </nav>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <span style={{ fontWeight: 600, color: 'var(--muted)' }}>
            {user?.email ?? ''}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge">{user?.role}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
