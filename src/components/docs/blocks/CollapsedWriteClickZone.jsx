/** Click target to start writing while schedule content is collapsed. */
export function CollapsedWriteClickZone({ onActivate, placeholder }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="doc-collapsed-write-clickzone"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        onActivate?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || (e.key.length === 1 && !e.metaKey && !e.ctrlKey)) {
          e.preventDefault();
          onActivate?.();
        }
      }}
      aria-label={placeholder || "Start writing"}
    >
      <span className="doc-collapsed-write-clickzone__hint">
        {placeholder || "Click to write…"}
      </span>
    </div>
  );
}
