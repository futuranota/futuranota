import { Link } from 'react-router-dom';
import { PATHS } from '../lib/paths.js';
import { getHome } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';
import { HeroMarquee } from './HeroMarquee.jsx';
import { HeroAccentTypewriter } from './HeroAccentTypewriter.jsx';

function HeroFrame({ frame }) {
  return (
    <div className="hero__frame-wrap">
      <div className="hero__frame card" aria-hidden="true">
        <div className="frame__bar">
          <span className="frame__dot" /><span className="frame__dot" /><span className="frame__dot" />
          <span className="chip chip--signal frame__live"><span className="pulse" />LIVE</span>
        </div>
        <div className="frame__body">
          <div className="detect">
            <div className="detect__row">
              <span className="eyebrow eyebrow--signal frame__eyebrow"><span className="tick" />{frame.detectedLabel}</span>
              <span className="faint mono-sm frame-ui frame-ui--meta">{frame.ago}</span>
            </div>
            <div className="detect__name">{frame.campaignName}</div>
            <div className="window">
              <div className="window__label mono-sm frame__eyebrow">{frame.windowLabel}</div>
              <div className="window__bar"><span style={{ width: `${frame.windowProgress}%` }} /></div>
              <div className="window__meta frame-ui">
                <span className="mono-sm">{frame.opens}</span>
                <span className="mono-sm faint frame-ui--meta">{frame.closes}</span>
              </div>
            </div>
          </div>
          <div className="nodes">
            {frame.nodes.map((n) => (
              <div className="node frame-ui" key={n.hash}>
                <span className="node__hash">{n.hash}</span>
                <span className="node__text">{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCards({ features }) {
  return (
    <div className="features grid">
      {features.map((f) => (
        <article className="feature card" key={f.num}>
          <div className="feature__top">
            <span className="feature__num mono-sm">{f.num}</span>
            <span className="feature__dot" />
          </div>
          <h3 className="h3 feature__title">{f.title}</h3>
          <p className="muted feature__body">{f.body}</p>
        </article>
      ))}
    </div>
  );
}

export function Hero({ heroMode = 'maker' }) {
  const pageTina = usePageTina();
  const { hero } = pageTina?.document ?? getHome();
  const c = hero[heroMode] || hero.maker;
  const frame = hero.frame;
  const modeKey = heroMode === 'founder' ? 'founder' : 'maker';

  return (
    <section className="hero section" id="top" data-screen-label="hero">
      <div className="container hero__grid">
        <div className="hero__copy">
          <div className="eyebrow-row">
            <span className="eyebrow eyebrow--signal hero__eyebrow" {...pageTinaProps(`hero.${modeKey}.eyebrow`)}><span className="tick" />{c.eyebrow}</span>
          </div>
          {heroMode === 'maker' ? (
            <h1 className="display hero__title hero__title--static">
              <span
                className="hero__title-line hero__title-line--lead"
                {...pageTinaProps('hero.maker.titleLead')}
              >
                {c.titleLead || 'They launch the product'}
              </span>
              <span className="hero__title-line hero__title-line--accent">
                <HeroAccentTypewriter
                  texts={c.titleAccentLines?.length ? c.titleAccentLines : [c.titleAccent || 'You sell the cup.']}
                  tinaProps={pageTinaProps('hero.maker.titleAccent')}
                />
              </span>
            </h1>
          ) : (
            <h1 className="display hero__title" {...pageTinaProps(`hero.${modeKey}.pre`)}>
              {c.pre} <span className="accent-word" {...pageTinaProps(`hero.${modeKey}.accent`)}>{c.accent}</span>
            </h1>
          )}
          <p className="lead hero__lead" {...pageTinaProps(`hero.${modeKey}.lead`)}>{c.lead}</p>
          <div className="hero__cta">
            <Link to={`${PATHS.home}#pricing`} className="btn btn-primary">
              {c.primaryCta || 'See Plans'} <span className="arrow">→</span>
            </Link>
            <Link to={PATHS.how} className="btn btn-ghost">{c.secondaryCta || 'Watch how it works'}</Link>
          </div>
          <div className="hero__trust">
            <span className="chip chip--signal">
              <span className="tick" />{c.trustChip || '10 free searches'}
            </span>
          </div>
        </div>
        <div className="hero__aside">
          <HeroFrame frame={frame} />
          <HeroMarquee rows={hero.marquee} />
        </div>
      </div>
      <div className="container">
        <FeatureCards features={hero.features} />
      </div>
    </section>
  );
}
