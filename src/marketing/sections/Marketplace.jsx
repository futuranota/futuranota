import { getMarketplace } from '../lib/content.js';

function ProductCard({ p }) {
  return (
    <article className="prod card" data-screen-label={`product-${p.title}`}>
      <div className="prod__preview ph" style={{ aspectRatio: '16 / 10' }}>
        <span className="ph__tag">template preview</span>
        {p.free && <span className="chip chip--signal prod__badge">Free sample</span>}
        {p.hot && !p.free && <span className="chip chip--accent prod__badge"><span className="pulse" style={{ background: 'var(--accent)' }} />Best seller</span>}
      </div>
      <div className="prod__body">
        <h3 className="h3 prod__title">{p.title}</h3>
        <p className="muted prod__desc">{p.desc}</p>
        <div className="prod__includes">
          {p.includes.map((i) => <span className="chip" key={i}>{i}</span>)}
        </div>
        <div className="prod__foot">
          <div className="prod__meta">
            <span className="prod__price">{p.price}</span>
            <span className="mono-sm faint">★ {p.rating} · {p.reviews} reviews</span>
          </div>
          <div className="prod__cta">
            <a href="#" className="btn btn-sm btn-primary">Download &amp; import</a>
            <a href="#" className="btn btn-ghost btn-sm">Preview</a>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Marketplace() {
  const { header, products } = getMarketplace();

  return (
    <section className="section marketplace" id="marketplace" data-screen-label="marketplace">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow"><span className="tick" />{header.eyebrow}</span>
            <h2 className="h2">{header.title}</h2>
            <p className="lead">{header.lead}</p>
          </div>
          <a href="#" className="link-arrow block-head__link">{header.linkLabel} <span className="arrow">→</span></a>
        </div>
        <div className="prod-grid grid">
          {products.map((p) => <ProductCard key={p.title} p={p} />)}
        </div>
      </div>
    </section>
  );
}
