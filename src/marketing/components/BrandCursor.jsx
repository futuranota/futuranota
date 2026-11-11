/** Teleprompter cursor mark from /public/logo-json. */
export const BRAND_CURSOR_SRC = '/logo-json/futura-nota-teleprompter-logo.svg';

export function BrandCursor({ size = 28, className = '' }) {
  return (
    <img
      src={BRAND_CURSOR_SRC}
      alt=""
      width={size}
      height={size}
      className={['fn-brand-cursor', className].filter(Boolean).join(' ')}
      decoding="async"
      draggable={false}
    />
  );
}
