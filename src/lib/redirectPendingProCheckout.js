import { startProCheckout } from './billingApi.js';
import {
  clearPendingProCheckout,
  persistPendingProCheckout,
  resolvePendingProCheckout,
} from './pendingCheckout.js';
import { supabase } from './supabaseClient.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAccessToken(maxMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      if (!expiresAt || expiresAt - Date.now() > 15_000) {
        return session.access_token;
      }
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      if (refreshed?.access_token) return refreshed.access_token;
    }
    await delay(250);
  }
  return null;
}

async function userAlreadyPro(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.plan === 'pro';
}

const CHECKOUT_ATTEMPT_GAP_MS = 4000;
const CHECKOUT_ATTEMPT_KEY = 'fn_pro_checkout_last_attempt';

/** @type {Promise<{ redirected: boolean, pending: boolean, error?: string }> | null} */
let redirectInFlight = null;

function recentCheckoutAttempt() {
  const ts = Number(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || 0);
  return Date.now() - ts < CHECKOUT_ATTEMPT_GAP_MS;
}

function markCheckoutAttempt() {
  sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, String(Date.now()));
}

/**
 * If user signed up for Pro, send them to Stripe Checkout once authenticated.
 * @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [user]
 * @returns {Promise<{ redirected: boolean, pending: boolean, error?: string }>}
 */
export async function tryRedirectPendingProCheckout(user) {
  if (redirectInFlight) {
    return redirectInFlight;
  }

  redirectInFlight = executePendingProCheckout(user).finally(() => {
    redirectInFlight = null;
  });

  return redirectInFlight;
}

/**
 * @param {{ user_metadata?: Record<string, unknown> } | null | undefined} [user]
 */
async function executePendingProCheckout(user) {
  let sessionUser = user;
  if (!sessionUser) {
    const { data: { session } } = await supabase.auth.getSession();
    sessionUser = session?.user ?? null;
  }

  const pending = resolvePendingProCheckout(sessionUser);
  if (!pending) {
    return { redirected: false, pending: false };
  }

  if (recentCheckoutAttempt()) {
    return { redirected: false, pending: true };
  }

  persistPendingProCheckout(pending);

  const userId = sessionUser?.id;
  if (userId && await userAlreadyPro(userId)) {
    clearPendingProCheckout();
    return { redirected: false, pending: false };
  }

  try {
    const accessToken = await waitForAccessToken();
    if (!accessToken) {
      return {
        redirected: false,
        pending: true,
        error: 'Session not ready — try signing in again.',
      };
    }

    markCheckoutAttempt();
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
