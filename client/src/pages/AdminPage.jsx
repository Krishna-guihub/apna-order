import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  QrCode,
  ScrollText,
  Settings,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import StaffShell from '../components/StaffShell.jsx';
import AdminOverview from '../components/admin/AdminOverview.jsx';
import AdminMenu from '../components/admin/AdminMenu.jsx';
import AdminTables from '../components/admin/AdminTables.jsx';
import AdminOrders from '../components/admin/AdminOrders.jsx';
import AdminPayments from '../components/admin/AdminPayments.jsx';
import AdminSettings from '../components/admin/AdminSettings.jsx';
import AdminAudit from '../components/admin/AdminAudit.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { classNames } from '../utils/format.js';

const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    hint: 'Sales pulse',
    component: AdminOverview,
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: UtensilsCrossed,
    hint: 'Dishes & prices',
    component: AdminMenu,
  },
  {
    id: 'tables',
    label: 'Tables & QR',
    icon: QrCode,
    hint: 'Floor tokens',
    component: AdminTables,
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ClipboardList,
    hint: 'Ledger & discounts',
    component: AdminOrders,
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    hint: 'Refunds & reconciliation',
    component: AdminPayments,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    hint: 'Tax & WhatsApp',
    component: AdminSettings,
  },
  {
    id: 'audit',
    label: 'Audit log',
    icon: ScrollText,
    hint: 'Accountability',
    component: AdminAudit,
  },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeTab = TABS.find((tab) => tab.id === requested) || TABS[0];

  const navigate = (tabId) => {
    const next = tabId === 'overview' ? '' : tabId;
    setSearchParams(next ? { tab: next } : {}, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ActiveSection = useMemo(() => activeTab.component, [activeTab]);

  return (
    <StaffShell active="admin">
      <div className="shell staff-page admin-page">
        <div className="admin-hero">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={14} /> Administrator console
            </span>
            <h1>Welcome back, {user?.name?.split(' ')[0] || 'Administrator'}.</h1>
            <p className="staff-lead">
              Manage the menu, secure table codes, the order ledger and every verified settlement from
              one calm workspace.
            </p>
          </div>
          <div className="admin-hero-mode">
            <span className="live-pill">
              <span className="pulse-dot" /> Role: admin
            </span>
            <a href="/kitchen" className="btn btn-outline btn-sm">
              Kitchen board
            </a>
          </div>
        </div>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <nav className="admin-nav" aria-label="Admin sections">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab.id === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    className={classNames('admin-nav-item', active && 'active')}
                    onClick={() => navigate(tab.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="admin-nav-icon">
                      <Icon size={18} />
                    </span>
                    <span className="admin-nav-copy">
                      <strong>{tab.label}</strong>
                      <small>{tab.hint}</small>
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="admin-sidebar-note">
              <ShieldCheck size={16} />
              <p>
                Every mutation is role-checked, validated and written to the audit log. Payment secrets
                stay in the server environment.
              </p>
            </div>
          </aside>

          <div className="admin-content">
            <ActiveSection onNavigate={navigate} />
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
