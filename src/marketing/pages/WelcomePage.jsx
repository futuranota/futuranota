import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthSignupCard } from '../components/AuthSignupCard.jsx';
import { PATHS } from '../lib/paths.js';
import { applyMarketingTheme } from '../lib/theme.js';
import { useAuthStore } from '../../stores/authStore.js';
import '../styles/marketing.css';
import '../styles/sections.css';

export function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();

  const initial = location.pathname === '/login' || location.hash === '#signin' ? 'signin' : 'signup';
  const [tab, setTab] = useState(initial);
  const [sent, setSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

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
    setErrorMessage(null);
    setTab(next);
    if (history.replaceState) {
      history.replaceState(null, '', next === 'signin' ? PATHS.login : PATHS.signup);
    }
  };

  const handleSubmit = async (form) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      if (tab === 'signup') {
        await signUp(form.email, form.password, {
          first_name: form.firstName,
          last_name: form.lastName,
        });
        setPendingEmail(form.email);
        setSent(true);
      } else {
        await signIn(form.email, form.password);
        navigate(PATHS.app, { replace: true });
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="auth-split-wrap" data-screen-label="welcome">
      {sent ? (
        <div className="auth-split-success card">
          <span className="auth-done__mark"><span className="back-link__arrow" style={{ transform: 'none' }}>✓</span></span>
          <h2 className="h2">Check your inbox.</h2>
          <p className="muted" style={{ fontSize: 15 }}>
            We sent a confirmation link to {pendingEmail || 'your email'}. Click it to activate your account, then sign in.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => go('signin')}>
            Back to sign in <span className="arrow">→</span>
          </button>
        </div>
      ) : (
        <AuthSignupCard
          mode={tab}
          onModeChange={go}
          onSubmit={handleSubmit}
          onGoogleSignIn={handleGoogleSignIn}
          loading={loading}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
