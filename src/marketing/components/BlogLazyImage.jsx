import { useState } from 'react';
import { resolveTinaImage } from '../lib/blogBlocks.js';

const FALLBACK = 'https://placehold.co/640x360/1a1a1a/666666?text=Blog';

/** @deprecated use resolveTinaImage from blogBlocks.js */
export function blogImageValue(article) {
  return resolveTinaImage(article?.image);
}

export function blogImageSrc(article) {
  const image = resolveTinaImage(article?.image);
  if (image) return image;
  if (article?.slug) {
    return `https://picsum.photos/seed/${encodeURIComponent(article.slug)}/640/360`;
  }
  return FALLBACK;
}

export function BlogLazyImage({ src, alt, mediaClassName = 'blog-card__media' }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveTinaImage(src) || src;
  const imgSrc = failed ? FALLBACK : resolved;

  return (
    <div className={mediaClassName}>
      <img
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
