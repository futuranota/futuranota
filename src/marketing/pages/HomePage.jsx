import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { PATHS, authPath } from '../lib/paths.js';

const CARDS = [
  {
    title: 'One page per prompt',
    body: 'Each file holds its own pages. Prompt 01, Prompt 02, and the next one when you need it.',
  },
  {
    title: 'Image or video beside it',
    body: 'Keep a picture, or a YouTube, Vimeo, or Instagram link, next to the text.',
  },
  {
    title: 'Copy it when it is ready',
    body: 'Save the page, then copy the description into ChatGPT, Claude, or Grok.',
  },
];

const FREE_CARDS = Array.from({ length: 9 }, (_, index) => ({
  title: `Placeholder ${String(index + 1).padStart(2, '0')}`,
  body: 'Short line for this card.',
}));

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
      <section className="plain-home__cards" aria-label="What you can do">
        {CARDS.map((card) => (
          <article key={card.title} className="plain-home__card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className="plain-free" aria-label="Included">
        <h2>Included</h2>
        <p>A short line under the title.</p>
        <div className="plain-free__grid">
          {FREE_CARDS.map((card) => (
            <article key={card.title} className="plain-free__card">
              <span className="plain-free__icon" aria-hidden="true" />
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
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
        <span>Futura Nota</span>
        <Link to={authPath('signin')}>{t('marketing.logIn')}</Link>
        <Link to={authPath()}>{t('marketing.signUp')}</Link>
      </footer>
      <SupportPanel />
    </div>
  );
}
