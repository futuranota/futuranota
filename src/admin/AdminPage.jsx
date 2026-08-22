import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { applyMarketingTheme } from '../marketing/lib/theme.js';
import { SignalsAdminPanel } from './SignalsAdminPanel.jsx';
import { CampaignDetectorAdminPanel } from './CampaignDetectorAdminPanel.jsx';
import { HorizonScanAdminPanel } from './HorizonScanAdminPanel.jsx';
import { HorizonKitsAdminPanel } from './HorizonKitsAdminPanel.jsx';
import { ScanSourcesAdminPanel } from './ScanSourcesAdminPanel.jsx';
import { StepPlaybookSharesAdminPanel } from './StepPlaybookSharesAdminPanel.jsx';
import { ManagementAdminPanel } from './ManagementAdminPanel.jsx';
import {
  AdminSidebarNav,
  MANAGEMENT_SECTIONS,
  parseAdminNavSelection,
  resolveAdminNavActiveId,
} from './AdminSidebarNav.jsx';
import '../marketing/styles/marketing.css';
import '../marketing/styles/sections.css';
import './admin.css';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [tab, setTab] = useState('management');
  const [managementSection, setManagementSection] = useState(MANAGEMENT_SECTIONS.api);
  const [flashMessage, setFlashMessage] = useState(null);
  const [signalsRefreshToken, setSignalsRefreshToken] = useState(0);

  function handlePublishedToSignals(brandName) {
    setSignalsRefreshToken((n) => n + 1);
    setTab('signals');
    setFlashMessage(`${brandName} guardado y publicado en Signals.`);
  }

  function switchTab(nextTab, nextManagementSection) {
    setTab(nextTab);
    if (nextTab === 'management') {
      setManagementSection(nextManagementSection || MANAGEMENT_SECTIONS.api);
    }
    if (nextTab === 'signals') setSignalsRefreshToken((n) => n + 1);
    if (nextTab !== 'signals') setFlashMessage(null);
  }

  function handleNavSelect(navId) {
    const parsed = parseAdminNavSelection(navId);
    if (!parsed) return;
    switchTab(parsed.tab, parsed.managementSection);
  }

  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  const isAdmin = !!user && !!ADMIN_EMAIL && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      signOut();
      setErrorMessage('This account is not allowed to access /panel.');
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

  const activeNavId = resolveAdminNavActiveId(tab, managementSection);

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <span className="admin-topbar__brand">Futura Nota · Admin</span>
        <div className="admin-topbar__actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app')}>Go to dashboard</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>View site</button>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Log out</button>
        </div>
      </header>

      <div className="admin-body">
        <AdminSidebarNav activeId={activeNavId} onSelect={handleNavSelect} />

        <div className="admin-main">
          {flashMessage ? (
            <p className="muted" style={{ fontSize: 13, marginBottom: 12, color: 'var(--hud)' }}>
              {flashMessage}
            </p>
          ) : null}

          <main className="admin-content">
            <div className={`admin-panel-view${tab === 'signals' ? '' : ' is-hidden'}`}>
              <SignalsAdminPanel refreshToken={signalsRefreshToken} />
            </div>
            <div className={`admin-panel-view${tab === 'campaigns' ? '' : ' is-hidden'}`}>
              <CampaignDetectorAdminPanel onPublishedToSignals={handlePublishedToSignals} />
            </div>
            <div className={`admin-panel-view${tab === 'horizon-kits' ? '' : ' is-hidden'}`}>
              <HorizonKitsAdminPanel />
            </div>
            <div className={`admin-panel-view${tab === 'horizon' ? '' : ' is-hidden'}`}>
              <HorizonScanAdminPanel onPublishedToSignals={handlePublishedToSignals} />
            </div>
            <div className={`admin-panel-view${tab === 'sources' ? '' : ' is-hidden'}`}>
              <ScanSourcesAdminPanel />
            </div>
            <div className={`admin-panel-view${tab === 'step-shares' ? '' : ' is-hidden'}`}>
              <StepPlaybookSharesAdminPanel />
            </div>
            <div className={`admin-panel-view${tab === 'management' ? '' : ' is-hidden'}`}>
              <ManagementAdminPanel section={managementSection} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
