import { useState } from 'react';

const FALLBACK = 'https://placehold.co/640x360/1a1a1a/666666?text=Blog';

export function blogImageSrc(article) {
  if (article?.image) return article.image;
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
