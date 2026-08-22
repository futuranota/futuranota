const IMAGE_URL = /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?\S*)?|https?:\/\/assets\.tina\.io\/\S+)$/i;

function isImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (IMAGE_URL.test(text)) return true;
  return /^https?:\/\/assets\.tina\.io\//i.test(text);
}

/** Tina image fields may be a path string or { src } object. */
export function resolveTinaImage(raw) {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object' && typeof raw.src === 'string' && raw.src.trim()) {
    return raw.src.trim();
  }
  return null;
}

export function blogBlockKind(block) {
  if (!block || typeof block !== 'object') return '';
  if (block._template) return String(block._template);
  const type = String(block.__typename || '');
  if (/heading$/i.test(type)) return 'heading';
  if (/paragraph$/i.test(type)) return 'paragraph';
  if (/image$/i.test(type)) return 'image';
  return '';
}

export function bodyToBlocks(body) {
  if (!body || typeof body !== 'string') return [];
  return body
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (
      isImageUrl(part)
        ? { _template: 'image', src: part, alt: '', caption: '' }
        : { _template: 'paragraph', text: part }
    ));
}

export function articleBlocks(article) {
  if (Array.isArray(article?.blocks) && article.blocks.length) return article.blocks;
  return bodyToBlocks(article?.body);
}
