/**
 * Resolve event calendar API keys (supports legacy .env.local names).
 */
export function getPredictHqApiKey() {
  const key = (
    process.env.PREDICTHQ_API_KEY
    || process.env.CALENDAR_API_KEY
    || process.env.Calendar_Api
    || ""
  ).trim();
  return key || null;
}

export function getCalendarificApiKey() {
  const key = (
    process.env.CALENDARIFIC_API_KEY
    || process.env.Calendarific_Api
    || ""
  ).trim();
  return key || null;
}

export function getDefaultEventCountry() {
  return (process.env.EVENT_DEFAULT_COUNTRY || "US").trim().toUpperCase() || "US";
}

export function isEventMockAllowed() {
  return process.env.EVENT_ALLOW_MOCK === "1";
}
