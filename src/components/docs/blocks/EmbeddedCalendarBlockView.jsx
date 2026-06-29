import { CalendarEventDisplay } from "../../intel/CalendarEventDisplay.jsx";

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
        <div className="doc-embedded-calendar__actions">
          <button
            type="button"
            className="doc-embedded-calendar__remove btn xs ghost"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
