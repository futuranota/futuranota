import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { PATHS } from '../lib/paths.js';
import { applyAuthLightCanvas } from '../lib/theme.js';
import '../styles/marketing.css';
import '../styles/sections.css';
import { supabase } from '../../lib/supabaseClient.js';


function IconEye({ off = false }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 7-1.02 2.28-2.77 4.2-4.97 5.32M6.06 6.06A10.8 10.8 0 0 0 3 11c1.73 3.89 6 7 11 7 1.05 0 2.06-.14 3-.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => applyAuthLightCanvas(), []);

  useEffect(() => {
    // Captura el token del hash que viene en el link de reset
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    if (type === 'recovery' && accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      }).catch((err) => {
        setErrorMessage('Invalid or expired reset link. Please request a new one.');
        console.error(err);
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-wrap" data-screen-label="reset-password">
      <div className="auth-standalone-card card">
        {done ? (
          <>
            <span className="auth-done__mark"><span className="back-link__arrow" style={{ transform: 'none' }}>✓</span></span>
            <h1 className="auth-split-form__title">Password updated.</h1>
            <p className="auth-split-form__sub">Your password was changed successfully.</p>
            <button
              type="button"
              className="btn auth-split-submit"
              onClick={() => navigate(PATHS.app, { replace: true })}
            >
              Continue to Futura Nota
            </button>
          </>
        ) : (
          <>
            <div className="auth-split-form__head">
              <h1 className="auth-split-form__title">Set a new password</h1>
              <p className="auth-split-form__sub">Choose a new password for your account.</p>
            </div>

            <form className="auth-split-form__fields" onSubmit={handleSubmit}>
              <label className="auth-split-field" htmlFor="password">
                <span className="auth-split-field__label">New Password</span>
                <div className="auth-split-input-wrap">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="new-password"
                    className="auth-split-input auth-split-input--password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-split-input__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
              </label>

              <label className="auth-split-field" htmlFor="confirmPassword">
                <span className="auth-split-field__label">Confirm Password</span>
                <div className="auth-split-input-wrap">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    className="auth-split-input auth-split-input--password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </label>

              {errorMessage ? (
                <div style={{ fontSize: 12, color: 'var(--warm)', padding: '6px 10px', background: 'var(--warm-soft)', borderRadius: 6 }}>
                  {errorMessage}
                </div>
              ) : null}

              <button type="submit" className="btn auth-split-submit" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            <p className="auth-split-form__sub" style={{ textAlign: 'center' }}>
              <Link to={PATHS.login} className="auth-split-form__link auth-split-form__link--inline">
                Back to log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
