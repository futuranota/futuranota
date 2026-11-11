import { Link } from 'react-router-dom';
import { MailchimpSubscribeForm } from './MailchimpSubscribeForm.jsx';
import { Wordmark } from './Wordmark.jsx';
import { sectionPath } from '../lib/paths.js';
import { getSite, FOOTER_SECTION_SLUGS } from '../lib/content.js';
import { useSiteTina, siteTinaProps } from '../context/TinaVisualEditing.jsx';
import { useI18n } from '../../i18n/useI18n.js';

function footerHref(label) {
  const slug = FOOTER_SECTION_SLUGS[label];
  return slug ? sectionPath(slug) : '#';
}

export function Footer() {
  const siteTina = useSiteTina();
  const { footer } = siteTina?.document ?? getSite();
  const { t } = useI18n();

  return (
    <footer className="footer" data-screen-label="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Wordmark className="footer__brand-link" />
          <div className="footer__news-intro">
            <h3 className="footer__news-title">{t('marketing.newsletterTitle')}</h3>
            <p className="footer__news-body">{t('marketing.newsletterBody')}</p>
          </div>
          <MailchimpSubscribeForm
            placeholder={t('marketing.newsletterPlaceholder')}
            submitLabel={t('marketing.newsletterSubmit')}
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
