import { CalendarEventDisplay } from "../../intel/CalendarEventDisplay.jsx";

export function EmbeddedCalendarBlockView({
  displayModel,
  linkedNodeId = null,
  onRemove,
  onEditAsText,
  removeLabel = "Remove from document",
  editLabel = "Edit as text",
}) {
  if (!displayModel) return null;

  return (
    <div className="doc-embedded-calendar">
      <CalendarEventDisplay model={displayModel} className="doc-embedded-calendar__body" />
      <div className="doc-embedded-calendar__actions">
        {onEditAsText ? (
          <button
            type="button"
            className="doc-embedded-calendar__edit btn xs ghost"
            onClick={onEditAsText}
          >
            {editLabel}
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="doc-embedded-calendar__remove btn xs ghost"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
