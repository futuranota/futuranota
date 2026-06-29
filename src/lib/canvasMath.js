const DEFAULT_NODE_W = 180;
const DEFAULT_NODE_H = 72;

function normalizeNodeList(nodes) {
  if (Array.isArray(nodes)) return nodes;
  return Object.values(nodes || {});
}

export function resolveCanvasNodeSize(node, defaults = {}) {
  const w = node?._w || defaults.width || DEFAULT_NODE_W;
  const h = node?._h || defaults.height || DEFAULT_NODE_H;
  return { w, h };
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, padding = 8) {
  return !(
    ax + aw + padding <= bx
    || bx + bw + padding <= ax
    || ay + ah + padding <= by
    || by + bh + padding <= ay
  );
}

/** Bounding box for canvas nodes (array or id→node map) */
export function getNodesBounds(nodes) {
  const list = normalizeNodeList(nodes).filter((n) => !n.hidden);
  if (!list.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  list.forEach((n) => {
    const { w, h } = resolveCanvasNodeSize(n);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  });
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export const getNodesBoundsFromList = getNodesBounds;

export function centerOfBounds(bounds) {
  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
}

/** Simple grid layout for placing new canvas nodes */
export function nextFreePosition(existingNodes, startX = 40, startY = 40, gap = 24) {
  const bounds = getNodesBounds(existingNodes);
  if (bounds.width === 0) return { x: startX, y: startY };
  return { x: bounds.maxX + gap, y: bounds.minY };
}

/**
 * Find a compact slot for a new node — prefers grid cells near existing visible nodes.
 * @param {object[]} existingNodes
 * @param {{ x?: number, y?: number, w?: number, h?: number }[]} extraOccupied
 */
export function nextCompactPosition(existingNodes, extraOccupied = [], options = {}) {
  const {
    startX = 40,
    startY = 40,
    gapX = 24,
    gapY = 24,
    cellW = DEFAULT_NODE_W,
    cellH = DEFAULT_NODE_H,
  } = options;

  const visible = normalizeNodeList(existingNodes).filter((n) => !n.hidden);
  const occupied = [
    ...visible.map((n) => {
      const { w, h } = resolveCanvasNodeSize(n);
      return { x: n.x, y: n.y, w, h };
    }),
    ...extraOccupied.map((p) => ({
      x: p.x,
      y: p.y,
      w: p.w || cellW,
      h: p.h || cellH,
    })),
  ];

  if (!occupied.length) return { x: startX, y: startY };

  const bounds = getNodesBounds(visible);
  const cols = Math.max(1, Math.ceil(Math.sqrt(visible.length + 1)));
  const originX = bounds.width ? bounds.minX : startX;
  const originY = bounds.width ? bounds.minY : startY;

  for (let row = 0; row < 24; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = originX + col * (cellW + gapX);
      const y = originY + row * (cellH + gapY);
      const blocked = occupied.some((p) => rectsOverlap(x, y, cellW, cellH, p.x, p.y, p.w, p.h));
      if (!blocked) return { x, y };
    }
  }

  return { x: bounds.maxX + gapX, y: bounds.minY };
}

/**
 * Arrange visible canvas nodes in a compact grid (stable order: top→bottom, left→right).
 * @param {object[]} nodes
 */
export function organizeCanvasNodes(nodes, options = {}) {
  const {
    startX = 40,
    startY = 40,
    gapX = 24,
    gapY = 24,
    cellW = DEFAULT_NODE_W,
    cellH = DEFAULT_NODE_H,
  } = options;

  const visible = (nodes || []).filter((n) => !n.hidden);
  if (!visible.length) return nodes;

  const cols = Math.max(1, Math.ceil(Math.sqrt(visible.length)));
  const sorted = [...visible].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 48) return dy;
    return a.x - b.x;
  });

  const positions = new Map();
  sorted.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.set(node.id, {
      x: startX + col * (cellW + gapX),
      y: startY + row * (cellH + gapY),
    });
  });

  return nodes.map((node) => {
    const pos = positions.get(node.id);
    return pos ? { ...node, x: pos.x, y: pos.y } : node;
  });
}
