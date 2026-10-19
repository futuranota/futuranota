import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleIcon } from './AuthOAuthIcons.jsx';
import { PATHS } from '../lib/paths.js';

/** Primary brand art — swap path when hosting locally if needed. */
export const AUTH_BRAND_ASSET_SRC = 'https://i.ibb.co/dJxBbFks/brandasset.png';

/**
 * Optional second image for the card visual panel.
 * Set to e.g. `/uploads/marketing/welcome-slot.png` when your artwork is ready.
 */
export const AUTH_CARD_SLOT_IMAGE = '';

/**
 * Centered sign-up / sign-in card. Same handlers as the previous split card.
 */
export function AuthSignupCard({
  mode = 'signup',
  onModeChange,
  onSubmit,
  onGoogleSignIn,
  loading = false,
  loadingLabel,
  errorMessage = null,
  onRetryCheckout,
  retryLabel = 'Try again',
  selectedPlan = null,
}) {
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalError(null);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isSignup) {
      onSubmit?.(form);
      return;
    }
    const name = form.name.trim();
    if (!name) {
      setLocalError('Enter your name.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    onSubmit?.({ ...form, name });
  };

  return (
    <div className="auth-simple card">
      <Link to={PATHS.home} className="auth-simple__brand" aria-label="Futura Nota">
        <img src="/favicon.svg" alt="" width="26" height="24" />
        <span className="auth-simple__name">Futura Nota</span>
      </Link>

      {isSignup && selectedPlan ? (
        <div className="auth-simple__plan">
          Plan selected: <strong>{selectedPlan.label}</strong> ({selectedPlan.priceLabel})
          <Link to={`${PATHS.home}#pricing`} className="auth-simple__plan-link">
            Change
          </Link>
        </div>
      ) : null}

      <form className="auth-simple__form" onSubmit={handleSubmit}>
        {isSignup ? (
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Name"
            aria-label="Name"
            autoComplete="name"
            className="auth-simple__input"
            value={form.name}
            onChange={handleChange}
            required
          />
        ) : null}
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          className="auth-simple__input"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          className="auth-simple__input"
          value={form.password}
          onChange={handleChange}
          required
        />
        {isSignup ? (
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            aria-label="Confirm password"
            autoComplete="new-password"
            className="auth-simple__input"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />
        ) : null}

        {!isSignup ? (
          <Link to={PATHS.forgotPassword} className="auth-simple__forgot">
            Forgot password?
          </Link>
        ) : null}

        {localError || errorMessage ? (
          <div className="auth-simple__error" role="alert">
            {localError || errorMessage}
            {onRetryCheckout ? (
              <button
                type="button"
                className="auth-simple__retry"
                onClick={onRetryCheckout}
                disabled={loading}
              >
                {retryLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          className={`auth-simple__submit${loading ? ' is-loading' : ''}`}
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? (loadingLabel || 'Loading…')
            : (isSignup ? 'Create an account' : 'Log in')}
        </button>
      </form>

      <button
        type="button"
        className="auth-simple__google"
        onClick={onGoogleSignIn}
        disabled={loading}
      >
        <GoogleIcon />
        {isSignup ? 'Sign up with Google' : 'Sign in with Google'}
      </button>

      <p className="auth-simple__switch">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <button
          type="button"
          onClick={() => onModeChange?.(isSignup ? 'signin' : 'signup')}
        >
          {isSignup ? 'Login' : 'Sign up'}
        </button>
      </p>

      {isSignup ? (
        <p className="auth-simple__terms">
          By continuing you agree to the{' '}
          <Link to={PATHS.termsOfService}>Terms of Service</Link>
        </p>
      ) : null}
    </div>
  );
}
