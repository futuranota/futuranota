// src/pages/AuthCallbackPage.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/app');
      else navigate('/');
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