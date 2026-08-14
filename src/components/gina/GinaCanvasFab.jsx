/**
 * Canvas-corner shortcut to the dashboard Gina chat (no auto-prompt).
 */
export function GinaCanvasFab({ onOpen, label, title }) {
  if (typeof onOpen !== "function") return null;
  const a11y = title || label || "Gina";
  return (
    <button
      type="button"
      className="gina-canvas-fab"
      onClick={onOpen}
      title={a11y}
      aria-label={a11y}
    >
      <img
        className="gina-canvas-fab__icon"
        src="/uploads/call center 1.svg"
        alt=""
        aria-hidden
      />
    </button>
  );
}
