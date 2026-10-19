import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { PATHS, authPath } from '../lib/paths.js';
import { PixelSquares } from '../components/PixelSquares.jsx';
import { GetStartedButton } from '../components/GetStartedButton.jsx';

const KOFI_PAGE = 'futuranota';

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

function useLandingKofi() {
  useEffect(() => {
    document.body.classList.add('landing-kofi');
    let cancelled = false;

    const draw = () => {
      if (cancelled || window.__futuraKofiDrawn || !window.kofiWidgetOverlay) return;
      window.__futuraKofiDrawn = true;
      window.kofiWidgetOverlay.draw(KOFI_PAGE, {
        type: 'floating-chat',
        'floating-chat.donateButton.text': 'Support me',
        'floating-chat.donateButton.background-color': '#00b9fe',
        'floating-chat.donateButton.text-color': '#fff',
      });
    };

    if (window.kofiWidgetOverlay) {
      draw();
    } else {
      let script = document.querySelector('script[data-kofi-overlay]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
        script.async = true;
        script.dataset.kofiOverlay = 'true';
        document.body.appendChild(script);
      }
      script.addEventListener('load', draw);
    }

    return () => {
      cancelled = true;
      document.body.classList.remove('landing-kofi');
    };
  }, []);
}

export function HomePage() {
  const { t } = useI18n();
  useLandingKofi();
  return (
    <div className="plain-home">
      <section className="plain-home__hero">
        <PixelSquares />
        <h1>Prompts, kept in one place.</h1>
        <p>
          Paste a prompt, keep an image or a video beside it, and copy it into ChatGPT, Claude, or Grok.
        </p>
        <GetStartedButton to={authPath()} />
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
                <Link to={authPath(undefined, { plan: 'pro', billing: 'monthly' })} className="plain-signup">Pro · $5/mo</Link>
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
    </div>
  );
}
