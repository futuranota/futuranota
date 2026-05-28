/** Optional date/time anchor for Title and Checkbox blocks (node + wires). */
export function BlockAnchorFields({
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  className = "",
}) {
  return (
    <div className={`doc-block-anchor ${className}`.trim()}>
      <span className="doc-block-anchor__label">Schedule</span>
      <input
        type="date"
        className="doc-block-anchor__date"
        value={anchorDate}
        onChange={(e) => onAnchorDateChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label="Anchor date"
      />
      <input
        type="time"
        className="doc-block-anchor__time"
        value={anchorTime}
        onChange={(e) => onAnchorTimeChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label="Anchor time"
      />
    </div>
  );
}
