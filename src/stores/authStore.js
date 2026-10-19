// src/stores/authStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { getAppOrigin, resolveOAuthReturn, startGoogleOAuth } from '../lib/authRedirect.js';
import { getSupabaseConfigError } from '../lib/supabaseClient';
import {
  cancelRemoteSyncForLogout,
  clearLocalWorkspaceOnLogout,
} from './middleware/persistenceMiddleware.js';
import { clearStoredAuthSession } from '../lib/resolveSyncUserId.js';
import { clearPendingProCheckout } from '../lib/pendingCheckout.js';
import { clearLeftPanelNavSnapshot } from './uiStateStore.js';
import { useObjectTargetHoldStore } from './objectTargetHoldStore.js';

let authListenerBound = false;

const LOGOUT_REMOTE_TIMEOUT_MS = 2500;

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,

  init: async () => {
    const bindAuthListener = () => {
      if (authListenerBound) return;
      authListenerBound = true;
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        set({ session: nextSession, user: nextSession?.user ?? null, loading: false });
      });
    };

    try {
      const onCallback = typeof window !== 'undefined'
        && window.location.pathname === '/auth/callback';

      if (!onCallback) {
        try {
          const { session: oauthSession, hadOAuthParams } = await resolveOAuthReturn();
          if (oauthSession && hadOAuthParams) {
            set({ session: oauthSession, user: oauthSession.user, loading: false });
            return;
          }
        } catch (err) {
          console.error('OAuth return failed:', err);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      let activeSession = session;
      const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
      const expiresSoon = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (session && expiresSoon) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (refreshed) activeSession = refreshed;
      }
      set({ session: activeSession, user: activeSession?.user ?? null, loading: false });
    } catch (err) {
      console.error('Auth init failed:', err);
    } finally {
      // Never leave ProtectedRoute / sync stuck on loading forever (HMR, hung OAuth).
      if (get().loading) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          set({
            session: session ?? null,
            user: session?.user ?? null,
            loading: false,
          });
        } catch {
          set({ loading: false });
        }
      }
      bindAuthListener();
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
        throw new Error('Too many sign-in attempts. Wait a minute and try again.');
      }
      throw error;
    }
    if (data?.session) {
      set({ session: data.session, user: data.session.user, loading: false });
    }
  },

  signUp: async (email, password, metadata, loginRedirectQuery = '') => {
    const loginPath = `${getAppOrigin()}/login`;
    const emailRedirectTo = loginRedirectQuery
      ? `${loginPath}?${loginRedirectQuery}`
      : loginPath;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || undefined,
        emailRedirectTo,
      },
    });
    if (!error && data?.session) {
      set({ session: data.session, user: data.session.user, loading: false });
    }
    if (error) {
      if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
        throw new Error('Too many sign-up attempts. Wait a minute and try again.');
      }
      throw error;
    }
  },

  signInWithGoogle: async () => {
    const configError = getSupabaseConfigError();
    if (configError) throw new Error(configError);
    await startGoogleOAuth();
  },

  signOut: async () => {
    const signingOutUserId = get().user?.id;
    clearLocalWorkspaceOnLogout(signingOutUserId);
    clearPendingProCheckout();
    clearLeftPanelNavSnapshot();
    useObjectTargetHoldStore.getState().release();
    try {
      localStorage.removeItem('futura-nota-plan-cache-v1');
    } catch {
      // private mode / quota
    }

    // Clear UI session first — logout must never wait on cloud sync.
    set({ user: null, session: null, loading: false });

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => {
          window.setTimeout(resolve, LOGOUT_REMOTE_TIMEOUT_MS);
        }),
      ]);
    } catch (err) {
      console.warn('Supabase signOut failed:', err?.message || err);
    }
    clearStoredAuthSession();

    return { ok: true };
  },

  resetPasswordForEmail: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin()}/reset-password`,
    });
    if (error) throw error;
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
}));
