import { CalendarEventDisplay } from "../../intel/CalendarEventDisplay.jsx";

const DELETE_ICON = "/uploads/delete.svg";

export function EmbeddedCalendarBlockView({
  displayModel,
  onRemove,
  removeLabel = "Desvincular del documento",
}) {
  if (!displayModel) return null;

  return (
    <div className="doc-embedded-calendar">
      <div className="doc-embedded-calendar__capture" data-widget-capture-root data-widget-kind="calendar-event">
        <CalendarEventDisplay model={displayModel} className="doc-embedded-calendar__body" />
      </div>
      {onRemove ? (
        <button
          type="button"
          className="doc-embedded-calendar__remove-corner"
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
        >
          <img src={DELETE_ICON} alt="" aria-hidden className="doc-embedded-calendar__remove-icon" />
        </button>
      ) : null}
    </div>
  );
}
