import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getBlogPageCategories, getBlogsPage } from '../lib/content.js';
import { useTinaBlogArticles } from '../lib/useTinaBlogArticles.js';
import { BlogFeaturedCard, BlogGridCard } from '../components/BlogArticleCard.jsx';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

function countForCategory(catId, articles, categories) {
  if (catId === 'All') return articles.length;
  return articles.filter((a) => (a.cat || []).includes(catId)).length;
}

export function Blogs() {
  const pageTina = usePageTina();
  const doc = pageTina?.document;
  const { wall } = doc ?? getBlogsPage();
  const categories = getBlogPageCategories();
  const articles = useTinaBlogArticles();

  const [searchParams] = useSearchParams();
  const catFromUrl = searchParams.get('cat');
  const initial = categories.some((c) => c.id === catFromUrl) ? catFromUrl : 'All';
  const [active, setActive] = useState(initial);

  useEffect(() => {
    if (catFromUrl && categories.some((c) => c.id === catFromUrl)) {
      setActive(catFromUrl);
    }
  }, [catFromUrl, categories]);

  const list = articles.filter((a) => active === 'All' || (a.cat || []).includes(active));
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
          {featured ? (
            <BlogFeaturedCard
              article={featured}
              categories={categories}
              screenLabel="blog-featured"
            />
          ) : null}
          <div className="blog-grid">
            {rest.map((a, i) => (
              <BlogGridCard
                key={a.slug}
                article={a}
                categories={categories}
                screenLabel={`blog-${i}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
