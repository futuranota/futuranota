const PRODUCTS = [
  { title: 'SaaS Startup Launchpad', desc: 'Plan a SaaS from object to launch window.', price: '$49', rating: '4.9', reviews: 324, includes: ['.futura import', 'domain', 'Shopify course'], free: false, hot: true },
  { title: 'Ecommerce Store Setup', desc: 'Storefront, product objects, and drop calendar.', price: '$39', rating: '4.8', reviews: 211, includes: ['.futura import', 'domain', 'email'], free: false, hot: false },
  { title: 'Course Creator Bundle', desc: 'Turn a launch into a small-batch course + merch.', price: '$59', rating: '5.0', reviews: 148, includes: ['.futura import', 'Shopify course'], free: false, hot: true },
  { title: 'AI Agency Framework', desc: 'Productized AI photo & copy service, ready to sell.', price: '$79', rating: '4.7', reviews: 96, includes: ['.futura import', 'domain', 'email'], free: false, hot: false },
  { title: 'Personal Brand Kit', desc: 'Position yourself as the maker behind the window.', price: '$29', rating: '4.9', reviews: 502, includes: ['.futura import', 'domain'], free: false, hot: false },
  { title: 'Maker Starter — Companion Cup', desc: 'Our full coffee-and-cup playbook. Yours free.', price: 'Free', rating: '5.0', reviews: 1280, includes: ['.futura import', 'Shopify course'], free: true, hot: false },
];

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
  return (
    <section className="section marketplace" id="marketplace" data-screen-label="marketplace">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow"><span className="tick" />HORIZON MARKETPLACE</span>
            <h2 className="h2">Ready-made kits. One-click into Futura.</h2>
            <p className="lead">Start from a proven model — the downloadable, the domain, the email, even the course that walks you through importing it to Shopify. Customize for your window, then ship.</p>
          </div>
          <a href="#" className="link-arrow block-head__link">Open marketplace <span className="arrow">→</span></a>
        </div>
        <div className="prod-grid grid">
          {PRODUCTS.map((p) => <ProductCard key={p.title} p={p} />)}
        </div>
      </div>
    </section>
  );
}
