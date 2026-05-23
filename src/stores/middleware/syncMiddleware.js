import { canvasNodePatchFromNode, nodePatchFromCanvasNode } from "../../lib/sync.js";
import { useNodesStore } from "../nodesStore.js";
import { useCanvasStore } from "../canvasStore.js";
import { useDocsStore } from "../docsStore.js";

let initialized = false;
let syncing = false;

function withSyncLock(fn) {
  if (syncing) return;
  syncing = true;
  try {
    fn();
  } finally {
    syncing = false;
  }
}

function nodeContentKey(node) {
  if (!node) return "";
  return `${node.title}|${node.dataType}|${JSON.stringify(node.content)}`;
}

/**
 * Bidirectional sync: Node ↔ CanvasNode, Doc.syncedWithCanvas flag.
 * Canvas store updateCanvasNode already pushes to nodes; this middleware
 * completes the reverse path and marks docs out of sync.
 */
export function initSyncMiddleware() {
  if (initialized) return;
  initialized = true;

  useNodesStore.subscribe((state, prev) => {
    withSyncLock(() => {
      Object.keys(state.nodes).forEach((nodeId) => {
        const node = state.nodes[nodeId];
        const prevNode = prev.nodes[nodeId];
        if (!prevNode || nodeContentKey(node) === nodeContentKey(prevNode)) return;

        const canvasStore = useCanvasStore.getState();
        canvasStore.getCanvasNodesByNodeId(nodeId).forEach((cn) => {
          canvasStore.patchCanvasNodeLocal(cn.id, canvasNodePatchFromNode(node));
        });

        if (node.parentDocId && node.linkedToDoc) {
          useDocsStore.getState().setSyncedWithCanvas(node.parentDocId, false);
        }
      });
    });
  });

  useCanvasStore.subscribe((state, prev) => {
    withSyncLock(() => {
      Object.keys(state.canvasNodes).forEach((cnId) => {
        const cn = state.canvasNodes[cnId];
        const prevCn = prev.canvasNodes[cnId];
        if (!cn?.nodeId || !prevCn) return;
        const changed = cn.title !== prevCn.title
          || cn.dataType !== prevCn.dataType
          || JSON.stringify(cn.content) !== JSON.stringify(prevCn.content);
        if (!changed) return;

        useNodesStore.getState().updateNode(cn.nodeId, nodePatchFromCanvasNode(cn));
        const node = useNodesStore.getState().getNode(cn.nodeId);
        if (node?.parentDocId) {
          useDocsStore.getState().setSyncedWithCanvas(node.parentDocId, false);
        }
      });
    });
  });
}
