/** Optional date/time anchor for Title and Checkbox blocks (node + wires). */
export function BlockAnchorFields({
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  readOnly = false,
  className = "",
  hideLabel = false,
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
          onClick={() => onContentToggle?.()}
          aria-expanded={contentExpanded}
          aria-label={contentExpanded ? "Collapse document content" : "Expand document content"}
          title={contentExpanded ? "Collapse content" : "Expand content"}
        >
          <span className="doc-block-anchor__content-chevron" aria-hidden />
        </button>
      ) : null}
      {hideLabel ? null : (
        <span className="doc-block-anchor__label">Schedule</span>
      )}
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
