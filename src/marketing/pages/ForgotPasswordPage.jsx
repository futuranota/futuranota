import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { PATHS } from '../lib/paths.js';
import { applyMarketingTheme } from '../lib/theme.js';
import '../styles/marketing.css';
import '../styles/sections.css';

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuthStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      await resetPasswordForEmail(email);
      setSent(true);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-wrap" data-screen-label="forgot-password">
      <div className="auth-standalone-card card">
        {sent ? (
          <>
            <span className="auth-done__mark"><span className="back-link__arrow" style={{ transform: 'none' }}>✓</span></span>
            <h1 className="auth-split-form__title">Check your inbox.</h1>
            <p className="auth-split-form__sub">
              We sent a password reset link to {email}. Click it to choose a new password.
            </p>
            <Link to={PATHS.login} className="btn auth-split-submit" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Back to log in
            </Link>
          </>
        ) : (
          <>
            <div className="auth-split-form__head">
              <h1 className="auth-split-form__title">Recover password</h1>
              <p className="auth-split-form__sub">Enter your email to receive a reset link.</p>
            </div>

            <form className="auth-split-form__fields" onSubmit={handleSubmit}>
              <label className="auth-split-field" htmlFor="email">
                <span className="auth-split-field__label">Email Address</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@studio.com"
                  autoComplete="email"
                  className="auth-split-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              {errorMessage ? (
                <div style={{ fontSize: 12, color: 'var(--warm)', padding: '6px 10px', background: 'var(--warm-soft)', borderRadius: 6 }}>
                  {errorMessage}
                </div>
              ) : null}

              <button type="submit" className="btn auth-split-submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <p className="auth-split-form__sub" style={{ textAlign: 'center' }}>
              Remembered your password?{' '}
              <Link to={PATHS.login} className="auth-split-form__link auth-split-form__link--inline">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
