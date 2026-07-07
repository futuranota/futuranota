import { startProCheckout } from './billingApi.js';
import {
  clearPendingProCheckout,
  persistPendingProCheckout,
  resolvePendingProCheckout,
} from './pendingCheckout.js';
import { usePlanStore } from '../stores/planStore.js';
import { supabase } from './supabaseClient.js';

/**
 * If user signed up for Pro, send them to Stripe Checkout once authenticated.
 * @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [user]
 * @returns {Promise<{ redirected: boolean, pending: boolean, error?: string }>}
 */
export async function tryRedirectPendingProCheckout(user) {
  let sessionUser = user;
  if (!sessionUser) {
    const { data: { session } } = await supabase.auth.getSession();
    sessionUser = session?.user ?? null;
  }

  const pending = resolvePendingProCheckout(sessionUser);
  if (!pending) {
    return { redirected: false, pending: false };
  }

  persistPendingProCheckout(pending);

  await usePlanStore.getState().fetchProfile();
  const { profile } = usePlanStore.getState();
  if (profile.plan === 'pro') {
    clearPendingProCheckout();
    return { redirected: false, pending: false };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return {
        redirected: false,
        pending: true,
        error: 'Session not ready — try signing in again.',
      };
    }

    const { url } = await startProCheckout(pending.billing, { cancelReturn: 'app' });
    if (!url) {
      return {
        redirected: false,
        pending: true,
        error: 'Stripe checkout URL missing. Check billing configuration.',
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
    window.location.href = url;
    return { redirected: true, pending: true };
  } catch (err) {
    console.error('Pending Pro checkout failed:', err);
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return { redirected: false, pending: true, error: message };
  }
}
