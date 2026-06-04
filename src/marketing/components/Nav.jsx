import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from './Wordmark.jsx';
import { PATHS, authPath } from '../lib/paths.js';

const NAV_LINKS = [
  ['Horizon', PATHS.horizon],
  ['Marketplace', PATHS.marketplace],
  ['Blogs', PATHS.blogs],
  ['Enseñanzas', PATHS.ensenanzas],
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="nav" data-screen-label="nav">
      <div className="nav__inner container">
        <Wordmark />
        <nav className="nav__links" aria-label="Primary">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={label} to={href} className="nav__link">{label}</Link>
          ))}
        </nav>
        <div className="nav__actions">
          <Link to={authPath('signin')} className="nav__link nav__link--quiet">Log in</Link>
          <Link to={authPath()} className="btn btn-primary btn-sm" style={{ fontFamily: 'sans-serif' }}>Sign up free</Link>
        </div>
        <button type="button" className="nav__burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /><span /><span />
        </button>
      </div>
      {open && (
        <div className="nav__mobile">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={label} to={href} className="nav__mobile-link" onClick={() => setOpen(false)}>{label}</Link>
          ))}
          <Link to={authPath('signin')} className="nav__mobile-link" onClick={() => setOpen(false)}>Log in</Link>
          <Link to={authPath()} className="btn btn-primary" onClick={() => setOpen(false)} style={{ marginTop: 8 }}>Sign up free</Link>
        </div>
      )}
    </header>
  );
}
