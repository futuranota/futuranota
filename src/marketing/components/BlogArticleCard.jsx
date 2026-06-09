import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { blogPostPath } from '../lib/paths.js';
import { BlogLazyImage, blogImageSrc } from './BlogLazyImage.jsx';

export function formatBlogDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function readTimeLabel(read) {
  if (!read) return null;
  return /\bread\b/i.test(read) ? read : `${read} read`;
}

export function blogMetaParts(article) {
  return [
    article.author ? `by ${article.author}` : null,
    formatBlogDate(article.createdAt),
    readTimeLabel(article.read),
  ].filter(Boolean);
}

function BlogCategoryTags({ categories, catIds, accent = false }) {
  if (!catIds?.length) return null;
  return (
    <div className="eyebrow-row">
      {catIds.map((c) => {
        const label = categories.find((x) => x.id === c)?.label || c;
        return (
          <span key={c} className={`chip${accent ? ' chip--accent' : ''}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function BlogMetaLine({ parts }) {
  if (!parts.length) return null;
  return (
    <div className="blog-card__meta">
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 ? <span className="blog-card__dot" aria-hidden /> : null}
          <span>{part}</span>
        </Fragment>
      ))}
    </div>
  );
}

export function BlogFeaturedCard({ article, categories, screenLabel = 'blog-featured' }) {
  const metaParts = blogMetaParts(article);

  return (
    <Link
      to={blogPostPath(article.slug)}
      className="blog-feat card"
      data-screen-label={screenLabel}
    >
      <BlogLazyImage
        src={blogImageSrc(article)}
        alt={article.title}
        mediaClassName="blog-feat__img blog-card__media"
      />
      <div className="blog-feat__body">
        <BlogCategoryTags categories={categories} catIds={article.cat} accent />
        <BlogMetaLine parts={metaParts} />
        <h3 className="blog-card__title blog-feat__title">{article.title}</h3>
        {article.excerpt ? (
          <p className="blog-card__excerpt blog-feat__excerpt">{article.excerpt}</p>
        ) : null}
        <span className="link-arrow blog-feat__read">
          Read article <span className="arrow">→</span>
        </span>
      </div>
    </Link>
  );
}

export function BlogGridCard({ article, categories, screenLabel }) {
  const metaParts = blogMetaParts(article);

  return (
    <Link
      to={blogPostPath(article.slug)}
      className="blog card blog-card--grid"
      data-screen-label={screenLabel}
    >
      <BlogLazyImage
        src={blogImageSrc(article)}
        alt={article.title}
        mediaClassName="blog__img blog-card__media"
      />
      <div className="blog__body">
        <BlogCategoryTags categories={categories} catIds={article.cat} />
        <BlogMetaLine parts={metaParts} />
        <h4 className="blog-card__title">{article.title}</h4>
        {article.excerpt ? (
          <p className="blog-card__excerpt">{article.excerpt}</p>
        ) : null}
      </div>
    </Link>
  );
}
