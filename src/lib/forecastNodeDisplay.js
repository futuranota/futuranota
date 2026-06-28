import {
  forecastPayloadToResult,
  parseWeatherForecastNodeContent,
} from "./forecastSearch.js";

/**
 * Plain-text preview for sidebar / doc sync (no JSON).
 * @param {unknown} content
 */
export function getForecastDisplayText(content) {
  const payload = parseWeatherForecastNodeContent(content);
  if (!payload) return typeof content === "string" ? content : "";

  const location = payload.location ? ` · ${payload.location}` : "";
  const temps = payload.high != null && payload.low != null
    ? `${payload.high}°/${payload.low}°`
    : "";
  const condition = payload.condition || payload.summary || "";
  const parts = [`${payload.uiDate || "—"}${location}`.trim()];
  if (temps || condition) parts.push([temps, condition].filter(Boolean).join(" "));
  return parts.join(": ").trim();
}

/**
 * @param {object} node
 * @returns {{ text: string, embedded: { kind: string, payload: object, linkedNodeId: string|null } }|null}
 */
export function buildForecastEmbeddedBlockFields(node) {
  const payload = parseWeatherForecastNodeContent(node?.content);
  if (!payload) return null;

  return {
    text: getForecastDisplayText(node.content),
    embedded: {
      kind: "weather-forecast",
      payload,
      linkedNodeId: node.id || null,
    },
  };
}

/**
 * @param {unknown} content
 */
export function getForecastDisplayResult(content) {
  return forecastPayloadToResult(parseWeatherForecastNodeContent(content));
}
