import { useTimelineStore } from "../stores/timelineStore.js";
import { useCanvasStore } from "../stores/canvasStore.js";

/**
 * Remove a hard-deleted document from the timeline rail (same effect as chip ×)
 * and from canvas chips. Safe to call from deleteNodeAndDocBlocks.
 * @param {string} nodeId
 * @param {string|null} [parentDocId] folder id for exclusion even if snapshot lagged
 */
export function purgeNodeFromTimelineAndCanvas(nodeId, parentDocId = null) {
  if (!nodeId) return;

  const timeline = useTimelineStore.getState();
  timeline.removeTimelineEntityFromSnapshots(nodeId, parentDocId);
  // Mirror timeline chip × when we know the folder (extra exclude + snap scrub).
  if (parentDocId) {
    timeline.removeTimelineChildFromQueue(parentDocId, nodeId);
  }

  const canvas = useCanvasStore.getState();
  for (const cn of canvas.getCanvasNodesByNodeId(nodeId)) {
    canvas.deleteCanvasNode(cn.id);
  }
}

/**
 * Drop timeline snapshot children that no longer belong to their folder
 * (e.g. parentDocId wiped / entity deleted but snapshot persisted).
 */
export function pruneStaleTimelineSnapshotChildren(docsById = {}, nodeEntitiesById = {}) {
  const timeline = useTimelineStore.getState();
  const snaps = timeline.timelineDocSnapshotsByDocId || {};
  let changed = false;
  const nextSnap = { ...snaps };

  for (const [docId, snap] of Object.entries(snaps)) {
    const children = snap?.children || [];
    if (!children.length) continue;
    const nodeIds = new Set(docsById[docId]?.nodeIds || []);
    const filtered = children.filter((child) => {
      if (!child?.entityId) return Boolean(child.canvasNodeId);
      const entity = nodeEntitiesById[child.entityId];
      if (!entity) return false;
      return entity.parentDocId === docId || nodeIds.has(child.entityId);
    });
    if (filtered.length !== children.length) {
      nextSnap[docId] = { ...snap, children: filtered };
      changed = true;
    }
  }

  if (changed) {
    useTimelineStore.setState({ timelineDocSnapshotsByDocId: nextSnap });
  }
}
