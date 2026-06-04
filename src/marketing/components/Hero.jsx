import { Link } from 'react-router-dom';
import { authPath, PATHS } from '../lib/paths.js';
import { HeroTitleLoop } from './HeroTitleLoop.jsx';

/** Bracket phrase rotates; subject swaps in sync (no motion on subject). */
const MAKER_TITLE_LINES = [
  { subject: 'coffee', bracket: 'You sell the cup.' },
  { subject: 'product', bracket: 'you design what fits.' },
];

const HERO_COPY = {
  maker: {
    eyebrow: 'FOR MAKERS & FOUNDERS',
    lead: 'Spot a launch before it lands then turn it into something you make by hand or as a prototype. Ceramics, wood, prints, design. Futura Nota gives you the exact window to ship the companion product while attention is at its peak.',
  },
  founder: {
    eyebrow: 'REAL-TIME CAMPAIGN INTELLIGENCE',
    pre: 'Study the campaign.',
    accent: 'Move on the window.',
    lead: 'Futura Nota detects when a company starts a launch campaign — and hands you the exact window of opportunity to ship the companion product before it closes.',
  },
};

const FEATURES = [
  ['01', 'OBJECTS', 'Parent entities — you, projects, products, spaces. Everything you track lives as an object you can branch.'],
  ['02', 'DOCS & NODES', 'Notion-like docs that split into typed, atomic #-nodes the moment you write them. Structure, automatically.'],
  ['03', 'CANVAS & SYNC', 'Plan the connections on an infinite canvas, then sync across tiers so the window never slips past you.'],
];

function HeroFrame() {
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
            <span className="eyebrow eyebrow--signal frame__eyebrow"><span className="tick" />CAMPAIGN DETECTED</span>
            <span className="faint mono-sm frame-ui frame-ui--meta">02:14 ago</span>
          </div>
          <div className="detect__name">NovaBrew · single-origin launch</div>
          <div className="window">
            <div className="window__label mono-sm frame__eyebrow">SHIP WINDOW</div>
            <div className="window__bar"><span style={{ width: '62%' }} /></div>
            <div className="window__meta frame-ui">
              <span className="mono-sm">opens now</span>
              <span className="mono-sm faint frame-ui--meta">closes in 9d</span>
            </div>
          </div>
        </div>
        <div className="nodes">
          <div className="node frame-ui">
            <span className="node__hash">problem</span>
            <span className="node__text">mugs ship cold, look generic</span>
          </div>
          <div className="node frame-ui">
            <span className="node__hash">make</span>
            <span className="node__text">hand-thrown stoneware, matte glaze</span>
          </div>
          <div className="node frame-ui">
            <span className="node__hash">window</span>
            <span className="node__text">drop day 0 → day 9</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function FeatureCards() {
  return (
    <div className="features grid">
      {FEATURES.map(([n, title, body]) => (
        <article className="feature card" key={n}>
          <div className="feature__top">
            <span className="feature__num mono-sm">{n}</span>
            <span className="feature__dot" />
          </div>
          <h3 className="h3 feature__title">{title}</h3>
          <p className="muted feature__body">{body}</p>
        </article>
      ))}
    </div>
  );
}

export function Hero({ heroMode = 'maker' }) {
  const c = HERO_COPY[heroMode] || HERO_COPY.maker;

  return (
    <section className="hero section" id="top" data-screen-label="hero">
      <div className="container hero__grid">
        <div className="hero__copy">
          <div className="eyebrow-row">
            <span className="eyebrow eyebrow--signal hero__eyebrow"><span className="tick" />{c.eyebrow}</span>
          </div>
          {heroMode === 'maker' ? (
            <HeroTitleLoop lines={MAKER_TITLE_LINES} />
          ) : (
            <h1 className="display hero__title">
              {c.pre} <span className="accent-word">{c.accent}</span>
            </h1>
          )}
          <p className="lead hero__lead">{c.lead}</p>
          <div className="hero__cta">
            <Link to={authPath()} className="btn btn-primary" style={{ color: 'rgb(255, 255, 255)', fontFamily: 'Helvetica' }}>
              Get Started <span className="arrow">→</span>
            </Link>
            <Link to={PATHS.how} className="btn btn-ghost">Watch how it works</Link>
          </div>
          <div className="hero__trust">
            <span className="chip chip--signal" style={{ fontFamily: 'sans-serif' }}>
              <span className="tick" style={{ width: 6, height: 6, borderRadius: 2, background: 'currentColor' }} />10 free searches
            </span>
          </div>
        </div>
        <HeroFrame />
      </div>
      <div className="container">
        <FeatureCards />
      </div>
    </section>
  );
}
