import { startProCheckout } from './billingApi.js';
import { clearPendingProCheckout, readPendingProCheckout } from './pendingCheckout.js';
import { usePlanStore } from '../stores/planStore.js';

/**
 * If user signed up for Pro, send them to Stripe Checkout once authenticated.
 * @returns {Promise<boolean>} true when navigating away to Stripe
 */
export async function tryRedirectPendingProCheckout() {
  const pending = readPendingProCheckout();
  if (!pending) return false;

  await usePlanStore.getState().fetchProfile();
  const { profile } = usePlanStore.getState();
  if (profile.plan === 'pro') {
    clearPendingProCheckout();
    return false;
  }

  try {
    const { url } = await startProCheckout(pending.billing);
    if (!url) return false;
    clearPendingProCheckout();
    window.location.href = url;
    return true;
  } catch (err) {
    console.error('Pending Pro checkout failed:', err);
    return false;
  }
}
