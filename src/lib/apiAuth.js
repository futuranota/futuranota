import { supabase } from "./supabaseClient.js";
import { useAuthStore } from "../stores/authStore.js";

/** @param {import('@supabase/supabase-js').Session | null | undefined} session */
function sessionNeedsRefresh(session) {
  if (!session?.access_token) return true;
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  return expiresAt > 0 && expiresAt - Date.now() < 60_000;
}

/** @param {import('@supabase/supabase-js').Session} session */
function syncAuthStoreSession(session) {
  if (!session?.user) return;
  const current = useAuthStore.getState();
  if (current.session?.access_token === session.access_token) return;
  useAuthStore.setState({ session, user: session.user });
}

/**
 * Returns a valid Supabase access token, refreshing the session when needed.
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<string|null>}
 */
export async function getSupabaseAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const storeSession = useAuthStore.getState().session;
    if (storeSession?.access_token && !sessionNeedsRefresh(storeSession)) {
      return storeSession.access_token;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && !sessionNeedsRefresh(session)) {
      syncAuthStoreSession(session);
      return session.access_token;
    }
  }

  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  if (!error && refreshed?.access_token) {
    syncAuthStoreSession(refreshed);
    return refreshed.access_token;
  }

  const { data: { session: fallback } } = await supabase.auth.getSession();
  if (fallback?.access_token) {
    syncAuthStoreSession(fallback);
    return fallback.access_token;
  }

  return useAuthStore.getState().session?.access_token ?? null;
}
