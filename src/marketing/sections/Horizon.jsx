import { Link } from 'react-router-dom';
import { PATHS } from '../lib/paths.js';
import { getHorizon } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

function OppCard({ o }) {
  return (
    <article className="opp card" data-screen-label={`opp-${o.title}`}>
      <div className="opp__illu ph" style={{ aspectRatio: '16 / 9' }}>
        <span className="ph__tag">illustration · {o.tag.toLowerCase()}</span>
      </div>
      <div className="opp__body">
        <div className="eyebrow-row">
          <span className="chip chip--accent">{o.tag}</span>
          {o.trend && <span className="chip chip--signal"><span className="pulse" />Trending</span>}
        </div>
        <h3 className="h3 opp__title">{o.title}</h3>
        <p className="muted opp__desc">{o.desc}</p>
        <div className="opp__org" style={{ fontFamily: 'Helvetica' }}>
          <div className="opp__org-head mono-sm faint">// how it organizes in futura</div>
          <div className="opp__nodes">
            {o.org.map((n, i) => {
              const [hash, ...rest] = n.split('  ');
              return <div className="node" key={i}><span className="node__hash">{hash}</span>{rest.join('  ')}</div>;
            })}
          </div>
        </div>
        <div className="opp__foot">
          <div className="opp__cta">
            <a href="#" className="btn btn-primary btn-sm">Download prototype</a>
            <Link to={PATHS.app} className="btn btn-ghost btn-sm">Open in Futura</Link>
          </div>
          <span className="opp__stat mono-sm faint">★ {o.downloads} downloads</span>
        </div>
      </div>
    </article>
  );
}

export function Horizon() {
  const pageTina = usePageTina();
  const { header, opportunities } = pageTina?.document ?? getHorizon();

  return (
    <section className="section" id="horizon" data-screen-label="horizon">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow" {...pageTinaProps('header.eyebrow')}><span className="tick" />{header.eyebrow}</span>
            <h2 className="h2" {...pageTinaProps('header.title')}>{header.title}</h2>
            <p className="lead" {...pageTinaProps('header.lead')}>{header.lead}</p>
          </div>
          <Link to={PATHS.marketplace} className="link-arrow block-head__link">{header.linkLabel} <span className="arrow">→</span></Link>
        </div>
        <div className="opp-grid grid">
          {opportunities.map((o) => <OppCard key={o.title} o={o} />)}
        </div>
      </div>
    </section>
  );
}
