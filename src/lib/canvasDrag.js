export const CANVAS_DRAG_MIME = "application/x-futura-nota";

/** @param {DataTransfer} dt */
export function setCanvasDragData(dt, payload) {
  dt.setData(CANVAS_DRAG_MIME, JSON.stringify(payload));
  dt.effectAllowed = "copy";
}

/** @param {DataTransfer} dt */
export function readCanvasDragData(dt) {
  const raw = dt.getData(CANVAS_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasCanvasDrag(dt) {
  return dt.types.includes(CANVAS_DRAG_MIME);
}
