import { getNodesBounds, resolveCanvasNodeSize } from "./canvasMath.js";

export const MIN_BOARD_WIDTH = 960;
export const MIN_BOARD_HEIGHT = 640;
export const BOARD_CONTENT_PADDING = 48;
export const NODE_CLAMP_MARGIN = 8;

function stageSize(stageRect) {
  return {
    width: Math.max(0, Number(stageRect?.width) || 0),
    height: Math.max(0, Number(stageRect?.height) || 0),
  };
}

/**
 * Finite work board: at least the visible stage (or a readable minimum),
 * expanded so existing nodes are never clipped out of the legal area.
 */
export function getCanvasBoardBounds(nodes, stageRect = null) {
  const { width: stageW, height: stageH } = stageSize(stageRect);
  const homeW = Math.max(MIN_BOARD_WIDTH, Math.round(stageW) || MIN_BOARD_WIDTH);
  const homeH = Math.max(MIN_BOARD_HEIGHT, Math.round(stageH) || MIN_BOARD_HEIGHT);
  const content = getNodesBounds(nodes);
  const hasContent = Boolean(content.width || content.height)
    || (Array.isArray(nodes) && nodes.some((n) => !n?.hidden));

  let minX = 0;
  let minY = 0;
  let maxX = homeW;
  let maxY = homeH;

  if (hasContent && Number.isFinite(content.minX)) {
    if (content.minX < 0) minX = Math.min(minX, content.minX - BOARD_CONTENT_PADDING);
    if (content.minY < 0) minY = Math.min(minY, content.minY - BOARD_CONTENT_PADDING);
    maxX = Math.max(maxX, content.maxX + BOARD_CONTENT_PADDING);
    maxY = Math.max(maxY, content.maxY + BOARD_CONTENT_PADDING);
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

export function clampNodePosition(x, y, size, board, margin = NODE_CLAMP_MARGIN) {
  if (!board) return { x, y };
  const w = size?.w || 180;
  const h = size?.h || 72;
  const minX = board.minX + margin;
  const minY = board.minY + margin;
  const maxX = board.maxX - w - margin;
  const maxY = board.maxY - h - margin;
  return {
    x: Math.round(Math.min(Math.max(Number(x) || 0, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(Number(y) || 0, minY), Math.max(minY, maxY))),
  };
}

/** Keep a dragged group inside the board without splitting it. */
export function clampGroupDelta(nodeList, dx, dy, board) {
  if (!board || !nodeList?.length) return { dx, dy };
  let nextDx = dx;
  let nextDy = dy;
  for (const node of nodeList) {
    const { w, h } = resolveCanvasNodeSize(node);
    const clamped = clampNodePosition(node.x + dx, node.y + dy, { w, h }, board);
    const allowedDx = clamped.x - node.x;
    const allowedDy = clamped.y - node.y;
    nextDx = dx >= 0 ? Math.min(nextDx, allowedDx) : Math.max(nextDx, allowedDx);
    nextDy = dy >= 0 ? Math.min(nextDy, allowedDy) : Math.max(nextDy, allowedDy);
  }
  return { dx: nextDx, dy: nextDy };
}

/**
 * Clamp pan so the board stays in the stage. If the board is smaller than the
 * viewport (zoomed out), center it — that is the visible canvas limit.
 */
export function clampViewToBoard(view, board, stageRect) {
  if (!view || !board) return view;
  const { width, height } = stageSize(stageRect);
  if (!width || !height) return view;
  const scale = Number(view.scale) || 1;
  const boardW = board.width * scale;
  const boardH = board.height * scale;

  let panX = view.panX;
  let panY = view.panY;

  if (boardW <= width) {
    panX = (width - boardW) / 2 - board.minX * scale;
  } else {
    const maxPanX = -board.minX * scale;
    const minPanX = width - board.maxX * scale;
    panX = Math.min(maxPanX, Math.max(minPanX, panX));
  }

  if (boardH <= height) {
    panY = (height - boardH) / 2 - board.minY * scale;
  } else {
    const maxPanY = -board.minY * scale;
    const minPanY = height - board.maxY * scale;
    panY = Math.min(maxPanY, Math.max(minPanY, panY));
  }

  return { scale, panX, panY };
}

export function isNodeVisibleInView(node, view, stageRect, minOverlap = 24) {
  if (!node || !view) return false;
  const { width, height } = stageSize(stageRect);
  if (!width || !height) return false;
  const { w, h } = resolveCanvasNodeSize(node);
  const left = view.panX + node.x * view.scale;
  const top = view.panY + node.y * view.scale;
  const right = left + w * view.scale;
  const bottom = top + h * view.scale;
  const overlapX = Math.min(right, width) - Math.max(left, 0);
  const overlapY = Math.min(bottom, height) - Math.max(top, 0);
  return overlapX >= minOverlap && overlapY >= minOverlap;
}
