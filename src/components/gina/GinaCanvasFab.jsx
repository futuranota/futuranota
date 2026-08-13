/**
 * Canvas-corner shortcut to the dashboard Gina chat (no auto-prompt).
 */
export function GinaCanvasFab({ onOpen, label, title }) {
  if (typeof onOpen !== "function") return null;
  return (
    <button
      type="button"
      className="gina-canvas-fab"
      onClick={onOpen}
      title={title || label}
      aria-label={title || label}
    >
      <span className="gina-canvas-fab__label">{label}</span>
    </button>
  );
}
