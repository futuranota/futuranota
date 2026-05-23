/** Bounding box for canvas nodes */
export function getNodesBounds(nodes) {
  const list = Object.values(nodes || {});
  if (!list.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const w = 120;
  const h = 48;
  list.forEach((n) => {
    if (n.hidden) return;
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
