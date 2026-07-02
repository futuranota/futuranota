import {
  getNodesBounds,
  resolveCanvasNodeSize,
} from "./canvasMath.js";

const DEFAULT_PADDING = 56;
const MIN_BOUNDS_SIZE = 120;

function normalizeNodeList(nodes) {
  if (Array.isArray(nodes)) return nodes;
  return Object.values(nodes || {});
}

/** @param {import('./canvasMath.js').getNodesBounds extends (...args: any) => infer R ? R : never} bounds */
function padBounds(bounds, padding = DEFAULT_PADDING) {
  if (!bounds || (!bounds.width && !bounds.height)) return bounds;
  const w = Math.max(bounds.width, MIN_BOUNDS_SIZE);
  const h = Math.max(bounds.height, MIN_BOUNDS_SIZE);
  const extraW = w - bounds.width;
  const extraH = h - bounds.height;
  return {
    minX: bounds.minX - padding - extraW / 2,
    minY: bounds.minY - padding - extraH / 2,
    maxX: bounds.maxX + padding + extraW / 2,
    maxY: bounds.maxY + padding + extraH / 2,
    width: w + padding * 2,
    height: h + padding * 2,
  };
}

/** @param {Iterable<string>} ids @param {Map<string, Set<string>>} adj */
function connectedComponentsFromIds(ids, adj) {
  const remaining = new Set(ids);
  /** @type {string[][]} */
  const components = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    const stack = [start];
    /** @type {string[]} */
    const comp = [];
    remaining.delete(start);
    while (stack.length) {
      const id = stack.pop();
      comp.push(id);
      for (const next of adj.get(id) || []) {
        if (remaining.has(next)) {
          remaining.delete(next);
          stack.push(next);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

/**
 * @param {{ from?: string, to?: string }[]} connections
 * @param {Set<string>} allowedIds
 */
function buildAdjacency(connections, allowedIds) {
  /** @type {Map<string, Set<string>>} */
  const adj = new Map();
  const touch = (id) => {
    if (!adj.has(id)) adj.set(id, new Set());
  };
  for (const conn of connections || []) {
    const from = conn?.from;
    const to = conn?.to;
    if (!from || !to) continue;
    if (!allowedIds.has(from) || !allowedIds.has(to)) continue;
    touch(from);
    touch(to);
    adj.get(from).add(to);
    adj.get(to).add(from);
  }
  return adj;
}

/**
 * Visible nodes that participate in at least one wire.
 * @param {object[]} nodes
 * @param {{ from?: string, to?: string }[]} connections
 */
export function getWiredVisibleNodeIds(nodes, connections) {
  const visible = new Set(
    normalizeNodeList(nodes).filter((n) => !n.hidden).map((n) => n.id),
  );
  const wired = new Set();
  for (const conn of connections || []) {
    if (conn?.from && visible.has(conn.from)) wired.add(conn.from);
    if (conn?.to && visible.has(conn.to)) wired.add(conn.to);
  }
  return wired;
}

/**
 * Pick the wired cluster to spotlight — selection component first, else largest wired group.
 * @param {object[]} nodes
 * @param {{ from?: string, to?: string }[]} connections
 * @param {string[]} [selection]
 */
export function resolveSpotlightNodeIds(nodes, connections, selection = []) {
  const wiredIds = getWiredVisibleNodeIds(nodes, connections);
  if (!wiredIds.size) return [];

  const adj = buildAdjacency(connections, wiredIds);
  const components = connectedComponentsFromIds(wiredIds, adj);
  if (!components.length) return [];

  const selected = (selection || []).filter((id) => wiredIds.has(id));
  if (selected.length) {
    const seed = selected[0];
    for (const comp of components) {
      if (comp.includes(seed)) return comp;
    }
  }

  return components.reduce((best, comp) => (comp.length > best.length ? comp : best), components[0]);
}

/**
 * Bounding box for spotlight targets (nodes linked by wires).
 * @param {object[]} nodes
 * @param {{ from?: string, to?: string }[]} connections
 * @param {{ selection?: string[], padding?: number }} [options]
 */
export function getSpotlightBounds(nodes, connections, options = {}) {
  const ids = resolveSpotlightNodeIds(nodes, connections, options.selection);
  if (!ids.length) return null;

  const idSet = new Set(ids);
  const subset = normalizeNodeList(nodes).filter((n) => !n.hidden && idSet.has(n.id));
  const bounds = getNodesBounds(subset);
  if (!bounds.width && !bounds.height) {
    const node = subset[0];
    if (!node) return null;
    const { w, h } = resolveCanvasNodeSize(node);
    return padBounds({
      minX: node.x,
      minY: node.y,
      maxX: node.x + w,
      maxY: node.y + h,
      width: w,
      height: h,
    }, options.padding);
  }
  return padBounds(bounds, options.padding);
}

/**
 * Pan/zoom view that frames a world-space bounding box inside the stage (magnifying glass).
 * @param {{ minX: number, minY: number, width: number, height: number }} bounds
 * @param {{ width: number, height: number }} stageRect
 * @param {{ padding?: number, minScale?: number, maxScale?: number }} [options]
 */
export function computeViewToFitBounds(bounds, stageRect, options = {}) {
  if (!bounds || !stageRect?.width || !stageRect?.height) return null;
  if (bounds.width <= 0 && bounds.height <= 0) return null;

  const {
    minScale = 0.35,
    maxScale = 2.5,
  } = options;

  const paddedW = Math.max(bounds.width, 1);
  const paddedH = Math.max(bounds.height, 1);
  const scaleX = stageRect.width / paddedW;
  const scaleY = stageRect.height / paddedH;
  let scale = Math.min(scaleX, scaleY);
  scale = Math.max(minScale, Math.min(maxScale, scale));

  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;

  return {
    scale,
    panX: stageRect.width / 2 - cx * scale,
    panY: stageRect.height / 2 - cy * scale,
  };
}

/**
 * @param {{ nodes: object[], connections: object[], selection?: string[], stageRect: DOMRect | { width: number, height: number }, minScale?: number, maxScale?: number, padding?: number }} params
 */
export function computeSpotlightView(params) {
  const bounds = getSpotlightBounds(params.nodes, params.connections, {
    selection: params.selection,
    padding: params.padding,
  });
  if (!bounds) return null;
  return computeViewToFitBounds(bounds, params.stageRect, {
    minScale: params.minScale,
    maxScale: params.maxScale,
  });
}
