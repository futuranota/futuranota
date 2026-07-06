/** Persists Pro checkout intent across email confirm → sign-in. */
export const PENDING_PRO_CHECKOUT_KEY = 'fn_pending_pro_checkout';

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
 * @param {'monthly' | 'annual' | null | undefined} [billing]
 */
export function markPendingProCheckout(billing) {
  const payload = {
    plan: 'pro',
    billing: billing === 'annual' ? 'annual' : 'monthly',
  };
  sessionStorage.setItem(PENDING_PRO_CHECKOUT_KEY, JSON.stringify(payload));
  localStorage.setItem(PENDING_PRO_CHECKOUT_KEY, JSON.stringify(payload));
}

export function clearPendingProCheckout() {
  sessionStorage.removeItem(PENDING_PRO_CHECKOUT_KEY);
  localStorage.removeItem(PENDING_PRO_CHECKOUT_KEY);
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
