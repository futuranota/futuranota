/**
 * Marker (highlighter) palette for doc / node text blocks.
 * Dark theme: translucent ink under white text — never changes glyph metrics.
 */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   swatch: string,
 *   ink: string,
 *   inkSoft: string,
 * }} DocTextMarkerColor */

/** @type {DocTextMarkerColor[]} */
export const DOC_TEXT_MARKER_COLORS = [
  {
    id: "yellow",
    label: "Yellow",
    swatch: "#ffd60a",
    ink: "rgba(255, 214, 10, 0.32)",
    inkSoft: "rgba(255, 214, 10, 0.16)",
  },
  {
    id: "mint",
    label: "Mint",
    swatch: "#85da99",
    ink: "rgba(133, 218, 153, 0.28)",
    inkSoft: "rgba(133, 218, 153, 0.14)",
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#c7a1a1",
    ink: "rgba(199, 161, 161, 0.30)",
    inkSoft: "rgba(199, 161, 161, 0.15)",
  },
  {
    id: "blue",
    label: "Blue",
    swatch: "#7aa8ff",
    ink: "rgba(122, 168, 255, 0.28)",
    inkSoft: "rgba(122, 168, 255, 0.14)",
  },
];

export const DEFAULT_DOC_TEXT_MARKER_COLOR_ID = DOC_TEXT_MARKER_COLORS[0].id;

export function isDocTextMarkerColorId(value) {
  return DOC_TEXT_MARKER_COLORS.some((color) => color.id === value);
}

export function normalizeDocTextMarkerColorId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return isDocTextMarkerColorId(id) ? id : DEFAULT_DOC_TEXT_MARKER_COLOR_ID;
}

export function getDocTextMarkerColor(id) {
  return DOC_TEXT_MARKER_COLORS.find((color) => color.id === id)
    ?? DOC_TEXT_MARKER_COLORS[0];
}

/** Stable per-range visual seed so two strokes never look identical. */
export function markerStrokeSeed(range) {
  const key = `${range?.start ?? 0}:${range?.end ?? 0}:${range?.colorId ?? ""}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 4;
}
