import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getBlogArticles, getBlogPageCategories, getBlogsPage } from '../../../src/marketing/lib/content.js';
import { BlogCard } from './BlogCard.jsx';
import { usePageTina, pageTinaProps } from '../../../src/marketing/context/TinaVisualEditing.jsx';

function countForCategory(catId, articles) {
  if (catId === 'All') return articles.length;
  return articles.filter((a) => a.cat.includes(catId)).length;
}

function sortArticles(articles) {
  return [...articles].sort((a, b) => {
    if (a.feat && !b.feat) return -1;
    if (!a.feat && b.feat) return 1;
    return 0;
  });
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

  const list = useMemo(() => {
    const filtered = articles.filter((a) => active === 'All' || a.cat.includes(active));
    return sortArticles(filtered);
  }, [active, articles]);

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
                  <span className="mono-sm faint">{countForCategory(c.id, articles)}</span>
                </button>
              ))}
            </nav>
            <Link to="/blogs" className="link-arrow" style={{ fontSize: 14 }}>{wall.viewAllLabel} <span className="arrow">→</span></Link>
          </div>
        </aside>
        <div className="blogs__list">
          <div className="blog-card-grid">
            {list.map((article, index) => (
              <BlogCard
                key={article.slug}
                article={article}
                screenLabel={article.feat ? 'blog-featured' : `blog-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
