/**
 * @param {string|null|undefined} value
 */
export function beautifyCalendarDate(value) {
  if (!value || typeof value !== "string") return "";
  let text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.replace(/\s*[·•]\s*/g, " ").trim();
  }
  return text
    .replace(/\s*[·•]\s*/g, " ")
    .replace(/\s*[–—]\s*/g, " to ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string|null|undefined} value
 */
export function beautifyCalendarEventName(value) {
  if (!value || typeof value !== "string") return "";
  return value
    .replace(/^Event(?:o)?\s*\[\d+\]:\s*/i, "")
    .replace(/\s*[·•]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
