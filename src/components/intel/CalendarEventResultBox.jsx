import { CalendarEventDisplay } from "./CalendarEventDisplay.jsx";
import {
  getCalendarEventDisplayModel,
  parseScopeBriefText,
} from "../../lib/calendarEventDisplay.js";

export function CalendarEventResultBox({ result, onInsert, showInsert = true }) {
  const model = result?.displayModel
    || result?.scopeBrief?.displayModel
    || (result?.scopeBrief?.body ? parseScopeBriefText(result.scopeBrief.body) : null);

  if (!model && !result?.scopeBrief?.body) return null;

  return (
    <div className="cal-event-result" role="status">
      {model ? (
        <CalendarEventDisplay model={model} />
      ) : (
        <p className="cal-event-result__scope-body">{result.scopeBrief.body}</p>
      )}
      {showInsert && onInsert && result?.event ? (
        <button
          type="button"
          className="cal-event-result__insert btn xs"
          onClick={onInsert}
        >
          Insert node
        </button>
      ) : null}
    </div>
  );
}
