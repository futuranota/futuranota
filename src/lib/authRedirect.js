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

const OAUTH_PENDING_KEY = 'fn_oauth_pending';

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
  const oauthPending = sessionStorage.getItem(OAUTH_PENDING_KEY) === '1';
  const search = new URLSearchParams(window.location.search);
  const hash = readHashParams();
  const authError = search.get('error_description') || search.get('error')
    || hash?.get('error_description') || hash?.get('error');

  if (authError) {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    stripOAuthParamsFromUrl();
    throw new Error(String(authError).replace(/\+/g, ' '));
  }

  // One redeem only: supabase-js initialize() consumes ?code= when
  // detectSessionInUrl is on. A second exchangeCodeForSession fails PKCE.
  const initResult = await supabase.auth.initialize();
  if (initResult?.error && (hadOAuthParams || oauthPending)) {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    stripOAuthParamsFromUrl();
    throw initResult.error;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error && (hadOAuthParams || oauthPending)) {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    throw error;
  }

  if (hadOAuthParams) stripOAuthParamsFromUrl();

  if (session) {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    applyOAuthOnboardingFlags();
    const onApp = window.location.pathname === '/app'
      || window.location.pathname.startsWith('/app/');
    const onCallback = window.location.pathname === '/auth/callback';
    if (!onApp && !onCallback && (hadOAuthParams || oauthPending)) {
      sessionStorage.setItem(OAUTH_RETURN_REDIRECT_KEY, '1');
    }
  }

  return { session, hadOAuthParams: hadOAuthParams || oauthPending };
}

/** @returns {boolean} */
export function consumeOAuthDashboardRedirect() {
  if (typeof window === 'undefined') return false;
  const pending = sessionStorage.getItem(OAUTH_RETURN_REDIRECT_KEY) === '1';
  if (pending) sessionStorage.removeItem(OAUTH_RETURN_REDIRECT_KEY);
  return pending;
}

/**
 * Starts OAuth for a Supabase social provider. Navigates away; page unloads.
 * @param {'google' | 'github' | 'discord'} provider
 * @returns {Promise<void>}
 */
export async function startOAuth(provider) {
  const redirectTo = getOAuthRedirectUrl();
  sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
  /** @type {Record<string, string>|undefined} */
  let queryParams;
  if (provider === 'google') {
    queryParams = { prompt: 'select_account' };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      ...(queryParams ? { queryParams } : {}),
    },
  });

  if (error) {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    throw error;
  }
}

/** @returns {Promise<void>} */
export async function startGoogleOAuth() {
  return startOAuth('google');
}

/** @returns {Promise<void>} */
export async function startGitHubOAuth() {
  return startOAuth('github');
}

/** @returns {Promise<void>} */
export async function startDiscordOAuth() {
  return startOAuth('discord');
}
