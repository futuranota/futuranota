import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  clearPendingLibrary,
  markPendingLibrary,
  OAUTH_MODE_KEY,
} from '../lib/onboardingFlow.js';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const oauthMode = sessionStorage.getItem(OAUTH_MODE_KEY);
      sessionStorage.removeItem(OAUTH_MODE_KEY);

      if (session) {
        if (oauthMode === 'signup') {
          markPendingLibrary();
        } else {
          clearPendingLibrary();
        }
        navigate('/app');
      } else {
        navigate('/');
      }
    });
  }, [navigate]);

  return (
    <div className="landing">
      <div className="landing-card glass" style={{ maxWidth: 300, textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--dim)' }}>Authenticating…</span>
      </div>
    </div>
  );
}
