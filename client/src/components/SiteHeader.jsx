import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, LogIn, QrCode } from 'lucide-react';
import { Brand } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SiteHeader({ variant = 'default' }) {
  const { user } = useAuth();
  const dashboardHref = user?.role === 'admin' ? '/admin' : '/kitchen';

  return (
    <header className={`site-header site-header-${variant}`}>
      <div className="shell site-header-inner">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/#tables" className="site-nav-link">
            <QrCode size={16} /> Demo tables
          </a>
          <NavLink to="/kitchen" className="site-nav-link">
            Kitchen
          </NavLink>
          <NavLink to="/admin" className="site-nav-link">
            Admin
          </NavLink>
          {user ? (
            <Link to={dashboardHref} className="btn btn-primary btn-sm">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-outline btn-sm">
              <LogIn size={16} /> Staff sign in
            </Link>
          )}
          <Link to="/login" className="icon-button mobile-only" aria-label="Staff sign in">
            <ArrowRight size={18} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
