import { Link } from 'react-router-dom';
import { getBlogPageCategories } from '../lib/content.js';
import { PATHS } from '../lib/paths.js';
import { blogTinaProps } from '../context/TinaVisualEditing.jsx';

function BlogBody({ body }) {
  if (!body) return null;
  return body.split('\n\n').filter(Boolean).map((paragraph) => (
    <p key={paragraph.slice(0, 48)} className="blog-post__p muted">
      {paragraph}
    </p>
  ));
}

/**
 * @param {{ article: Record<string, unknown> }} props
 */
export function BlogPost({ article }) {
  const categories = getBlogPageCategories();

  return (
    <article className="section blog-post" data-screen-label="blog-post">
      <div className="container blog-post__wrap">
        <Link to={PATHS.blogs} className="link-arrow blog-post__back mono-sm">
          <span className="arrow">←</span> All articles
        </Link>

        <header className="blog-post__head">
          <div className="eyebrow-row">
            {(article.cat || []).map((c) => {
              const label = categories.find((x) => x.id === c)?.label || c;
              return (
                <span key={c} className="chip chip--accent" {...blogTinaProps('cat')}>
                  {label}
                </span>
              );
            })}
          </div>
          <h1 className="display blog-post__title" {...blogTinaProps('title')}>
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="lead blog-post__excerpt" {...blogTinaProps('excerpt')}>
              {article.excerpt}
            </p>
          ) : null}
          <div className="blog__meta mono-sm faint blog-post__meta">
            By <span {...blogTinaProps('author')}>{article.author}</span>
            {' · '}
            <span {...blogTinaProps('read')}>{article.read}</span> read
          </div>
        </header>

        <div className="blog-post__hero ph" style={{ aspectRatio: '16 / 7' }}>
          <span className="ph__tag">article image</span>
        </div>

        <div className="blog-post__body prose" {...blogTinaProps('body')}>
          <BlogBody body={article.body} />
        </div>
      </div>
    </article>
  );
}
