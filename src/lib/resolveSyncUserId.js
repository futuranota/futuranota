import { supabase, getSupabaseConfigError } from "./supabaseClient.js";

/**
 * @returns {{ access_token: string, refresh_token: string, userId: string }|null}
 */
function readStoredAuthSession() {
  if (typeof localStorage === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const userId = parsed?.user?.id;
      const access_token = parsed?.access_token;
      const refresh_token = parsed?.refresh_token;
      if (!userId || typeof userId !== "string") continue;
      if (!access_token || typeof access_token !== "string") continue;
      const expiresAtMs = parsed?.expires_at ? Number(parsed.expires_at) * 1000 : 0;
      if (expiresAtMs > 0 && expiresAtMs <= Date.now()) continue;
      return {
        access_token,
        refresh_token: typeof refresh_token === "string" ? refresh_token : "",
        userId,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

/**
 * Resolve the authenticated user id for workspace / table sync writes.
 * Recovers from localStorage + setSession when getSession() flakes
 * (navigator locks, HMR, mid-refresh). Never drops a still-valid token
 * just because refresh failed near expiry.
 * @returns {Promise<string|null>}
 */
export async function resolveSyncUserId() {
  const configErr = getSupabaseConfigError();
  if (configErr) return null;

  let session = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[futura-nota] getSession error:", error.message);
    }
    session = data?.session ?? null;
  } catch (err) {
    console.warn("[futura-nota] getSession threw:", err?.message || err);
  }

  if (!session?.user?.id) {
    try {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed?.session?.user?.id) {
        session = refreshed.session;
      }
    } catch {
      // fall through to storage recovery
    }
  }

  if (!session?.user?.id) {
    const stored = readStoredAuthSession();
    if (stored) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        });
        if (!error && data?.session?.user?.id) {
          session = data.session;
        } else if (!error) {
          // Client accepted tokens; use stored id for this write.
          return stored.userId;
        }
      } catch (err) {
        console.warn("[futura-nota] setSession recovery failed:", err?.message || err);
        return stored.userId;
      }
    }
  }

  if (!session?.user?.id) return null;

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const expiresSoon = expiresAt > 0 && expiresAt - Date.now() < 60_000;
  if (expiresSoon) {
    try {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed?.session?.user?.id) {
        return refreshed.session.user.id;
      }
    } catch {
      // keep current session below
    }
    // Access token still valid for up to ~60s — do not block deletes/sync.
    if (expiresAt > Date.now()) {
      return session.user.id;
    }
    const stored = readStoredAuthSession();
    return stored?.userId || null;
  }

  return session.user.id;
}

/** Remove persisted Supabase session keys so logout cannot resurrect via storage recovery. */
export function clearStoredAuthSession() {
  if (typeof localStorage === "undefined") return;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      localStorage.removeItem(key);
    }
  } catch {
    // private mode / quota
  }
}
