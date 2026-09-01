/**
 * Marker (highlighter) palette for doc / node text blocks.
 * Ink is applied as text color in the mirror — never background wash.
 */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   swatch: string,
 *   text: string,
 * }} DocTextMarkerColor */

/** @type {DocTextMarkerColor[]} */
export const DOC_TEXT_MARKER_COLORS = [
  {
    id: "yellow",
    label: "Yellow",
    swatch: "#ffd60a",
    text: "#ffd60a",
  },
  {
    id: "mint",
    label: "Mint",
    swatch: "#85da99",
    text: "#85da99",
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#e0b4b4",
    text: "#e0b4b4",
  },
  {
    id: "blue",
    label: "Blue",
    swatch: "#7aa8ff",
    text: "#7aa8ff",
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
