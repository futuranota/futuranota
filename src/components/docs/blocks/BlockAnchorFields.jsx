/** Optional date/time anchor for Title and Checkbox blocks (node + wires). */
export function BlockAnchorFields({
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  readOnly = false,
  className = "",
  hideLabel = false,
  /** Visible label when hideLabel is false (e.g. "Schedule" or "Launch date"). */
  label = "Schedule",
  showContentToggle = false,
  contentExpanded = true,
  onContentToggle,
  /** YYYY-MM-DD inclusive floor from parent folder reservation (optional). */
  minDate = "",
  /** YYYY-MM-DD inclusive ceiling from parent folder reservation (optional). */
  maxDate = "",
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

  const min = String(minDate || "").trim() || undefined;
  const max = String(maxDate || "").trim() || undefined;

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
        <span className="doc-block-anchor__label">{label}</span>
      )}
      <input
        type="date"
        className="doc-block-anchor__date"
        value={anchorDate}
        min={min}
        max={max}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : 0}
        aria-readonly={readOnly}
        onChange={readOnly ? undefined : (e) => onAnchorDateChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={label === "Launch date" ? "Launch date" : "Anchor date"}
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
        aria-label={label === "Launch date" ? "Launch time" : "Anchor time"}
      />
    </div>
  );
}
