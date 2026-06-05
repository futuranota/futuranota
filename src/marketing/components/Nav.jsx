import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wordmark } from './Wordmark.jsx';
import { BlogNavMegaMenu } from './BlogNavMegaMenu.jsx';
import { PATHS, authPath } from '../lib/paths.js';
import { getSite } from '../lib/content.js';
import { useSiteTina, siteTinaProps } from '../context/TinaVisualEditing.jsx';

export function Nav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [blogsOpen, setBlogsOpen] = useState(false);
  const showReturn = pathname !== PATHS.home;
  const siteTina = useSiteTina();
  const site = siteTina?.document ?? getSite();
  const navLinks = site.nav.links;

  return (
    <header className="nav" data-screen-label="nav">
      <div className="nav__inner container">
        <Wordmark />
        <nav className="nav__links" aria-label="Primary">
          {navLinks.map(({ label, path }, index) => (
            <Link
              key={`${label}-${path}`}
              to={path}
              className="nav__link"
              {...siteTinaProps(`nav.links.${index}.label`)}
            >
              {label}
            </Link>
          ))}
          <div className="nav__item nav__item--mega">
            <button
              type="button"
              className={`nav__link nav__mega-trigger${blogsOpen ? ' is-open' : ''}`}
              aria-expanded={blogsOpen}
              aria-haspopup="true"
              onClick={() => setBlogsOpen((o) => !o)}
            >
              Blogs
              <span className="nav__mega-chevron" aria-hidden />
            </button>
            <BlogNavMegaMenu open={blogsOpen} onClose={() => setBlogsOpen(false)} />
          </div>
        </nav>
        <div className="nav__actions">
          {showReturn && (
            <Link to={PATHS.home} className="nav__return" aria-label="Return to home">
              <span className="nav__return-arrow" aria-hidden>←</span>
              Return
            </Link>
          )}
          <Link to={authPath('signin')} className="nav__link nav__link--quiet">Log in</Link>
          <Link to={authPath()} className="btn btn-primary btn-sm" style={{ fontFamily: 'sans-serif' }}>Sign up free</Link>
        </div>
        <button type="button" className="nav__burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /><span /><span />
        </button>
      </div>
      {open && (
        <div className="nav__mobile">
          {navLinks.map(({ label, path }, index) => (
            <Link
              key={`${label}-${path}`}
              to={path}
              className="nav__mobile-link"
              onClick={() => setOpen(false)}
              {...siteTinaProps(`nav.links.${index}.label`)}
            >
              {label}
            </Link>
          ))}
          <Link to={PATHS.blogs} className="nav__mobile-link" onClick={() => setOpen(false)}>Blogs</Link>
          {showReturn && (
            <Link to={PATHS.home} className="nav__mobile-link nav__mobile-return" onClick={() => setOpen(false)}>← Return</Link>
          )}
          <Link to={authPath('signin')} className="nav__mobile-link" onClick={() => setOpen(false)}>Log in</Link>
          <Link to={authPath()} className="btn btn-primary" onClick={() => setOpen(false)} style={{ marginTop: 8 }}>Sign up free</Link>
        </div>
      )}
    </header>
  );
}
