import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { PATHS, authPath } from '../lib/paths.js';

const CARDS = [
  { src: '/landing%20cards/quick%20prompt%20creation.svg', alt: 'Quick prompt creation' },
  { src: '/landing%20cards/prompt%20dashboard.svg', alt: 'Prompt dashboard' },
  { src: '/landing%20cards/embed%20text.svg', alt: 'Embed text' },
  { src: '/landing%20cards/color%20customization.svg', alt: 'Color customization' },
  { src: '/landing%20cards/use%20it%20your%20way.svg', alt: 'Use it your way' },
];

const SPLITS = [
  { media: 'panel', flip: false, action: true },
  { media: 'panel', flip: true, action: true },
  { media: 'circle', flip: false, action: false },
  { media: 'panel', flip: true, action: true },
];

const MORE = ['Placeholder', 'Placeholder', 'Placeholder', 'Placeholder'];

function Placeholder({ kind }) {
  if (kind === 'circle') {
    return (
      <div className="plain-ph plain-ph--circle" aria-hidden="true">
        <span className="plain-ph__orb" />
      </div>
    );
  }
  return (
    <div className="plain-ph" aria-hidden="true">
      <span>Placeholder</span>
    </div>
  );
}

function SupportPanel() {
  const [open, setOpen] = useState(false);
  const proHref = authPath(undefined, { plan: 'pro', billing: 'monthly' });

  return (
    <div className="plain-support">
      {open ? (
        <div className="plain-support__panel" role="dialog" aria-label="Pro">
          <button type="button" className="plain-support__close" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
          <p className="plain-support__kicker">Pro</p>
          <p className="plain-support__price">$20<span>/mo</span></p>
          <p className="plain-support__note">The paid plan. Checkout stays on Stripe.</p>
          <Link to={proHref} className="plain-signup plain-signup--block">Continue</Link>
        </div>
      ) : null}
      <button
        type="button"
        className="plain-support__fab"
        aria-expanded={open}
        aria-label={open ? 'Close Pro' : 'Open Pro'}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-6.5-4.1-9.2-8.2C1 10.2 1.4 7 4 5.6 6.2 4.4 8.4 5.2 9.6 7.1 10.4 5.8 12 5 13.6 5c2.8 0 4.6 2.2 4.2 5-.6 4.2-5.8 11-5.8 11z" />
        </svg>
      </button>
    </div>
  );
}

export function HomePage() {
  const { t } = useI18n();
  return (
    <div className="plain-home">
      <section className="plain-home__hero">
        <h1>Prompts, kept in one place.</h1>
        <p>
          Paste a prompt, keep an image or a video beside it, and copy it into ChatGPT, Claude, or Grok.
        </p>
        <Link to={authPath()} className="plain-signup">{t('marketing.signUp')}</Link>
      </section>
      <section className="plain-features" aria-label="What you can do">
        <h2>Discover Everything Futura Nota Can Do</h2>
        <p>Explore all the features that make Futura the perfect tool you need for your IA era.</p>
        <div className="plain-home__cards">
          {CARDS.map((card) => (
            <img key={card.src} className="plain-home__card" src={card.src} alt={card.alt} />
          ))}
        </div>
      </section>

      <section className="plain-splits" aria-label="Features">
        {SPLITS.map((row, index) => (
          <article key={index} className={row.flip ? 'plain-split plain-split--flip' : 'plain-split'}>
            <Placeholder kind={row.media} />
            <div className="plain-split__copy">
              <h2>Placeholder</h2>
              <p>Two lines of text sit beside the box, in the same place as the reference.</p>
              {row.action ? (
                <Link to={authPath()} className="plain-signup">{t('marketing.signUp')}</Link>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="plain-more" aria-label="And more">
        <h2>And more</h2>
        <div className="plain-more__row">
          {MORE.map((label, index) => (
            <article key={index} className="plain-more__pill">
              <span className="plain-free__icon" aria-hidden="true" />
              <h3>{label}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="plain-close">
        <h2>Start with the first prompt.</h2>
        <Link to={authPath()} className="plain-signup">{t('marketing.signUp')}</Link>
      </section>

      <footer className="plain-foot">
        <Link to={PATHS.privacy}>Privacy</Link>
        <Link to={PATHS.termsOfService}>Terms of Service</Link>
        <span>Futura Nota</span>
        <Link to={authPath('signin')}>{t('marketing.logIn')}</Link>
        <Link to={authPath()}>{t('marketing.signUp')}</Link>
      </footer>
      <SupportPanel />
    </div>
  );
}
