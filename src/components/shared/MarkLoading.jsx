import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Lottie from 'lottie-react';

const LOADING_LOTTIE_SRC = '/logo-json/futura-nota-loading-v2.json';

/**
 * Brand loading animation (Lottie from public/logo-json).
 */
export function MarkLoading({ label = 'Loading…', size = 96, className = '' }) {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LOADING_LOTTIE_SRC)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${LOADING_LOTTIE_SRC}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch((error) => {
        console.warn('[MarkLoading] lottie failed', error?.message || error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={['mark-loading', className].filter(Boolean).join(' ')}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span
        className="mark-loading__stage mark-loading__stage--lottie"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {animationData ? (
          <Lottie
            animationData={animationData}
            loop
            autoplay
            className="mark-loading__lottie"
            style={{ width: size, height: size }}
          />
        ) : (
          <span className="mark-loading__fallback" />
        )}
      </span>
      {label ? (
        <span className="mark-loading__label">{label}</span>
      ) : null}
    </div>
  );
}

/**
 * Full-viewport gate: dim overlay + glass card with MarkLoading.
 * Use during login waits and save delays so the brand motion is visible.
 */
export function MarkLoadingOverlay({
  open = false,
  label = 'Loading…',
  size = 96,
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
