/** Timeline chip — sphere (legacy tracks) or tactical card (rectangular). */
export function TimelineEventChip({
  name,
  dateLabel,
  objectTint,
  familyAccent,
  variant = "sphere",
  compact = false,
  focused = false,
  dataAnchor,
  onClick,
  onDoubleClick,
  onKeyDown,
}) {
  if (variant === "card") {
    const cardStyle = familyAccent
      ? {
        "--tl-family-accent": familyAccent,
        borderLeftColor: familyAccent,
      }
      : objectTint
        ? { "--tl-family-accent": objectTint, borderLeftColor: objectTint }
        : undefined;

    return (
      <div
        role="button"
        tabIndex={0}
        className={
          "tl-event-chip tl-event-chip--card"
          + (compact ? " is-compact" : "")
          + (focused ? " is-focused" : "")
        }
        style={cardStyle}
        data-tl-anchor={dataAnchor || undefined}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <span className="tl-chip-card-accent" aria-hidden />
        <span className="tl-chip-card-body">
          <span className="tl-chip-card-title">{name}</span>
          {!compact && dateLabel ? (
            <span className="tl-chip-card-date">{dateLabel}</span>
          ) : null}
        </span>
      </div>
    );
  }

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
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <span className="tl-chip-node" style={sphereStyle} aria-hidden />
      <span className="tl-chip-name">{name}</span>
      {dateLabel ? <span className="tl-chip-date">{dateLabel}</span> : null}
    </div>
  );
}
