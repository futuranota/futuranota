import { getMarketplace } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

function normalizeProduct(p = {}) {
  return {
    title: p.title ?? '',
    desc: p.desc ?? '',
    price: p.price ?? '',
    rating: p.rating ?? '—',
    reviews: p.reviews ?? 0,
    includes: Array.isArray(p.includes) ? p.includes : [],
    free: Boolean(p.free),
    hot: Boolean(p.hot),
  };
}

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
  const pageTina = usePageTina();
  const fallback = getMarketplace();
  const raw = pageTina?.document ?? fallback;
  const header = { ...fallback.header, ...raw.header };
  const products = (raw.products ?? fallback.products ?? []).map((p, i) =>
    normalizeProduct({ ...fallback.products?.[i], ...p }),
  );

  return (
    <section className="section marketplace" id="marketplace" data-screen-label="marketplace">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow" {...pageTinaProps('header.eyebrow')}><span className="tick" />{header.eyebrow}</span>
            <h2 className="h2" {...pageTinaProps('header.title')}>{header.title}</h2>
            <p className="lead" {...pageTinaProps('header.lead')}>{header.lead}</p>
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
