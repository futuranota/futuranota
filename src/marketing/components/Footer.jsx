import { Link } from 'react-router-dom';
import { Mark } from './Mark.jsx';
import { PATHS, sectionPath } from '../lib/paths.js';

const FOOTER_COLS = [
  ['Product', ['Features', 'Pricing', 'Documentation', 'Changelog']],
  ['Learn', ['Blogs', 'Enseñanzas', 'Marketplace', 'Horizon']],
  ['Community', ['GitHub', 'Twitter / X', 'Discord', 'Contact']],
  ['Legal', ['Privacy', 'Terms', 'Cookies']],
];

const FOOTER_SECTION_SLUGS = {
  Horizon: 'horizon',
  Marketplace: 'marketplace',
  Blogs: 'blogs',
  Enseñanzas: 'ensenanzas',
};

function footerHref(label) {
  const slug = FOOTER_SECTION_SLUGS[label];
  return slug ? sectionPath(slug) : '#';
}

export function Footer() {
  return (
    <footer className="footer" data-screen-label="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Link to={PATHS.home} className="brand">
            <span className="brand__mark"><Mark /></span>
            <span className="brand__type">FUTURA<span className="brand__type-thin"> NOTA</span></span>
          </Link>
          <p className="muted footer__tag">The future of taking notes — for the people who ship before the window closes.</p>
          <form className="footer__news" onSubmit={(e) => e.preventDefault()}>
            <label className="mono-sm faint" htmlFor="news">Stay ahead of the trends</label>
            <div className="footer__news-row">
              <input id="news" type="email" placeholder="you@studio.com" className="footer__input" />
              <button className="btn btn-primary btn-sm" type="submit">Subscribe</button>
            </div>
          </form>
        </div>
        <div className="footer__cols">
          {FOOTER_COLS.map(([h, links]) => (
            <div className="footer__col" key={h}>
              <div className="footer__col-h mono-sm">{h}</div>
              {links.map((l) => (
                footerHref(l).startsWith('/') ? (
                  <Link key={l} to={footerHref(l)} className="footer__link">{l}</Link>
                ) : (
                  <a key={l} href={footerHref(l)} className="footer__link">{l}</a>
                )
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="container footer__base">
        <span className="mono-sm faint">© 2026 Futura Nota — operational since 2026.</span>
        <span className="mono-sm faint">Made by hand · shipped on the window.</span>
      </div>
    </footer>
  );
}
