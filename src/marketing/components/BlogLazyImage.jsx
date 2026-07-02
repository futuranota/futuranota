import { useState } from 'react';

const FALLBACK = 'https://placehold.co/640x360/1a1a1a/666666?text=Blog';

/** Tina image fields may be a path string or { src } object. */
export function blogImageValue(article) {
  const raw = article?.image;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object' && typeof raw.src === 'string' && raw.src.trim()) {
    return raw.src.trim();
  }
  return null;
}

export function blogImageSrc(article) {
  const image = blogImageValue(article);
  if (image) return image;
  if (article?.slug) {
    return `https://picsum.photos/seed/${encodeURIComponent(article.slug)}/640/360`;
  }
  return FALLBACK;
}

export function BlogLazyImage({ src, alt, mediaClassName = 'blog-card__media' }) {
  const [failed, setFailed] = useState(false);
  const imgSrc = failed ? FALLBACK : src;

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
