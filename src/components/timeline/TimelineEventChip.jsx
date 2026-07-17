/** Simple calendar glyph for time-marker chips. */
export function TimelineCalendarIcon({ className = "" }) {
  return (
    <svg
      className={"tl-chip-calendar-icon" + (className ? ` ${className}` : "")}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

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
  statusBadge = null,
  leadingIcon = null,
  className = "",
  onClick,
  onDoubleClick,
  onKeyDown,
  onRemove,
  removeLabel = "Remove from timeline",
  title,
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
          + (onRemove ? " has-remove" : "")
          + (leadingIcon ? " has-leading-icon" : "")
          + (className ? ` ${className}` : "")
        }
        style={cardStyle}
        data-tl-anchor={dataAnchor || undefined}
        data-tl-status={statusBadge || undefined}
        title={title || undefined}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <span className="tl-chip-card-accent" aria-hidden />
        {leadingIcon ? (
          <span className="tl-chip-card-icon" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}
        <span className="tl-chip-card-body">
          <span className="tl-chip-card-title">{name}</span>
          {!compact && dateLabel ? (
            <span className="tl-chip-card-date">{dateLabel}</span>
          ) : null}
        </span>
        {onRemove ? (
          <button
            type="button"
            className="tl-chip-remove"
            aria-label={removeLabel}
            title={removeLabel}
            onClick={onRemove}
          >
            ×
          </button>
        ) : null}
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
      className={
        "tl-event-chip"
        + (focused ? " is-focused" : "")
        + (leadingIcon ? " has-leading-icon" : "")
      }
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      {leadingIcon ? (
        <span className="tl-chip-card-icon" aria-hidden>
          {leadingIcon}
        </span>
      ) : (
        <span className="tl-chip-node" style={sphereStyle} aria-hidden />
      )}
      <span className="tl-chip-name">{name}</span>
      {dateLabel ? <span className="tl-chip-date">{dateLabel}</span> : null}
    </div>
  );
}
