import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthSignupCard } from '../components/AuthSignupCard.jsx';
import { PATHS } from '../lib/paths.js';
import { applyMarketingTheme } from '../lib/theme.js';
import { getHome } from '../lib/content.js';
import { PRICING_PLANS_DEFAULT } from '../lib/pricingDefaults.js';
import { useAuthStore } from '../../stores/authStore.js';
import {
  clearPendingLibrary,
  markPendingLibrary,
  OAUTH_MODE_KEY,
} from '../../lib/onboardingFlow.js';
import { captureReferralFromSearch } from '../../lib/referralStorage.js';
import '../styles/marketing.css';
import '../styles/sections.css';

export function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();

  const initial = location.pathname === '/login' || location.hash === '#signin' ? 'signin' : 'signup';
  const [tab, setTab] = useState(initial);
  const [sent, setSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const planId = searchParams.get('plan');
  const billing = searchParams.get('billing');

  const selectedPlan = useMemo(() => {
    if (!planId) return null;
    const plans = getHome().pricing?.plans?.length ? getHome().pricing.plans : PRICING_PLANS_DEFAULT;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return null;
    const isAnnual = billing === 'annual' && plan.annualPrice;
    const price = isAnnual ? plan.annualPrice : plan.price;
    const priceSuffix = isAnnual ? plan.annualPriceSuffix : plan.priceSuffix;
    return {
      id: plan.id,
      label: plan.shortName || plan.name,
      priceLabel: `$${price}${priceSuffix || ''}`,
    };
  }, [planId, billing]);

  useEffect(() => {
    captureReferralFromSearch(searchParams);
  }, [searchParams]);

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
      const base = next === 'signin' ? PATHS.login : PATHS.signup;
      history.replaceState(null, '', `${base}${location.search}`);
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
          plan: selectedPlan?.id ?? 'free',
          ...(billing ? { billing } : {}),
        });
        markPendingLibrary();
        setPendingEmail(form.email);
        setSent(true);
      } else {
        await signIn(form.email, form.password);
        clearPendingLibrary();
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
    setLoading(true);
    try {
      sessionStorage.setItem(OAUTH_MODE_KEY, tab);
      await signInWithGoogle();
      // Navigation continues in Google — page unloads.
    } catch (err) {
      sessionStorage.removeItem(OAUTH_MODE_KEY);
      setErrorMessage(err.message);
      setLoading(false);
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
          selectedPlan={selectedPlan}
        />
      )}
    </div>
  );
}
