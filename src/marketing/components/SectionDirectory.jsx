import { Link } from 'react-router-dom';
import { getHome } from '../lib/content.js';
import { sectionPath } from '../lib/paths.js';

function DirCard({ d }) {
  return (
    <Link
      className="dir card"
      to={sectionPath(d.slug)}
      style={{ gridColumn: `span ${d.span}` }}
      data-screen-label={`dir-${d.slug}`}
    >
      <div className="dir__head">
        <span className="eyebrow"><span className="tick" />{d.eyebrow}</span>
        <span className="dir__num mono-sm">{d.num}</span>
      </div>
      <h3 className="h2 dir__title">{d.title}</h3>
      <p className="muted dir__blurb">{d.blurb}</p>
      <div className="dir__tags">
        {d.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
      </div>
      <span className="dir__cta link-arrow">{d.cta} <span className="arrow">→</span></span>
    </Link>
  );
}

export function SectionDirectory() {
  const { directory } = getHome();

  return (
    <section className="section directory" id="explore" data-screen-label="directory">
      <div className="container">
        <div className="section-head" style={{ marginBottom: 'clamp(28px,4vw,48px)' }}>
          <span className="eyebrow"><span className="tick" />{directory.eyebrow}</span>
          <h2 className="h2">{directory.title}</h2>
          <p className="lead">{directory.lead}</p>
        </div>
        <div className="dir-grid">
          {directory.cards.map((d) => <DirCard key={d.slug} d={d} />)}
        </div>
      </div>
    </section>
  );
}
