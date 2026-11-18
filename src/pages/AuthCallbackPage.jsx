import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { resolveOAuthReturn } from '../lib/authRedirect.js';
import { PATHS } from '../marketing/lib/paths.js';
import { useAuthStore } from '../stores/authStore.js';
import { MarkLoading } from '../components/shared/MarkLoading.jsx';

/** Handles Google OAuth return, then sends user to the dashboard. */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Authenticating…');

  useEffect(() => {
    let cancelled = false;
    let subscription = null;
    const handledRef = { current: false };

    const syncSession = (session) => {
      if (!session) return;
      useAuthStore.setState({
        session,
        user: session.user,
        loading: false,
      });
    };

    const go = async (session) => {
      if (cancelled || handledRef.current) return;
      if (session) {
        handledRef.current = true;
        syncSession(session);
        setStatus('Redirecting to Futura Nota…');
        if (cancelled) return;
        navigate(PATHS.app, { replace: true });
      } else {
        handledRef.current = true;
        const message = 'Google sign-in did not return a session.';
        setStatus(message);
        const params = new URLSearchParams({ auth_error: message });
        navigate(`${PATHS.login}?${params.toString()}`, { replace: true });
      }
    };

    const finish = async () => {
      try {
        const { session } = await resolveOAuthReturn();
        if (session) {
          await go(session);
          return;
        }
        const { data: { session: retry } } = await supabase.auth.getSession();
        await go(retry);
      } catch (err) {
        console.error('OAuth callback failed:', err);
        const { data: { session: retry } } = await supabase.auth.getSession();
        if (retry) {
          await go(retry);
          return;
        }
        if (!cancelled) {
          const message = err?.message || 'Google sign-in failed. Try again.';
          setStatus(message);
          const params = new URLSearchParams({ auth_error: message });
          window.setTimeout(() => navigate(`${PATHS.login}?${params.toString()}`, { replace: true }), 800);
        }
      }
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !handledRef.current) void go(session);
    });
    subscription = data.subscription;

    finish();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f1eb' }}>
      <div className="landing-card glass" style={{ maxWidth: 320, textAlign: 'center', background: '#fff' }}>
        <MarkLoading label={status} />
      </div>
    </div>
  );
}
