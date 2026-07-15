import { Link } from 'react-router-dom';
import { Mark } from './Mark.jsx';
import { MailchimpSubscribeForm } from './MailchimpSubscribeForm.jsx';
import { PATHS, sectionPath } from '../lib/paths.js';
import { getSite, FOOTER_SECTION_SLUGS } from '../lib/content.js';
import { useSiteTina, siteTinaProps } from '../context/TinaVisualEditing.jsx';

function footerHref(label) {
  const slug = FOOTER_SECTION_SLUGS[label];
  return slug ? sectionPath(slug) : '#';
}

export function Footer() {
  const siteTina = useSiteTina();
  const { footer } = siteTina?.document ?? getSite();

  return (
    <footer className="footer" data-screen-label="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Link to={PATHS.home} className="brand footer__brand-link">
            <span className="brand__mark"><Mark /></span>
            <span className="brand__type">FUTURA<span className="brand__type-thin"> NOTA</span></span>
          </Link>
          <MailchimpSubscribeForm
            placeholder={footer.newsletterPlaceholder}
            inputProps={siteTinaProps('footer.newsletterPlaceholder')}
          />
        </div>
        <div className="footer__cols">
          {footer.columns.map(({ heading, links }) => (
            <div className="footer__col" key={heading}>
              <div className="footer__col-h mono-sm">{heading}</div>
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
      <div className="container footer__end">
        <p className="mono-sm faint footer__trends" {...siteTinaProps('footer.trendsLine')}>{footer.trendsLine}</p>
      </div>
    </footer>
  );
}
