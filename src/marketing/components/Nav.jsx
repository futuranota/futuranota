import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wordmark } from './Wordmark.jsx';
import { BlogNavMegaMenu } from './BlogNavMegaMenu.jsx';
import { NavPreferences } from '../../components/shared/NavPreferences.jsx';
import { TranslatedText } from '../../components/shared/TranslatedText.jsx';
import { useI18n } from '../../i18n/useI18n.js';
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
  const { t } = useI18n();

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
              <TranslatedText text={label} />
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
              {t("marketing.blogs")}
              <span className="nav__mega-chevron" aria-hidden />
            </button>
            <BlogNavMegaMenu open={blogsOpen} onClose={() => setBlogsOpen(false)} />
          </div>
        </nav>
        <div className="nav__actions">
          <NavPreferences />
          {showReturn && (
            <Link to={PATHS.home} className="nav__return" aria-label={t("marketing.returnHome")}>
              <span className="nav__return-arrow" aria-hidden>←</span>
              {t("marketing.return")}
            </Link>
          )}
          <Link to={authPath('signin')} className="nav__link nav__link--quiet">{t("marketing.logIn")}</Link>
          <Link to={authPath()} className="btn btn-primary btn-sm">{t("marketing.signUp")}</Link>
        </div>
        <button type="button" className="nav__burger" aria-label={t("marketing.openMenu")} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
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
              <TranslatedText text={label} />
            </Link>
          ))}
          <Link to={PATHS.blogs} className="nav__mobile-link" onClick={() => setOpen(false)}>{t("marketing.blogs")}</Link>
          {showReturn && (
            <Link to={PATHS.home} className="nav__mobile-link nav__mobile-return" onClick={() => setOpen(false)}>← {t("marketing.return")}</Link>
          )}
          <Link to={authPath('signin')} className="nav__mobile-link" onClick={() => setOpen(false)}>{t("marketing.logIn")}</Link>
          <Link to={authPath()} className="btn btn-primary" onClick={() => setOpen(false)} style={{ marginTop: 8 }}>{t("marketing.signUp")}</Link>
        </div>
      )}
    </header>
  );
}
