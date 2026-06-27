import { getCalendarEventDisplayModel, parseScopeBriefText } from "../../lib/calendarEventDisplay.js";
import { CalendarEventDisplay } from "./CalendarEventDisplay.jsx";

/**
 * Read-only calendar node view (never raw JSON).
 * @param {{ content?: unknown, text?: string, className?: string }} props
 */
export function CalendarEventNodeView({ content, text, className = "" }) {
  const model = content != null
    ? getCalendarEventDisplayModel(content)
    : parseScopeBriefText(text);

  if (!model) return null;

  return <CalendarEventDisplay model={model} className={className} />;
}
