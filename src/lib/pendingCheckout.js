/** Persists Pro checkout intent across email confirm → sign-in. */
export const PENDING_PRO_CHECKOUT_KEY = 'fn_pending_pro_checkout';
export const PENDING_PRO_CHECKOUT_SKIPPED_KEY = 'fn_pro_checkout_skipped';
export const PENDING_PRO_CHECKOUT_PAUSE_KEY = 'fn_pro_checkout_pause_auto_redirect';

/** @typedef {{ plan: 'pro', billing: 'monthly' | 'annual' }} PendingProCheckout */

/** @returns {PendingProCheckout | null} */
export function readPendingProCheckout() {
  try {
    const raw = sessionStorage.getItem(PENDING_PRO_CHECKOUT_KEY)
      || localStorage.getItem(PENDING_PRO_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.plan !== 'pro') return null;
    const billing = parsed.billing === 'annual' ? 'annual' : 'monthly';
    return { plan: 'pro', billing };
  } catch {
    return null;
  }
}

/**
 * Local storage + signup metadata (survives email confirm in another tab/device).
 * @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [user]
 * @returns {PendingProCheckout | null}
 */
export function resolvePendingProCheckout(user) {
  if (localStorage.getItem(PENDING_PRO_CHECKOUT_SKIPPED_KEY) === '1') {
    return null;
  }

  const stored = readPendingProCheckout();
  if (stored) return stored;

  const meta = user?.user_metadata;
  if (meta?.plan !== 'pro') return null;

  const billing = meta.billing === 'annual' ? 'annual' : 'monthly';
  return { plan: 'pro', billing };
}

/**
 * @param {'monthly' | 'annual' | null | undefined} [billing]
 */
export function markPendingProCheckout(billing) {
  localStorage.removeItem(PENDING_PRO_CHECKOUT_SKIPPED_KEY);
  const payload = {
    plan: 'pro',
    billing: billing === 'annual' ? 'annual' : 'monthly',
  };
  sessionStorage.setItem(PENDING_PRO_CHECKOUT_KEY, JSON.stringify(payload));
  localStorage.setItem(PENDING_PRO_CHECKOUT_KEY, JSON.stringify(payload));
}

/** @param {PendingProCheckout} pending */
export function persistPendingProCheckout(pending) {
  markPendingProCheckout(pending.billing);
}

export function clearPendingProCheckout() {
  sessionStorage.removeItem(PENDING_PRO_CHECKOUT_KEY);
  localStorage.removeItem(PENDING_PRO_CHECKOUT_KEY);
}

/** User chose Starter — do not auto-redirect to Stripe again. */
export function skipPendingProCheckout() {
  clearPendingProCheckout();
  clearAutoProCheckoutRedirectPause();
  localStorage.setItem(PENDING_PRO_CHECKOUT_SKIPPED_KEY, '1');
}

/** After Stripe cancel — hold auto-redirect until user picks an option in the modal. */
export function pauseAutoProCheckoutRedirect() {
  sessionStorage.setItem(PENDING_PRO_CHECKOUT_PAUSE_KEY, '1');
}

export function clearAutoProCheckoutRedirectPause() {
  sessionStorage.removeItem(PENDING_PRO_CHECKOUT_PAUSE_KEY);
}

export function isAutoProCheckoutRedirectPaused() {
  return sessionStorage.getItem(PENDING_PRO_CHECKOUT_PAUSE_KEY) === '1';
}

/**
 * @param {string | null | undefined} planId
 * @param {string | null | undefined} billing
 */
export function syncPendingProCheckoutFromParams(planId, billing) {
  if (planId === 'pro') {
    markPendingProCheckout(billing);
  }
}

/**
 * Query string for email confirmation redirect (keeps plan intent on /login).
 * @param {string | null | undefined} planId
 * @param {string | null | undefined} billing
 */
export function buildCheckoutLoginQuery(planId, billing) {
  if (planId !== 'pro') return '';
  const params = new URLSearchParams({ plan: 'pro' });
  if (billing === 'annual') params.set('billing', 'annual');
  return params.toString();
}

/** @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [user] */
export function hasPendingProCheckout(user) {
  return Boolean(resolvePendingProCheckout(user));
}
