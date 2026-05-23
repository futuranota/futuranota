const NODE_BOX_W = 200;
const NODE_BOX_H = 120;

export function worldCenterFromView(stageRect, view) {
  return {
    x: (stageRect.width / 2 - view.panX) / view.scale,
    y: (stageRect.height / 2 - view.panY) / view.scale,
  };
}

export function findFreePosition(center, occupied, minDist = 60) {
  let x = center.x;
  let y = center.y;
  if (!occupied.some((p) => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist)) {
    return { x, y };
  }
  for (let ring = 1; ring < 24; ring++) {
    for (let i = 0; i < ring * 4; i++) {
      const angle = (i / (ring * 4)) * Math.PI * 2;
      x = center.x + Math.cos(angle) * ring * 44;
      y = center.y + Math.sin(angle) * ring * 44;
      if (!occupied.some((p) => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist)) {
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
  }
  return { x: center.x, y: center.y };
}

export function panToFitNode(node, stageRect, setView) {
  if (!node || !stageRect) return;
  const cx = node.x + NODE_BOX_W / 2;
  const cy = node.y + NODE_BOX_H / 2;
  setView((v) => ({
    ...v,
    panX: stageRect.width / 2 - cx * v.scale,
    panY: stageRect.height / 2 - cy * v.scale,
  }));
}
