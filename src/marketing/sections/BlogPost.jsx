import { Link } from 'react-router-dom';
import { getBlogPageCategories } from '../lib/content.js';
import { PATHS } from '../lib/paths.js';
import { blogBlockTinaProps, blogTinaProps } from '../context/TinaVisualEditing.jsx';
import { articleBlocks, blogBlockKind, resolveTinaImage } from '../lib/blogBlocks.js';
import { BlogLazyImage, blogImageSrc } from '../components/BlogLazyImage.jsx';

function BlogBlock({ block, index }) {
  const kind = blogBlockKind(block);

  if (kind === 'heading' && block.text) {
    return (
      <h2 className="h3 blog-post__h" {...blogBlockTinaProps(index, 'text')}>
        {block.text}
      </h2>
    );
  }

  if (kind === 'paragraph' && block.text) {
    return (
      <p className="blog-post__p muted" {...blogBlockTinaProps(index, 'text')}>
        {block.text}
      </p>
    );
  }

  if (kind === 'image') {
    const src = resolveTinaImage(block.src);
    if (!src) return null;
    return (
      <figure className="blog-post__figure" {...blogBlockTinaProps(index, 'src')}>
        <BlogLazyImage
          src={src}
          alt={block.alt || ''}
          mediaClassName="blog-post__inline-media blog-card__media"
        />
        {block.caption ? (
          <figcaption className="blog-post__caption faint mono-sm" {...blogBlockTinaProps(index, 'caption')}>
            {block.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return null;
}

/**
 * @param {{ article: Record<string, unknown> }} props
 */
export function BlogPost({ article }) {
  const categories = getBlogPageCategories();
  const blocks = articleBlocks(article);

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

        <div {...blogTinaProps('image')}>
          <BlogLazyImage
            src={blogImageSrc(article)}
            alt={article.title}
            mediaClassName="blog-post__hero blog-card__media"
          />
        </div>

        <div className="blog-post__body prose" {...blogTinaProps('blocks')}>
          {blocks.map((block, index) => (
            <BlogBlock
              key={`${blogBlockKind(block)}-${index}`}
              block={block}
              index={index}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
