import { supabase } from './supabaseClient.js';
import {
  clearPendingLibrary,
  markPendingLibrary,
  OAUTH_MODE_KEY,
  OAUTH_RETURN_REDIRECT_KEY,
} from './onboardingFlow.js';

const PRODUCTION_HOSTS = new Set(['futuranota.com', 'www.futuranota.com']);

/** Canonical site origin for auth redirects (OAuth, email links). */
export function getAppOrigin() {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return window.location.origin;
  }
  const fromEnv = (
    import.meta.env.VITE_APP_URL
    || import.meta.env.APP_URL
    || ''
  ).trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://www.futuranota.com';
}

/**
 * Supabase redirectTo — must match Supabase Auth → Redirect URLs exactly.
 * Uses /auth/callback (dedicated route) then the app sends users to /app.
 */
export function getOAuthRedirectUrl() {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (import.meta.env.DEV || hostname === 'localhost' || PRODUCTION_HOSTS.has(hostname)) {
      return `${origin}/auth/callback`;
    }
  }
  return `${getAppOrigin()}/auth/callback`;
}

/** @returns {URLSearchParams|null} */
function readHashParams() {
  if (typeof window === 'undefined' || !window.location.hash || window.location.hash === '#') {
    return null;
  }
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw || !raw.includes('=')) return null;
  return new URLSearchParams(raw);
}

/** True when the URL still carries OAuth return params (query or hash). */
export function hasOAuthReturnParams() {
  if (typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  if (search.get('code') || search.get('error') || search.get('error_description')) {
    return true;
  }
  const hash = readHashParams();
  if (!hash) return false;
  return Boolean(
    hash.get('access_token')
    || hash.get('code')
    || hash.get('error')
    || hash.get('error_description'),
  );
}

function stripOAuthParamsFromUrl() {
  const path = window.location.pathname;
  window.history.replaceState({}, '', path);
}

function applyOAuthOnboardingFlags() {
  const oauthMode = sessionStorage.getItem(OAUTH_MODE_KEY);
  if (!oauthMode) return;
  sessionStorage.removeItem(OAUTH_MODE_KEY);
  if (oauthMode === 'signup') markPendingLibrary();
  else clearPendingLibrary();
}

let oauthReturnPromise = null;

/**
 * Completes OAuth return (PKCE ?code= or implicit #access_token=).
 * Serialized so init + AuthCallbackPage (and StrictMode) share one exchange.
 * @returns {Promise<{ session: import('@supabase/supabase-js').Session | null, hadOAuthParams: boolean }>}
 */
export function resolveOAuthReturn() {
  if (!oauthReturnPromise) {
    oauthReturnPromise = resolveOAuthReturnImpl().finally(() => {
      oauthReturnPromise = null;
    });
  }
  return oauthReturnPromise;
}

async function resolveOAuthReturnImpl() {
  if (typeof window === 'undefined') {
    return { session: null, hadOAuthParams: false };
  }

  const hadOAuthParams = hasOAuthReturnParams();
  if (!hadOAuthParams) {
    const { data: { session } } = await supabase.auth.getSession();
    return { session, hadOAuthParams: false };
  }

  const search = new URLSearchParams(window.location.search);
  const hash = readHashParams();
  const code = search.get('code') || hash?.get('code');
  const accessToken = hash?.get('access_token');
  const authError = search.get('error_description') || search.get('error')
    || hash?.get('error_description') || hash?.get('error');

  if (authError) {
    stripOAuthParamsFromUrl();
    throw new Error(String(authError));
  }

  if (code) {
    let { data: { session: existing } } = await supabase.auth.getSession();
    if (!existing) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const { data: { session: recovered } } = await supabase.auth.getSession();
        if (!recovered) throw error;
      }
    }
    stripOAuthParamsFromUrl();
  } else if (accessToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: hash?.get('refresh_token') || '',
    });
    if (error) throw error;
    stripOAuthParamsFromUrl();
  } else {
    await new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          subscription.unsubscribe();
          resolve(session);
        }
      });
      window.setTimeout(() => {
        subscription.unsubscribe();
        resolve(null);
      }, 4000);
    });
    stripOAuthParamsFromUrl();
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    applyOAuthOnboardingFlags();
    const onApp = window.location.pathname === '/app'
      || window.location.pathname.startsWith('/app/');
    const onCallback = window.location.pathname === '/auth/callback';
    if (!onApp && !onCallback) {
      sessionStorage.setItem(OAUTH_RETURN_REDIRECT_KEY, '1');
    }
  }

  return { session, hadOAuthParams };
}

/** @returns {boolean} */
export function consumeOAuthDashboardRedirect() {
  if (typeof window === 'undefined') return false;
  const pending = sessionStorage.getItem(OAUTH_RETURN_REDIRECT_KEY) === '1';
  if (pending) sessionStorage.removeItem(OAUTH_RETURN_REDIRECT_KEY);
  return pending;
}

/**
 * Starts Google OAuth — always navigates to Google (never a silent local redirect).
 * @returns {Promise<void>}
 */
export async function startGoogleOAuth() {
  const redirectTo = getOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
  if (!data?.url) {
    throw new Error('No se pudo iniciar Google OAuth. Revisá Supabase → Authentication → Google.');
  }

  window.location.assign(data.url);
}
