import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthSignupCard } from '../components/AuthSignupCard.jsx';
import { PATHS, authPath } from '../lib/paths.js';
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
import {
  buildCheckoutLoginQuery,
  hasPendingProCheckout,
  markPendingProCheckout,
  syncPendingProCheckoutFromParams,
} from '../../lib/pendingCheckout.js';
import { usePendingProCheckoutRedirect } from '../../lib/usePendingProCheckoutRedirect.js';
import { useI18n } from '../../i18n/useI18n.js';
import { MarkLoadingOverlay } from '../../components/shared/MarkLoading.jsx';
import '../styles/marketing.css';
import '../styles/sections.css';

export function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const onAuthPage = location.pathname === PATHS.login || location.pathname === PATHS.signup;
  const { checkoutError, redirecting, retryCheckout } = usePendingProCheckoutRedirect({
    enabled: onAuthPage,
  });

  const initial = location.pathname === PATHS.login || location.hash === '#signin' ? 'signin' : 'signup';
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
    syncPendingProCheckoutFromParams(planId, billing);
  }, [searchParams, planId, billing]);

  useEffect(() => {
    if (authLoading || !user || !onAuthPage) return;
    if (!hasPendingProCheckout(user)) {
      navigate(PATHS.app, { replace: true });
    }
  }, [authLoading, user, onAuthPage, navigate]);

  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  useEffect(() => {
    const onHash = () => setTab(location.hash === '#signin' ? 'signin' : 'signup');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [location.hash]);

  useEffect(() => {
    if (location.pathname === PATHS.login) {
      setTab('signin');
    } else if (location.pathname === PATHS.signup) {
      setTab('signup');
    }
  }, [location.pathname]);

  const signInHref = authPath('signin', {
    plan: planId || undefined,
    billing: billing || undefined,
  });
  const signUpHref = authPath(undefined, {
    plan: planId || undefined,
    billing: billing || undefined,
  });

  const go = (next) => {
    setSent(false);
    setErrorMessage(null);
    setTab(next);
    navigate(next === 'signin' ? signInHref : signUpHref, { replace: true });
  };

  const handleSubmit = async (form) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      if (tab === 'signup') {
        const checkoutQuery = buildCheckoutLoginQuery(selectedPlan?.id, billing);
        if (selectedPlan?.id === 'pro') {
          markPendingProCheckout(billing);
        }
        await signUp(form.email, form.password, {
          plan: selectedPlan?.id ?? 'free',
          ...(billing ? { billing } : {}),
        }, checkoutQuery);
        markPendingLibrary();
        setPendingEmail(form.email);
        setSent(true);
      } else {
        await signIn(form.email, form.password);
        clearPendingLibrary();
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
      if (tab === 'signup' && planId === 'pro') {
        markPendingProCheckout(billing);
      }
      await signInWithGoogle();
      // Navigation continues in Google — page unloads.
    } catch (err) {
      sessionStorage.removeItem(OAUTH_MODE_KEY);
      setErrorMessage(err.message);
      setLoading(false);
    }
  };

  const proAwaitingPayment = Boolean(user && hasPendingProCheckout(user));
  const awaitingStripe = proAwaitingPayment && redirecting;
  const formLoading = loading || awaitingStripe;
  const submitLoadingLabel = awaitingStripe
    ? t('proCheckoutAbandon.redirecting')
    : (loading
      ? (tab === 'signup' ? 'Creating account…' : 'Signing in…')
      : undefined);
  const showInbox = sent && !proAwaitingPayment;
  const checkoutErrorMessage = checkoutError && /too many/i.test(checkoutError)
    ? t('proCheckoutAbandon.rateLimited')
    : checkoutError;
  /** Session check, form submit, Google OAuth wait, or post-login redirect. */
  const showMarkGate = Boolean(
    formLoading
    || (authLoading && !showInbox)
    || (user && onAuthPage && !showInbox && !checkoutError),
  );
  const markGateLabel = submitLoadingLabel
    || (user && onAuthPage ? 'Opening Futura Nota…' : 'Loading…');

  return (
    <div className="auth-split-wrap" data-screen-label="welcome">
      <MarkLoadingOverlay open={showMarkGate} label={markGateLabel} />
      {showInbox ? (
        <div className="auth-split-success card">
          <span className="auth-done__mark"><span className="back-link__arrow" style={{ transform: 'none' }}>✓</span></span>
          <h2 className="h2">Check your inbox.</h2>
          <p className="muted" style={{ fontSize: 15 }}>
            We sent a confirmation link to {pendingEmail || 'your email'}. Click it to activate your account, then sign in
            {selectedPlan?.id === 'pro' ? ' to complete Pro payment with your card.' : '.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => go('signin')}>
            Sign in <span className="arrow">→</span>
          </button>
        </div>
      ) : (
        <AuthSignupCard
          mode={tab}
          onModeChange={go}
          onSubmit={handleSubmit}
          onGoogleSignIn={handleGoogleSignIn}
          loading={formLoading}
          loadingLabel={submitLoadingLabel}
          errorMessage={checkoutErrorMessage || errorMessage}
          onRetryCheckout={checkoutError ? retryCheckout : undefined}
          retryLabel={t('proCheckoutAbandon.tryAgain')}
          selectedPlan={selectedPlan}
        />
      )}
    </div>
  );
}
