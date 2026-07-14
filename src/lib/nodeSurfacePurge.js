import { useTimelineStore } from "../stores/timelineStore.js";
import { useCanvasStore } from "../stores/canvasStore.js";

/**
 * Remove a hard-deleted document entity from timeline snapshots and canvas chips.
 * Safe to call from deleteNodeAndDocBlocks (getState at call time only).
 */
export function purgeNodeFromTimelineAndCanvas(nodeId) {
  if (!nodeId) return;

  useTimelineStore.getState().removeTimelineEntityFromSnapshots(nodeId);

  const canvas = useCanvasStore.getState();
  for (const cn of canvas.getCanvasNodesByNodeId(nodeId)) {
    canvas.deleteCanvasNode(cn.id);
  }
}
