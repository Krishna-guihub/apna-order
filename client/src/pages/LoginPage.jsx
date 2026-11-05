import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Brand, InlineAlert, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { parseApiError } from '../utils/format.js';

const DEMO_ACCOUNTS = [
  {
    role: 'Administrator',
    email: 'admin@apnaorder.local',
    password: 'Admin@12345',
    icon: ShieldCheck,
  },
  {
    role: 'Kitchen staff',
    email: 'kitchen@apnaorder.local',
    password: 'Kitchen@12345',
    icon: ChefHat,
  },
];

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);

  const next = searchParams.get('next');

  useEffect(() => {
    api.get('/public/config').then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate(next || (user.role === 'admin' ? '/admin' : '/kitchen'), { replace: true });
    }
  }, [user, loading, navigate, next]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const signedIn = await login(email.trim(), password);
      addToast(`Welcome back, ${signedIn.name}.`, 'success');
      navigate(next || (signedIn.role === 'admin' ? '/admin' : '/kitchen'), { replace: true });
    } catch (loginError) {
      setError(parseApiError(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-visual">
        <Link to="/" className="login-back">
          <ArrowLeft size={17} /> Back to Apna Order
        </Link>
        <div className="login-visual-copy">
          <Brand light />
          <div className="login-quote">
            <span className="eyebrow">The pass, in one calm view</span>
            <h1>
              Your dining room,
              <br />
              <em>in rhythm.</em>
            </h1>
            <p>
              A focused workspace for the kitchen and the floor manager. Live orders, clear timers and
              verified settlements — without the noise.
            </p>
          </div>
          <div className="login-footer-note">
            <Sparkles size={16} />
            <span>Role-based access · HttpOnly session · Audited actions</span>
          </div>
        </div>
        <div className="login-image" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1200&q=85"
            alt=""
          />
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-form-card">
          <div className="login-form-head">
            <span className="eyebrow">Staff access</span>
            <h2>Welcome back.</h2>
            <p>Sign in with your restaurant account.</p>
          </div>

          {config && (
            <div className="login-mode-row">
              <span className={`mode-dot ${config.paymentMode === 'razorpay' ? 'live' : ''}`} />
              {config.paymentMode === 'razorpay'
                ? 'Razorpay test mode'
                : 'Simulated payment development mode'}
            </div>
          )}

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@restaurant.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
              {submitting ? <Spinner size={18} /> : <LockKeyhole size={17} />}
              {submitting ? 'Signing in…' : 'Sign in securely'}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="demo-accounts">
              <div className="demo-accounts-title">
                <Sparkles size={15} /> Development seed accounts
              </div>
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = account.icon;
                return (
                  <button
                    type="button"
                    key={account.email}
                    className="demo-account"
                    onClick={() => fillDemo(account)}
                  >
                    <span className="demo-account-icon">
                      <Icon size={17} />
                    </span>
                    <span>
                      <strong>{account.role}</strong>
                      <small>{account.email}</small>
                    </span>
                    <span className="demo-fill">Use</span>
                  </button>
                );
              })}
              <p>These defaults come from the development seed. Change them in `.env` for any shared environment.</p>
            </div>
          )}

          <InlineAlert tone="info" title="Security note">
            <p>
              Sessions use an httpOnly cookie and role checks on every protected API. Passwords are
              hashed and sign-in attempts are rate-limited.
            </p>
          </InlineAlert>

          <Link to="/" className="login-home-link">
            <ArrowLeft size={15} /> Customer site
          </Link>
        </div>
      </div>
    </div>
  );
}
