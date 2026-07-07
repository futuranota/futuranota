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

function IconArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

/**
 * Split signup / sign-in card with brand visual + optional image slot.
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
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    agreeToTerms: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(form);
  };

  return (
    <div className="auth-split-card card">
      <aside className="auth-split-visual" aria-hidden={false}>
        <div className="auth-split-visual__primary">
          <Link to={PATHS.home} className="auth-split-visual__back" aria-label="Back to home">
            <IconArrowLeft />
          </Link>
          <img src={AUTH_BRAND_ASSET_SRC} alt="" className="auth-split-visual__img" />
        </div>

        <div className="auth-split-visual__slot">
          {AUTH_CARD_SLOT_IMAGE ? (
            <img
              src={AUTH_CARD_SLOT_IMAGE}
              alt=""
              className="auth-split-visual__slot-img"
            />
          ) : (
            <div className="auth-split-visual__slot-placeholder" aria-hidden="true" />
          )}
        </div>
      </aside>

      <div className="auth-split-form">
        <Link to={PATHS.home} className="auth-split-form__back auth-split-form__back--mobile mono-sm">
          <IconArrowLeft />
          Back
        </Link>

        <div className="auth-split-form__tabs" role="tablist" aria-label="Sign up or sign in">
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={`auth-split-form__tab${isSignup ? ' is-active' : ''}`}
            onClick={() => onModeChange?.('signup')}
          >
            Create account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={`auth-split-form__tab${!isSignup ? ' is-active' : ''}`}
            onClick={() => onModeChange?.('signin')}
          >
            Log in
          </button>
        </div>

        <div className="auth-split-form__head">
          <h1 className="auth-split-form__title">
            {isSignup ? 'Create an Account' : 'Welcome back'}
          </h1>
        </div>

        {isSignup && selectedPlan ? (
          <div className="auth-split-plan-chip">
            Plan selected: <strong>{selectedPlan.label}</strong> ({selectedPlan.priceLabel})
            <Link to={`${PATHS.home}#pricing`} className="auth-split-form__link auth-split-form__link--inline">
              Change
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          className="auth-split-google"
          onClick={onGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-split-or">
          <span className="auth-split-or__label">or with email</span>
        </div>

        <form className="auth-split-form__fields" onSubmit={handleSubmit}>
          {isSignup ? (
            <div className="auth-split-form__row">
              <label className="auth-split-field" htmlFor="firstName">
                <span className="auth-split-field__label">First Name</span>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="John"
                  autoComplete="given-name"
                  className="auth-split-input"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
              </label>
              <label className="auth-split-field" htmlFor="lastName">
                <span className="auth-split-field__label">Last Name</span>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  autoComplete="family-name"
                  className="auth-split-input"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
          ) : null}

          <label className="auth-split-field" htmlFor="email">
            <span className="auth-split-field__label">Email Address</span>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@studio.com"
              autoComplete="email"
              className="auth-split-input"
              value={form.email}
              onChange={handleChange}
              required={isSignup}
            />
          </label>

          <label className="auth-split-field" htmlFor="password">
            <span className="auth-split-field__label">Password</span>
            <div className="auth-split-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="auth-split-input auth-split-input--password"
                value={form.password}
                onChange={handleChange}
                required={isSignup}
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

          {!isSignup ? (
            <Link
              to={PATHS.forgotPassword}
              className="auth-split-form__link auth-split-form__link--inline auth-split-form__forgot"
            >
              Forgot password?
            </Link>
          ) : null}

          {isSignup ? (
            <div className="auth-split-terms">
              <input
                id="agreeToTerms"
                name="agreeToTerms"
                type="checkbox"
                checked={form.agreeToTerms}
                onChange={handleChange}
                required
              />
              <span>
                <label htmlFor="agreeToTerms">I agree to the </label>
                <Link
                  to={PATHS.terms}
                  className="auth-split-form__link auth-split-form__link--inline"
                >
                  Terms &amp; Conditions
                </Link>
              </span>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="auth-split-form__error" role="alert">
              {errorMessage}
              {onRetryCheckout ? (
                <button
                  type="button"
                  className="auth-split-form__retry"
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
            className={`btn btn-primary auth-split-submit${loading ? ' is-loading' : ''}`}
            disabled={loading}
            aria-busy={loading}
          >
            {loading
              ? (loadingLabel || 'Loading…')
              : (isSignup ? 'Sign up' : 'Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}
