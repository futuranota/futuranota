/** Persists Pro checkout intent across email confirm → sign-in. */
export const PENDING_PRO_CHECKOUT_KEY = 'fn_pending_pro_checkout';
export const PENDING_PRO_CHECKOUT_SKIPPED_KEY = 'fn_pro_checkout_skipped';
export const PENDING_PRO_CHECKOUT_PAUSE_KEY = 'fn_pro_checkout_pause_auto_redirect';

/** @typedef {{ plan: 'pro', billing: 'monthly' }} PendingProCheckout */

/** @returns {PendingProCheckout | null} */
export function readPendingProCheckout() {
  try {
    const raw = sessionStorage.getItem(PENDING_PRO_CHECKOUT_KEY)
      || localStorage.getItem(PENDING_PRO_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.plan !== 'pro') return null;
    return { plan: 'pro', billing: 'monthly' };
  } catch {
    return null;
  }
}

/**
 * Explicit Pro checkout only (storage). Signup metadata is not a pending payment:
 * `user_metadata.plan` stays "pro" and was sending every later sign-in through Stripe.
 * Email confirm still sets storage via `/login?plan=pro`.
 * @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [_user]
 * @returns {PendingProCheckout | null}
 */
export function resolvePendingProCheckout(_user) {
  if (localStorage.getItem(PENDING_PRO_CHECKOUT_SKIPPED_KEY) === '1') {
    return null;
  }

  return readPendingProCheckout();
}

/**
 * Pro is monthly-only. Billing arg kept for call-site compatibility.
 * @param {'monthly' | 'annual' | null | undefined} [_billing]
 */
export function markPendingProCheckout(_billing) {
  localStorage.removeItem(PENDING_PRO_CHECKOUT_SKIPPED_KEY);
  const payload = {
    plan: 'pro',
    billing: 'monthly',
  };
  sessionStorage.setItem(PENDING_PRO_CHECKOUT_KEY, JSON.stringify(payload));
  localStorage.setItem(PENDING_PRO_CHECKOUT_KEY, JSON.stringify(payload));
}

/** @param {PendingProCheckout} pending */
export function persistPendingProCheckout(pending) {
  markPendingProCheckout(pending?.billing);
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
 * @param {string | null | undefined} [_billing]
 */
export function syncPendingProCheckoutFromParams(planId, _billing) {
  if (planId === 'pro') {
    markPendingProCheckout('monthly');
  }
}

/**
 * Query string for email confirmation redirect (keeps plan intent on /login).
 * @param {string | null | undefined} planId
 * @param {string | null | undefined} [_billing]
 */
export function buildCheckoutLoginQuery(planId, _billing) {
  if (planId !== 'pro') return '';
  return new URLSearchParams({ plan: 'pro', billing: 'monthly' }).toString();
}

/** @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [user] */
export function hasPendingProCheckout(user) {
  return Boolean(resolvePendingProCheckout(user));
}
