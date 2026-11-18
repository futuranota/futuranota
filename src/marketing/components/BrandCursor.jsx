/** Canonical brand mark — face sticker in /public/logo-json. */
export const BRAND_MARK_SRC = '/logo-json/prompsy-sticker.png';

/** @deprecated Use BRAND_MARK_SRC */
export const BRAND_CURSOR_SRC = BRAND_MARK_SRC;

export function BrandCursor({ size = 36, className = '' }) {
  return (
    <img
      src={BRAND_MARK_SRC}
      alt=""
      width={size}
      height={size}
      className={['fn-brand-cursor', className].filter(Boolean).join(' ')}
      decoding="async"
      draggable={false}
    />
  );
}
