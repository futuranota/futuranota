// src/stores/authStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { getAppOrigin, resolveOAuthReturn, startGoogleOAuth } from '../lib/authRedirect.js';
import { getSupabaseConfigError } from '../lib/supabaseClient';

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
    set({ session, user: session?.user ?? null, loading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email, password, metadata) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || undefined,
        emailRedirectTo: `${getAppOrigin()}/login`,
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

