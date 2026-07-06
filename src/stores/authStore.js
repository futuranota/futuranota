// src/stores/authStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { getAppOrigin, resolveOAuthReturn, startGoogleOAuth } from '../lib/authRedirect.js';
import { getSupabaseConfigError } from '../lib/supabaseClient';
import { flushPersistenceSync } from './middleware/persistenceMiddleware.js';
import { clearPendingProCheckout } from '../lib/pendingCheckout.js';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,

  init: async () => {
    const onCallback = typeof window !== 'undefined'
      && window.location.pathname === '/auth/callback';

    if (!onCallback) {
      try {
        const { session: oauthSession, hadOAuthParams } = await resolveOAuthReturn();
        if (oauthSession && hadOAuthParams) {
          set({ session: oauthSession, user: oauthSession.user, loading: false });
          supabase.auth.onAuthStateChange((_event, session) => {
            set({ session, user: session?.user ?? null });
          });
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

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      set({ session: nextSession, user: nextSession?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email, password, metadata, loginRedirectQuery = '') => {
    const loginPath = `${getAppOrigin()}/login`;
    const emailRedirectTo = loginRedirectQuery
      ? `${loginPath}?${loginRedirectQuery}`
      : loginPath;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || undefined,
        emailRedirectTo,
      },
    });
    if (error) throw error;
  },

  signInWithGoogle: async () => {
    const configError = getSupabaseConfigError();
    if (configError) throw new Error(configError);
    await startGoogleOAuth();
  },

  signOut: async () => {
    await flushPersistenceSync();
    clearPendingProCheckout();
    await supabase.auth.signOut();
    set({ user: null, session: null });
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

