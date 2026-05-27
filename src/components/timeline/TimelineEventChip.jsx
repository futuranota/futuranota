/** Figma timeline chip: sphere + name + date (horizontal, no stacked preview). */
export function TimelineEventChip({
  name,
  dateLabel,
  objectTint,
  focused = false,
  onClick,
  onKeyDown,
}) {
  const sphereStyle = objectTint
    ? {
      background: `linear-gradient(145deg, color-mix(in oklab, ${objectTint} 35%, #f5e6c8), color-mix(in oklab, ${objectTint} 55%, #9a8f76))`,
    }
    : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      className={"tl-event-chip" + (focused ? " is-focused" : "")}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="tl-chip-node" style={sphereStyle} aria-hidden />
      <span className="tl-chip-name">{name}</span>
      {dateLabel ? <span className="tl-chip-date">{dateLabel}</span> : null}
    </div>
  );
}
