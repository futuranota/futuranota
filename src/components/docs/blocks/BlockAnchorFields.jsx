/** Optional date/time anchor for Title and Checkbox blocks (node + wires). */
export function BlockAnchorFields({
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  readOnly = false,
  className = "",
  showContentToggle = false,
  contentExpanded = true,
  onContentToggle,
}) {
  const rootClass = [
    "doc-block-anchor",
    readOnly ? "doc-block-anchor--readonly" : "",
    showContentToggle ? "doc-block-anchor--with-toggle" : "",
    showContentToggle && !contentExpanded ? "doc-block-anchor--content-collapsed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {showContentToggle ? (
        <button
          type="button"
          className="doc-block-anchor__content-toggle"
          onClick={() => {
            // #region agent log
            fetch("http://127.0.0.1:7764/ingest/1d5b49ee-76e8-4907-8f7a-6cd7282ea736", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a58ec5" },
              body: JSON.stringify({
                sessionId: "a58ec5",
                location: "BlockAnchorFields.jsx:toggle",
                message: "chevron-click",
                data: { contentExpanded, willCollapse: contentExpanded },
                hypothesisId: "F",
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
            onContentToggle?.();
          }}
          aria-expanded={contentExpanded}
          aria-label={contentExpanded ? "Collapse document content" : "Expand document content"}
          title={contentExpanded ? "Collapse content" : "Expand content"}
        >
          <span className="doc-block-anchor__content-chevron" aria-hidden>
            ^
          </span>
        </button>
      ) : null}
      <span className="doc-block-anchor__label">Schedule</span>
      <input
        type="date"
        className="doc-block-anchor__date"
        value={anchorDate}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : 0}
        aria-readonly={readOnly}
        onChange={readOnly ? undefined : (e) => onAnchorDateChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label="Anchor date"
      />
      <input
        type="time"
        className="doc-block-anchor__time"
        value={anchorTime}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : 0}
        aria-readonly={readOnly}
        onChange={readOnly ? undefined : (e) => onAnchorTimeChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label="Anchor time"
      />
    </div>
  );
}
