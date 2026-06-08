import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthSignupCard } from '../components/AuthSignupCard.jsx';
import { PATHS } from '../lib/paths.js';
import { applyMarketingTheme } from '../lib/theme.js';
import '../styles/marketing.css';
import '../styles/sections.css';

export function WelcomePage() {
  const initial = typeof location !== 'undefined' && location.hash === '#signin' ? 'signin' : 'signup';
  const [tab, setTab] = useState(initial);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  useEffect(() => {
    const onHash = () => setTab(location.hash === '#signin' ? 'signin' : 'signup');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next) => {
    setSent(false);
    setTab(next);
    if (history.replaceState) {
      history.replaceState(null, '', next === 'signin' ? '#signin' : PATHS.welcome);
    }
  };

  return (
    <div className="auth-split-wrap" data-screen-label="welcome">
      {sent ? (
        <div className="auth-split-success card">
          <span className="auth-done__mark"><span className="back-link__arrow" style={{ transform: 'none' }}>✓</span></span>
          <h2 className="h2">{tab === 'signup' ? 'Account ready to go.' : "You're signed in."}</h2>
          <p className="muted" style={{ fontSize: 15 }}>
            This is a prototype — no account was actually created. Wire it to your auth backend to make it live.
          </p>
          <Link to={PATHS.app} className="btn btn-primary">
            Enter Futura <span className="arrow">→</span>
          </Link>
        </div>
      ) : (
        <AuthSignupCard
          mode={tab}
          onModeChange={go}
          onSubmitSuccess={() => setSent(true)}
        />
      )}
    </div>
  );
}
