import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  ChefHat,
  CheckCircle2,
  CreditCard,
  Leaf,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import SiteHeader from '../components/SiteHeader.jsx';
import { Brand, EmptyState, Spinner } from '../components/ui.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const features = [
  {
    icon: QrCode,
    title: 'Table-aware menu',
    copy: 'Every table has its own secure QR token. No app install, no table confusion.',
  },
  {
    icon: ChefHat,
    title: 'Live kitchen flow',
    copy: 'Orders move from placed to preparing, ready and served on a live kitchen board.',
  },
  {
    icon: CreditCard,
    title: 'Server-verified payments',
    copy: 'Amounts are calculated on the server. Razorpay signatures and captured status are checked before any bill is marked paid.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp, on your terms',
    copy: 'Prefilled kitchen and receipt messages open in WhatsApp. A person always reviews and presses Send.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devUnavailable, setDevUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get('/public/config'), api.get('/public/dev/tables')]).then(
      ([configResult, tableResult]) => {
        if (!active) return;
        if (configResult.status === 'fulfilled') setConfig(configResult.value);
        if (tableResult.status === 'fulfilled') {
          setTables(tableResult.value.tables || []);
        } else {
          setDevUnavailable(true);
        }
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const firstTable = tables.find((table) => table.isActive);
  const dashboardPath = user?.role === 'admin' ? '/admin' : '/kitchen';

  return (
    <div className="landing-page">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span className="pulse-dot" />
                Smart dine-in, warmly served
              </div>
              <h1>
                Scan. Savour.
                <br />
                <em>Settle.</em>
              </h1>
              <p className="hero-lead">
                A calm, connected dining experience for guests and a clear, live workflow for your
                kitchen. Order from the table, follow every plate, and pay with confidence.
              </p>
              <div className="hero-actions">
                {firstTable ? (
                  <Link to={`/t/${firstTable.token}`} className="btn btn-primary btn-lg">
                    Open demo menu <ArrowRight size={18} />
                  </Link>
                ) : (
                  <a href="#tables" className="btn btn-primary btn-lg">
                    Explore tables <ArrowRight size={18} />
                  </a>
                )}
                {user ? (
                  <Link to={dashboardPath} className="btn btn-outline btn-lg">
                    Open dashboard
                  </Link>
                ) : (
                  <Link to="/login" className="btn btn-outline btn-lg">
                    Staff portal
                  </Link>
                )}
              </div>
              <div className="hero-meta">
                <span>
                  <ShieldCheck size={15} /> Server-side pricing
                </span>
                <span>
                  <CreditCard size={15} />{' '}
                  {config?.paymentMode === 'razorpay' ? 'Razorpay test mode' : 'Safe payment simulation'}
                </span>
                <span>
                  <MessageCircle size={15} /> Manual WhatsApp send
                </span>
              </div>
            </div>

            <div className="hero-visual" aria-label="Apna Order preview">
              <div className="hero-photo">
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85"
                  alt="Warm restaurant dining room"
                />
                <div className="hero-photo-overlay" />
              </div>
              <div className="hero-card hero-card-table">
                <span className="hero-card-icon">
                  <QrCode size={19} />
                </span>
                <div>
                  <small>You are seated at</small>
                  <strong>Table 04 · Window</strong>
                </div>
                <span className="live-pill">Live</span>
              </div>
              <div className="hero-card hero-card-dish">
                <div className="mini-dish" aria-hidden="true">
                  <span />
                </div>
                <div>
                  <small>Guest favourite</small>
                  <strong>Butter Chicken</strong>
                  <span className="hero-card-price">₹445</span>
                </div>
              </div>
              <div className="hero-card hero-card-paid">
                <span className="paid-ring">
                  <CheckCircle2 size={17} />
                </span>
                <div>
                  <strong>Payment verified</strong>
                  <small>Captured by gateway, not by screenshot</small>
                </div>
              </div>
              <div className="hero-orbit hero-orbit-one" />
              <div className="hero-orbit hero-orbit-two" />
            </div>
          </div>
        </section>

        <section className="feature-ribbon" aria-label="System highlights">
          <div className="shell feature-ribbon-inner">
            <span>
              <Leaf size={16} /> Thoughtful vegetarian filters
            </span>
            <span>
              <BadgePercent size={16} /> Tax-aware itemised bills
            </span>
            <span>
              <UtensilsCrossed size={16} /> Kitchen live board
            </span>
            <span>
              <Sparkles size={16} /> Premium, mobile-first design
            </span>
          </div>
        </section>

        <section className="section how-section">
          <div className="shell">
            <div className="section-heading split-heading">
              <div>
                <span className="eyebrow">A quieter kind of service</span>
                <h2>From table to kitchen, without the friction.</h2>
              </div>
              <p>
                Built for a real dine-in workflow: secure table identity, one source of truth for
                prices, and payment verification that never trusts the browser.
              </p>
            </div>
            <div className="how-grid">
              <article className="how-card">
                <span className="how-number">01</span>
                <QrCode size={25} />
                <h3>Scan your table</h3>
                <p>The table token opens the right menu and verifies table identity with the API.</p>
              </article>
              <article className="how-card">
                <span className="how-number">02</span>
                <ChefHat size={25} />
                <h3>Send to the kitchen</h3>
                <p>Orders appear on the kitchen board with timers, notes, table numbers and status actions.</p>
              </article>
              <article className="how-card">
                <span className="how-number">03</span>
                <CreditCard size={25} />
                <h3>Pay and share</h3>
                <p>Pay through Razorpay test mode, then share an itemised receipt over WhatsApp manually.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section demo-section" id="tables">
          <div className="shell">
            <div className="section-heading split-heading">
              <div>
                <span className="eyebrow">Try the experience</span>
                <h2>Pick a demo table.</h2>
              </div>
              <p>
                In development, these shortcuts stand in for scanning a printed QR code. In a real
                restaurant, each link is encoded in a unique QR and validated by the server.
              </p>
            </div>

            {loading ? (
              <div className="loading-panel">
                <Spinner size={22} /> Preparing the dining room…
              </div>
            ) : tables.length > 0 ? (
              <div className="demo-table-grid">
                {tables.map((table) => (
                  <Link
                    to={`/t/${table.token}`}
                    className="demo-table-card"
                    key={table.id}
                    aria-disabled={!table.isActive}
                  >
                    <div className="table-card-top">
                      <span className="table-number">{String(table.tableNumber).padStart(2, '0')}</span>
                      <QrCode size={19} />
                    </div>
                    <div>
                      <strong>Table {table.tableNumber}</strong>
                      <small>{table.label || 'Dining room'}</small>
                    </div>
                    <span className="table-card-link">
                      Open menu <ArrowRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={QrCode}
                title="Demo table links are unavailable"
                message={
                  devUnavailable
                    ? 'Development table tools are disabled. Sign in as an admin to view and print table QR codes.'
                    : 'Seed the database to create demo tables.'
                }
                action={
                  <Link to="/login" className="btn btn-outline">
                    Staff sign in
                  </Link>
                }
              />
            )}

            {config?.simulatedPayments && (
              <div className="mode-note">
                <ShieldCheck size={17} />
                <span>
                  <strong>Local payment simulation is active.</strong> It is clearly labelled
                  throughout the app and moves no money. For real test-gateway verification, set
                  <code>PAYMENT_MODE=razorpay</code> and add Razorpay test credentials in <code>.env</code>.
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="section feature-section">
          <div className="shell">
            <div className="section-heading">
              <span className="eyebrow">Built with care</span>
              <h2>Everything a modern dining room needs.</h2>
            </div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, copy }) => (
                <article className="feature-card" key={title}>
                  <span className="feature-icon">
                    <Icon size={21} />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section team-section">
          <div className="shell staff-entry-grid">
            <article className="staff-entry-card kitchen-entry">
              <span className="eyebrow">For the pass</span>
              <ChefHat size={30} />
              <h2>Kitchen dashboard</h2>
              <p>See incoming orders, timing, table numbers and advance each ticket through the kitchen.</p>
              <Link to="/kitchen" className="btn btn-cream">
                Open kitchen <ArrowRight size={16} />
              </Link>
            </article>
            <article className="staff-entry-card admin-entry">
              <span className="eyebrow">For the floor manager</span>
              <ShieldCheck size={30} />
              <h2>Admin console</h2>
              <p>Manage menu, pricing, availability, table QRs, payments, refunds and sales summaries.</p>
              <Link to="/admin" className="btn btn-cream">
                Open admin <ArrowRight size={16} />
              </Link>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div>
            <Brand light />
            <p className="footer-copy">
              A college mini project built as a real end-to-end restaurant flow — not a static
              mockup.
            </p>
          </div>
          <div className="footer-links">
            <strong>Explore</strong>
            <a href="/#tables">Demo tables</a>
            <Link to="/kitchen">Kitchen</Link>
            <Link to="/admin">Admin</Link>
          </div>
          <div className="footer-links">
            <strong>Safety notes</strong>
            <span>Payments are verified server-side</span>
            <span>WhatsApp sends are manual</span>
            <span>Simulation is disabled in production</span>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>© {new Date().getFullYear()} Apna Order. Built for a college AWP mini project.</span>
          <span>Designed for the table, the pass and the people in between.</span>
        </div>
      </footer>
    </div>
  );
}
