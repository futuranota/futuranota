import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getBlogArticles, getBlogPageCategories, getBlogsPage } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

function countForCategory(catId, articles, categories) {
  if (catId === 'All') return articles.length;
  return articles.filter((a) => a.cat.includes(catId)).length;
}

export function Blogs() {
  const pageTina = usePageTina();
  const doc = pageTina?.document;
  const { wall } = doc ?? getBlogsPage();
  const categories = getBlogPageCategories();
  const articles = getBlogArticles();

  const [searchParams] = useSearchParams();
  const catFromUrl = searchParams.get('cat');
  const initial = categories.some((c) => c.id === catFromUrl) ? catFromUrl : 'All';
  const [active, setActive] = useState(initial);

  useEffect(() => {
    if (catFromUrl && categories.some((c) => c.id === catFromUrl)) {
      setActive(catFromUrl);
    }
  }, [catFromUrl, categories]);

  const list = articles.filter((a) => active === 'All' || a.cat.includes(active));
  const featured = list.find((a) => a.feat) || list[0];
  const rest = list.filter((a) => a !== featured);

  return (
    <section className="section blogs" id="blogs" data-screen-label="blogs">
      <div className="container blogs__grid">
        <aside className="blogs__wall">
          <div className="blogs__wall-inner">
            <span className="eyebrow" {...pageTinaProps('wall.eyebrow')}><span className="tick" />{wall.eyebrow}</span>
            <h2 className="h3 blogs__wall-title" {...pageTinaProps('wall.title')}>{wall.title}</h2>

            <nav className="blogs__cats" aria-label="Blog categories">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`blogs__cat${active === c.id ? ' is-active' : ''}`}
                  onClick={() => setActive(c.id)}
                >
                  <span>{c.label}</span>
                  <span className="mono-sm faint">{countForCategory(c.id, articles, categories)}</span>
                </button>
              ))}
            </nav>
            <Link to="/blogs" className="link-arrow" style={{ fontSize: 14 }}>{wall.viewAllLabel} <span className="arrow">→</span></Link>
          </div>
        </aside>
        <div className="blogs__list">
          {featured && (
            <article className="blog-feat card" data-screen-label="blog-featured">
              <div className="blog-feat__img ph"><span className="ph__tag">featured image</span></div>
              <div className="blog-feat__body">
                <div className="eyebrow-row">
                  {featured.cat.map((c) => {
                    const label = categories.find((x) => x.id === c)?.label || c;
                    return <span key={c} className="chip chip--accent">{label}</span>;
                  })}
                </div>
                <h3 className="h2 blog-feat__title" style={{ fontSize: 'clamp(24px,2.6vw,34px)' }}>{featured.title}</h3>
                <div className="blog__meta mono-sm faint">By {featured.author} · {featured.read} read</div>
                <a href="#" className="link-arrow">Read article <span className="arrow">→</span></a>
              </div>
            </article>
          )}
          <div className="blog-grid">
            {rest.map((a, i) => (
              <article className="blog card" key={a.title} data-screen-label={`blog-${i}`}>
                <div className="blog__img ph"><span className="ph__tag">image</span></div>
                <div className="blog__body">
                  <div className="eyebrow-row">
                    {a.cat.map((c) => {
                      const label = categories.find((x) => x.id === c)?.label || c;
                      return <span key={c} className="chip">{label}</span>;
                    })}
                  </div>
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
