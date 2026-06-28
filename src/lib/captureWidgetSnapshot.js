import html2canvas from "html2canvas";

/** @typedef {'weather-forecast'|'calendar-event'|'unknown'} WidgetSnapshotKind */

export const WIDGET_SNAPSHOT_KIND = "widget-snapshot";

/**
 * @param {HTMLElement|null|undefined} element
 * @returns {Promise<string|null>}
 */
export async function captureElementToPngDataUrl(element) {
  if (!element || typeof document === "undefined") return null;

  const canvas = await html2canvas(element, {
    backgroundColor: "#151515",
    scale: Math.min(2, window.devicePixelRatio || 1),
    logging: false,
    useCORS: true,
  });

  return canvas.toDataURL("image/png");
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
