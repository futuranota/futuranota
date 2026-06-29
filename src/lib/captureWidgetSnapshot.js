import html2canvas from "html2canvas";
import { isCalendarEventNodeContent } from "./eventCalendarSearch.js";
import { isWeatherForecastNodeContent } from "./forecastSearch.js";

/** @typedef {'weather-forecast'|'calendar-event'|'unknown'} WidgetSnapshotKind */

export const WIDGET_SNAPSHOT_KIND = "widget-snapshot";

/**
 * @param {object|null|undefined} block
 */
export function isEmbeddableWidgetBlock(block) {
  return block?.embedded?.kind === "calendar-event"
    || block?.embedded?.kind === "weather-forecast"
    || isCalendarEventNodeContent(block?.text)
    || isWeatherForecastNodeContent(block?.text);
}

/**
 * @param {object|null|undefined} block
 * @returns {WidgetSnapshotKind}
 */
export function resolveEmbeddedWidgetKind(block) {
  if (block?.embedded?.kind === "weather-forecast") return "weather-forecast";
  if (block?.embedded?.kind === "calendar-event") return "calendar-event";
  if (isWeatherForecastNodeContent(block?.text)) return "weather-forecast";
  if (isCalendarEventNodeContent(block?.text)) return "calendar-event";
  return "unknown";
}

/**
 * @param {HTMLElement|null|undefined} element
 * @returns {Promise<string|null>}
 */
export async function captureElementToPngDataUrl(element) {
  if (!element || typeof document === "undefined") return null;

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const canvas = await html2canvas(element, {
    backgroundColor: "#151515",
    scale: Math.min(2, window.devicePixelRatio || 1),
    logging: false,
    useCORS: true,
    scrollX: 0,
    scrollY: 0,
    width: element.scrollWidth,
    height: element.scrollHeight,
  });

  return canvas.toDataURL("image/png");
}

/**
 * @param {string} blockId
 * @returns {Promise<string|null>}
 */
export async function captureDocBlockWidgetSnapshot(blockId) {
  if (!blockId || typeof document === "undefined") return null;

  const captureEl = document.querySelector(
    `[data-block-id="${blockId}"] [data-widget-capture-root]`,
  );
  if (!(captureEl instanceof HTMLElement)) return null;

  return captureElementToPngDataUrl(captureEl);
}

/**
 * @param {object} block
 * @param {string|null} snapshotSrc
 * @returns {object|null}
 */
export function buildDetachedWidgetEmbedded(block, snapshotSrc) {
  const widgetKind = resolveEmbeddedWidgetKind(block);
  const alt = block?.text || "";

  if (snapshotSrc) {
    return buildWidgetSnapshotEmbedded(snapshotSrc, widgetKind, alt);
  }

  if (block?.embedded) {
    return { ...block.embedded, linkedNodeId: null };
  }

  return null;
}

/**
 * @param {string} src
 * @param {WidgetSnapshotKind} [widgetKind]
 * @param {string} [alt]
 */
export function buildWidgetSnapshotEmbedded(src, widgetKind = "unknown", alt = "") {
  return {
    kind: WIDGET_SNAPSHOT_KIND,
    src,
    widgetKind,
    alt: alt || "",
  };
}

/**
 * @param {unknown} embedded
 */
export function isWidgetSnapshotEmbedded(embedded) {
  return embedded?.kind === WIDGET_SNAPSHOT_KIND && typeof embedded?.src === "string";
}
