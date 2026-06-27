import { CalendarEventDisplay } from "../../intel/CalendarEventDisplay.jsx";

export function EmbeddedCalendarBlockView({
  displayModel,
  linkedNodeId = null,
  onRemove,
}) {
  if (!displayModel) return null;

  return (
    <div className="doc-embedded-calendar">
      <CalendarEventDisplay model={displayModel} className="doc-embedded-calendar__body" />
      {onRemove ? (
        <button
          type="button"
          className="doc-embedded-calendar__remove btn xs ghost"
          onClick={onRemove}
        >
          Remove from document
        </button>
      ) : null}
    </div>
  );
}
