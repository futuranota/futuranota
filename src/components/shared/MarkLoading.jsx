import { createPortal } from 'react-dom';
import { BRAND_MARK_SRC } from '../../marketing/components/BrandCursor.jsx';

/**
 * Brand loading mark (canonical face logo from public/logo-json).
 */
export function MarkLoading({ label = 'Loading…', size = 112, className = '' }) {
  return (
    <div
      className={['mark-loading', className].filter(Boolean).join(' ')}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span
        className="mark-loading__stage mark-loading__stage--mark"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <img
          src={BRAND_MARK_SRC}
          alt=""
          width={size}
          height={size}
          className="mark-loading__logo"
          decoding="async"
          draggable={false}
        />
      </span>
      {label ? (
        <span className="mark-loading__label">{label}</span>
      ) : null}
    </div>
  );
}

/**
 * Full-viewport gate: dim overlay + glass card with MarkLoading.
 * Use during login waits and save delays so the brand mark is visible.
 */
export function MarkLoadingOverlay({
  open = false,
  label = 'Loading…',
  size = 112,
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="mark-loading-overlay" role="presentation">
      <div className="mark-loading-overlay__backdrop" aria-hidden="true" />
      <div className="mark-loading-overlay__card glass" role="status" aria-busy="true">
        <MarkLoading label={label} size={size} />
      </div>
    </div>,
    document.body,
  );
}
