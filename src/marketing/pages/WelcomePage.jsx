import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mark } from '../components/Mark.jsx';
import { PATHS } from '../lib/paths.js';
import { applyMarketingTheme } from '../lib/theme.js';
import '../styles/marketing.css';
import '../styles/sections.css';

const OAUTH = [
  ['Google', 'G'],
  ['GitHub', '⌥'],
];

function AuthField({ id, label, type = 'text', placeholder, autoComplete, value, onChange }) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span className="auth-field__label mono-sm">{label}</span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="auth-input"
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

export function WelcomePage() {
  const initial = typeof location !== 'undefined' && location.hash === '#signin' ? 'signin' : 'signup';
  const [tab, setTab] = useState(initial);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  useEffect(() => {
    const onHash = () => setTab(location.hash === '#signin' ? 'signin' : 'signup');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next) => {
    setSent(false);
    setTab(next);
    if (history.replaceState) {
      history.replaceState(null, '', next === 'signin' ? '#signin' : PATHS.welcome);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); setSent(true); };

  const isSignup = tab === 'signup';

  return (
    <div className="auth-wrap" data-screen-label="welcome">
      <aside className="auth-aside">
        <div className="auth-aside__bg" aria-hidden="true" />
        <div className="auth-aside__inner">
          <Link to={PATHS.home} className="brand auth-brand" aria-label="Futura Nota home">
            <span className="brand__mark"><Mark /></span>
            <span className="brand__type" style={{ fontFamily: 'Quicksand' }}>
              FUTURA<span className="brand__type-thin" style={{ fontFamily: 'Quicksand' }}> NOTA</span>
            </span>
          </Link>
          <div className="auth-aside__copy">
            <span className="chip chip--signal auth-aside__live"><span className="pulse" />THE WINDOW IS OPEN</span>
            <h2 className="display auth-aside__title">Catch the launch. Make the thing.</h2>
            <p className="lead auth-aside__lead">Spot a campaign before it lands, then ship the companion product while attention is at its peak — all from one window.</p>
          </div>
          <ul className="auth-points">
            {[
              '10 free searches — no card required',
              'Real-time campaign detection',
              'Ready-made kits, one-click into Futura',
            ].map((p) => (
              <li className="auth-point" key={p}><span className="auth-point__tick" />{p}</li>
            ))}
          </ul>
          <p className="mono-sm faint auth-aside__foot">operational since 2026 · made by hand</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card card">
          <Link to={PATHS.home} className="auth-back mono-sm">
            <span className="back-link__arrow">←</span> Volver al inicio
          </Link>

          <div className="auth-tabs" role="tablist" aria-label="Sign up or sign in">
            <button type="button" role="tab" aria-selected={isSignup} className={`auth-tab${isSignup ? ' is-active' : ''}`} onClick={() => go('signup')}>Create account</button>
            <button type="button" role="tab" aria-selected={!isSignup} className={`auth-tab${!isSignup ? ' is-active' : ''}`} onClick={() => go('signin')}>Sign in</button>
          </div>

          <div className="auth-head">
            <h1 className="h2 auth-title">{isSignup ? 'Start free.' : 'Welcome back.'}</h1>
            <p className="muted auth-sub">{isSignup ? 'Create your account — 10 searches on the house.' : 'Sign in to pick up where the window left off.'}</p>
          </div>

          {sent ? (
            <div className="auth-done">
              <span className="auth-done__mark"><span className="back-link__arrow" style={{ transform: 'none' }}>✓</span></span>
              <h3 className="h3">{isSignup ? 'Account ready to go.' : "You're signed in."}</h3>
              <p className="muted" style={{ fontSize: 15 }}>This is a prototype — no account was actually created. Wire it to your auth backend to make it live.</p>
              <Link to={PATHS.app} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Enter Futura <span className="arrow">→</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="auth-oauth">
                {OAUTH.map(([name, glyph]) => (
                  <button type="button" className="auth-oauth__btn" key={name}>
                    <span className="auth-oauth__glyph">{glyph}</span>
                    Continue with {name}
                  </button>
                ))}
              </div>
              <div className="auth-or"><span className="mono-sm faint">or with email</span></div>
              <form className="auth-form" onSubmit={submit}>
                {isSignup && (
                  <AuthField id="name" label="NAME" placeholder="Ada Maker" autoComplete="name" value={form.name} onChange={set('name')} />
                )}
                <AuthField id="email" label="EMAIL" type="email" placeholder="you@studio.com" autoComplete="email" value={form.email} onChange={set('email')} />
                <label className="auth-field" htmlFor="password">
                  <span className="auth-field__row">
                    <span className="auth-field__label mono-sm">PASSWORD</span>
                    {!isSignup && <a href="#" className="auth-forgot mono-sm">Forgot?</a>}
                  </span>
                  <input id="password" type="password" placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'} className="auth-input" value={form.password} onChange={set('password')} />
                </label>
                <button type="submit" className="btn btn-primary auth-submit">
                  {isSignup ? 'Create account' : 'Sign in'} <span className="arrow">→</span>
                </button>
              </form>
              <p className="auth-switch muted">
                {isSignup ? 'Already have an account? ' : 'New to Futura Nota? '}
                <button type="button" className="auth-switch__link" onClick={() => go(isSignup ? 'signin' : 'signup')}>
                  {isSignup ? 'Sign in' : 'Create one free'}
                </button>
              </p>
              {isSignup && (
                <p className="auth-terms faint mono-sm">By creating an account you agree to the Terms &amp; Privacy Policy.</p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
