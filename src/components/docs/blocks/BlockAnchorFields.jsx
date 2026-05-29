/** Optional date/time anchor for Title and Checkbox blocks (node + wires). */
export function BlockAnchorFields({
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  readOnly = false,
  className = "",
}) {
  return (
    <div className={`doc-block-anchor${readOnly ? " doc-block-anchor--readonly" : ""} ${className}`.trim()}>
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
