/** Primary corpus object (main campaign container) — light green */
export const OBJECT_COLOR_CORPUS = "#8ee9a3";

/** Secondary / prototype / satellite objects — neutral gray */
export const OBJECT_COLOR_SATELLITE = "#9ca3af";

export const OBJECT_ROLE_CORPUS = "corpus";
export const OBJECT_ROLE_SATELLITE = "satellite";

/**
 * Soft tag styles for canvas `.cnode-parent-tag` by object family index.
 * Index 0 (first / corpus) uses default CSS — no override.
 * @type {Array<null | { background: string, border: string, kindColor: string }>}
 */
export const PARENT_TAG_FAMILY_STYLES = [
  null,
  {
    background: "color-mix(in oklab, #f5e6a8 55%, transparent)",
    border: "1px solid color-mix(in oklab, #e6c84a 45%, transparent)",
    kindColor: "#c9a020",
  },
  {
    background: "color-mix(in oklab, #e8d4ff 50%, transparent)",
    border: "1px solid color-mix(in oklab, #c9a0ff 42%, transparent)",
    kindColor: "#a878e0",
  },
  {
    background: "color-mix(in oklab, #b8f0ea 48%, transparent)",
    border: "1px solid color-mix(in oklab, #6dd5c8 40%, transparent)",
    kindColor: "#3db8a8",
  },
  {
    background: "color-mix(in oklab, #ffd4e0 50%, transparent)",
    border: "1px solid color-mix(in oklab, #ff9eb5 42%, transparent)",
    kindColor: "#e87898",
  },
  {
    background: "color-mix(in oklab, #ffe0c4 52%, transparent)",
    border: "1px solid color-mix(in oklab, #f0a878 40%, transparent)",
    kindColor: "#d88840",
  },
  {
    background: "color-mix(in oklab, #cce0ff 50%, transparent)",
    border: "1px solid color-mix(in oklab, #7aa8ff 40%, transparent)",
    kindColor: "#5a88e0",
  },
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

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

/**
 * @param {Record<string, { id: string, createdAt?: string }>} objectsById
 * @returns {{ id: string, createdAt?: string }[]}
 */
export function sortObjectsByCreatedAt(objectsById = {}) {
  return Object.values(objectsById)
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

/**
 * Stable palette slot for an object (0 = first / default tag styling).
 * @param {string} objectId
 * @param {Record<string, { id: string, createdAt?: string }>} objectsById
 */
export function resolveObjectFamilyIndex(objectId, objectsById = {}) {
  if (!objectId) return -1;
  return sortObjectsByCreatedAt(objectsById).findIndex((o) => o.id === objectId);
}

/**
 * Pick a soft tag style for `.cnode-parent-tag` from object family order.
 * First object → null (keeps default blue). Second → yellow, third → next, etc.
 * Extra objects cycle through palette slots 1..n.
 *
 * @param {string | null} objectId
 * @param {Record<string, { id: string, createdAt?: string }>} objectsById
 * @returns {{ style: object, kindStyle: object } | null}
 */
export function resolveParentTagFamilyStyle(objectId, objectsById = {}) {
  const idx = resolveObjectFamilyIndex(objectId, objectsById);
  if (idx <= 0) return null;

  const palette = PARENT_TAG_FAMILY_STYLES;
  const slot = palette[idx]
    ?? palette[1 + (hashString(objectId) % Math.max(1, palette.length - 1))];
  if (!slot) return null;

  return {
    style: {
      background: slot.background,
      border: slot.border,
    },
    kindStyle: {
      color: slot.kindColor,
    },
  };
}

/**
 * @param {object | null | undefined} node
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} nodeEntitiesById
 */
export function resolveCanvasNodeObjectId(node, docsById = {}, nodeEntitiesById = {}) {
  if (!node) return null;
  if (node.canvasKind === "object" && node.objectId) return node.objectId;
  if (node.objectId) return node.objectId;
  if (node.canvasKind === "document") {
    const doc = docsById[node.docId || node.noteId];
    return doc?.parentObjectId || null;
  }
  if (node.noteId && nodeEntitiesById[node.noteId]) {
    const entity = nodeEntitiesById[node.noteId];
    const doc = entity.parentDocId ? docsById[entity.parentDocId] : null;
    return doc?.parentObjectId || null;
  }
  return null;
}

/**
 * @param {object} node
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} objectsById
 * @param {Record<string, object>} nodeEntitiesById
 */
export function resolveCanvasNodeParentTagStyle(node, docsById, objectsById, nodeEntitiesById) {
  const objectId = resolveCanvasNodeObjectId(node, docsById, nodeEntitiesById);
  if (!objectId) return null;
  return resolveParentTagFamilyStyle(objectId, objectsById);
}
