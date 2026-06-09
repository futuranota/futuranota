import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { blogPostPath } from '../../../src/marketing/lib/paths.js';
import { BlogLazyImage, blogImageSrc } from './BlogLazyImage.jsx';

function formatBlogDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function readTimeLabel(read) {
  if (!read) return null;
  return /\bread\b/i.test(read) ? read : `${read} read`;
}

export function BlogCard({ article, screenLabel }) {
  const dateLabel = formatBlogDate(article.createdAt);
  const readLabel = readTimeLabel(article.read);
  const metaParts = [
    article.author ? `by ${article.author}` : null,
    dateLabel,
    readLabel,
  ].filter(Boolean);

  return (
    <Link
      to={blogPostPath(article.slug)}
      className="blog-card"
      data-screen-label={screenLabel}
    >
      <BlogLazyImage src={blogImageSrc(article)} alt={article.title} />
      <div className="blog-card__body">
        {metaParts.length > 0 && (
          <div className="blog-card__meta">
            {metaParts.map((part, index) => (
              <Fragment key={`${part}-${index}`}>
                {index > 0 ? <span className="blog-card__dot" aria-hidden /> : null}
                <span>{part}</span>
              </Fragment>
            ))}
          </div>
        )}
        <h2 className="blog-card__title">{article.title}</h2>
        {article.excerpt ? (
          <p className="blog-card__excerpt">{article.excerpt}</p>
        ) : null}
      </div>
    </Link>
  );
}
