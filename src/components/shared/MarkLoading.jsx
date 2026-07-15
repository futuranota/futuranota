import { createPortal } from "react-dom";
import { Mark } from "../../marketing/components/Mark.jsx";

/**
 * Brand Mark animated as if writing (stroke + marker).
 */
export function MarkLoading({ label = "Loading…", size = 36, className = "" }) {
  return (
    <div
      className={["mark-loading", className].filter(Boolean).join(" ")}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="mark-loading__stage" aria-hidden="true">
        <span className="mark-loading__stroke" />
        <span className="mark-loading__mark">
          <Mark size={size} />
        </span>
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
  label = "Loading…",
  size = 36,
}) {
  if (!open || typeof document === "undefined") return null;

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
