import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { resolveOAuthReturn } from '../lib/authRedirect.js';
import { PATHS } from '../marketing/lib/paths.js';
import { useAuthStore } from '../stores/authStore.js';

/** Handles Google OAuth return, then sends user to the dashboard. */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Authenticating…');

  useEffect(() => {
    let cancelled = false;
    let subscription = null;

    const syncSession = (session) => {
      if (!session) return;
      useAuthStore.setState({
        session,
        user: session.user,
        loading: false,
      });
    };

    const go = (session) => {
      if (cancelled) return;
      if (session) {
        syncSession(session);
        setStatus('Redirecting to Futura Nota…');
        navigate(PATHS.app, { replace: true });
      } else {
        setStatus('Sign-in failed. Redirecting…');
        navigate(PATHS.login, { replace: true });
      }
    };

    const finish = async () => {
      try {
        const { session } = await resolveOAuthReturn();
        if (session) {
          go(session);
          return;
        }
        const { data: { session: retry } } = await supabase.auth.getSession();
        go(retry);
      } catch (err) {
        console.error('OAuth callback failed:', err);
        const { data: { session: retry } } = await supabase.auth.getSession();
        if (retry) {
          go(retry);
          return;
        }
        if (!cancelled) {
          setStatus(err?.message || 'Sign-in failed. Redirecting…');
          window.setTimeout(() => navigate(PATHS.login, { replace: true }), 1200);
        }
      }
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) go(session);
    });
    subscription = data.subscription;

    finish();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="landing">
      <div className="landing-card glass" style={{ maxWidth: 320, textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--dim)' }}>{status}</span>
      </div>
    </div>
  );
}
