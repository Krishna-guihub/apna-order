import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChefHat, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { Brand } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { initials } from '../utils/format.js';

export default function StaffShell({ active, children }) {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    addToast('Signed out securely.', 'info');
    navigate('/login');
  };

  return (
    <div className="staff-app">
      <header className="staff-header">
        <div className="shell staff-header-inner">
          <Brand compact={false} />
          <nav className="staff-nav" aria-label="Staff navigation">
            <NavLink
              to="/kitchen"
              className={({ isActive }) => `staff-nav-link ${isActive ? 'active' : ''}`}
              aria-current={active === 'kitchen' ? 'page' : undefined}
            >
              <ChefHat size={17} /> Kitchen
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `staff-nav-link ${isActive ? 'active' : ''}`}
                aria-current={active === 'admin' ? 'page' : undefined}
              >
                <LayoutDashboard size={17} /> Admin
              </NavLink>
            )}
          </nav>
          <div className="staff-user">
            <span className="avatar" aria-hidden="true">
              {initials(user?.name)}
            </span>
            <span className="staff-user-copy">
              <strong>{user?.name}</strong>
              <small>
                {user?.role === 'admin' ? <ShieldCheck size={12} /> : null}
                {user?.role === 'admin' ? 'Administrator' : 'Kitchen staff'}
              </small>
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="staff-main">{children}</main>
      <footer className="staff-footer">
        <div className="shell">
          <span>Apna Order · Dine-in operations</span>
          <Link to="/">Back to customer site</Link>
        </div>
      </footer>
    </div>
  );
}
