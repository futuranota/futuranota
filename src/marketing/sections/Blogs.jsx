import { useState } from 'react';

const CATEGORIES = ['All', 'Shark Tank', 'Ecommerce', 'AI', 'Trends', 'Validation'];

const ARTICLES = [
  { cat: ['Shark Tank', 'AI'], title: 'Shark Tank 2026: the AI-powered winners worth copying', author: 'Rossmery', read: '6 min', feat: true },
  { cat: ['Ecommerce'], title: 'Physical products that are quietly selling out this quarter', author: 'Rossmery', read: '5 min', feat: false },
  { cat: ['Trends'], title: 'How to read a launch campaign before it lands', author: 'Editorial', read: '8 min', feat: false },
  { cat: ['Validation'], title: 'The coffee-and-cup playbook: companion products, explained', author: 'Editorial', read: '7 min', feat: false },
  { cat: ['AI', 'Ecommerce'], title: 'DTC drops worth watching — and the gaps they leave open', author: 'Rossmery', read: '5 min', feat: false },
];

export function Blogs() {
  const [active, setActive] = useState('All');
  const list = ARTICLES.filter((a) => active === 'All' || a.cat.includes(active));
  const featured = list.find((a) => a.feat) || list[0];
  const rest = list.filter((a) => a !== featured);

  return (
    <section className="section blogs" id="blogs" data-screen-label="blogs">
      <div className="container blogs__grid">
        <aside className="blogs__wall">
          <div className="blogs__wall-inner">
            <span className="eyebrow"><span className="tick" />BLOGS</span>
            <h2 className="h3 blogs__wall-title">Shark Tank &amp; the commerce world, as inspiration.</h2>
            <nav className="blogs__cats" aria-label="Blog categories">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={`blogs__cat${active === c ? ' is-active' : ''}`} onClick={() => setActive(c)}>
                  <span>{c}</span>
                  <span className="mono-sm faint">{c === 'All' ? ARTICLES.length : ARTICLES.filter((a) => a.cat.includes(c)).length}</span>
                </button>
              ))}
            </nav>
            <a href="#" className="link-arrow" style={{ fontSize: 14 }}>View all trends <span className="arrow">→</span></a>
          </div>
        </aside>
        <div className="blogs__list">
          {featured && (
            <article className="blog-feat card" data-screen-label="blog-featured">
              <div className="blog-feat__img ph"><span className="ph__tag">featured image</span></div>
              <div className="blog-feat__body">
                <div className="eyebrow-row">{featured.cat.map((c) => <span key={c} className="chip chip--accent">{c}</span>)}</div>
                <h3 className="h2 blog-feat__title" style={{ fontSize: 'clamp(24px,2.6vw,34px)' }}>{featured.title}</h3>
                <div className="blog__meta mono-sm faint">By {featured.author} · {featured.read} read</div>
                <a href="#" className="link-arrow">Read article <span className="arrow">→</span></a>
              </div>
            </article>
          )}
          <div className="blog-grid">
            {rest.map((a, i) => (
              <article className="blog card" key={i} data-screen-label={`blog-${i}`}>
                <div className="blog__img ph"><span className="ph__tag">image</span></div>
                <div className="blog__body">
                  <div className="eyebrow-row">{a.cat.map((c) => <span key={c} className="chip">{c}</span>)}</div>
                  <h4 className="blog__title">{a.title}</h4>
                  <div className="blog__meta mono-sm faint">By {a.author} · {a.read}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const TEACHINGS = [
  ['Marketing 101: zero to your first sale', 'Positioning, channels, and the growth basics that actually move units.', '15 min', 'Beginner'],
  ['How to make money online in 2026', 'The honest map of models that work for makers and small operators.', '12 min', 'Beginner'],
  ['Finding your niche in crowded markets', 'Use the window to find the gap nobody else is making for.', '10 min', 'Intermediate'],
  ['Product validation with Futura Nota', 'Turn a hunch into a tested object before you cut a single board.', '14 min', 'Beginner'],
  ['The Shark Tank pitch framework', 'How winners frame a companion product in under two minutes.', '9 min', 'Intermediate'],
  ['AI tools every maker should know', 'Photography, copy, and research tools that buy back your week.', '11 min', 'Beginner'],
];

export function Ensenanzas() {
  return (
    <section className="section ensenanzas" id="ensenanzas" data-screen-label="ensenanzas">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow"><span className="tick" />ENSEÑANZAS</span>
            <h2 className="h2">Learn to think like an entrepreneur.</h2>
            <p className="lead">The strategies and frameworks behind people who turn a launch into a living. Short, practical, and built for makers.</p>
          </div>
          <a href="#" className="link-arrow block-head__link">Explore all courses <span className="arrow">→</span></a>
        </div>
        <div className="teach-grid grid">
          {TEACHINGS.map(([t, d, time, lvl], i) => (
            <article className="teach card" key={i} data-screen-label={`teach-${i}`}>
              <span className="teach__idx mono-sm">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="h3 teach__title">{t}</h3>
              <p className="muted teach__desc">{d}</p>
              <div className="teach__foot">
                <span className="mono-sm faint">{time} · {lvl}</span>
                <a href="#" className="link-arrow" style={{ fontSize: 14 }}>Start <span className="arrow">→</span></a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
