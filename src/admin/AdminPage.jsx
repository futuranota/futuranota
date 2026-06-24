import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { applyMarketingTheme } from '../marketing/lib/theme.js';
import { SignalsAdminPanel } from './SignalsAdminPanel.jsx';
import '../marketing/styles/marketing.css';
import '../marketing/styles/sections.css';
import './admin.css';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const TABS = [{ id: 'signals', label: 'Signals' }];

export function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [tab, setTab] = useState('signals');

  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  const isAdmin = !!user && !!ADMIN_EMAIL && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      signOut();
      setErrorMessage('This account is not allowed to access /admin.');
    }
  }, [loading, user, isAdmin]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoginLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <span className="mono-sm faint">Loading…</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="auth-split-wrap" data-screen-label="admin-login">
        <div className="auth-standalone-card card">
          <div className="auth-split-form__head">
            <h1 className="auth-split-form__title">Admin access</h1>
            <p className="auth-split-form__sub">Sign in with the admin account to manage Futura Nota.</p>
          </div>

          <form className="auth-split-form__fields" onSubmit={handleLogin}>
            <label className="auth-split-field" htmlFor="admin-email">
              <span className="auth-split-field__label">Email Address</span>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@futuranota.com"
                autoComplete="email"
                className="auth-split-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-split-field" htmlFor="admin-password">
              <span className="auth-split-field__label">Password</span>
              <input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="auth-split-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {errorMessage ? (
              <div style={{ fontSize: 12, color: 'var(--warm)', padding: '6px 10px', background: 'var(--warm-soft)', borderRadius: 6 }}>
                {errorMessage}
              </div>
            ) : null}

            <button type="submit" className="btn auth-split-submit" disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <span className="admin-topbar__brand">Futura Nota · Admin</span>
        <div className="admin-topbar__actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>View site</button>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Log out</button>
        </div>
      </header>

      <div className="admin-body">
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`admin-tabs__btn ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="admin-content">
          {tab === 'signals' ? <SignalsAdminPanel /> : null}
        </main>
      </div>
    </div>
  );
}
