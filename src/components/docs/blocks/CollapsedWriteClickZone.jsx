/** Click target to start writing while schedule content is collapsed. */
export function CollapsedWriteClickZone({ onActivate, placeholder }) {
  return (
    <div
      role="button"
      tabIndex={-1}
      className="doc-collapsed-write-clickzone"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        // #region agent log
        fetch("http://127.0.0.1:7764/ingest/1d5b49ee-76e8-4907-8f7a-6cd7282ea736", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a58ec5" },
          body: JSON.stringify({
            sessionId: "a58ec5",
            runId: "post-fix-v2",
            location: "CollapsedWriteClickZone.jsx:click",
            message: "clickzone-activate",
            data: {},
            hypothesisId: "B,F",
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        onActivate?.();
      }}
      aria-label={placeholder || "Start writing"}
    >
      <span className="doc-collapsed-write-clickzone__hint">
        {placeholder || "Click to write…"}
      </span>
    </div>
  );
}
