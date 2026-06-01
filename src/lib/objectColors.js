/** Primary corpus object (main campaign container) — light green */
export const OBJECT_COLOR_CORPUS = "#8ee9a3";

/** Secondary / prototype / satellite objects — neutral gray */
export const OBJECT_COLOR_SATELLITE = "#9ca3af";

export const OBJECT_ROLE_CORPUS = "corpus";
export const OBJECT_ROLE_SATELLITE = "satellite";

/**
 * Default color for a new object: first object is corpus green, rest are satellite gray.
 * @param {number} existingObjectCount
 */
export function resolveDefaultObjectColor(existingObjectCount = 0) {
  return existingObjectCount === 0 ? OBJECT_COLOR_CORPUS : OBJECT_COLOR_SATELLITE;
}

/**
 * @param {{ role?: string, color?: string }} object
 */
export function resolveObjectStroke(object) {
  if (object?.color) return object.color;
  if (object?.role === OBJECT_ROLE_CORPUS) return OBJECT_COLOR_CORPUS;
  return OBJECT_COLOR_SATELLITE;
}

export function softColorFromStroke(stroke) {
  return `${stroke}22`;
}

export function isCorpusColor(stroke) {
  return stroke === OBJECT_COLOR_CORPUS || stroke?.toLowerCase() === "#8ee9a3";
}
