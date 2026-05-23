import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useNodesStore } from "./nodesStore.js";
import { canvasNodePatchFromNode, nodePatchFromCanvasNode } from "../lib/sync.js";

export const useCanvasStore = create(
  devtools(
    (set, get) => ({
      canvasNodes: {},
      canvasConnections: {},
      groupings: {},
      scale: 1,
      panX: 0,
      panY: 0,
      selection: [],

      getCanvasNode: (id) => get().canvasNodes[id] || null,

      getAllCanvasNodes: () => Object.values(get().canvasNodes),

      getCanvasNodesByNodeId: (nodeId) =>
        Object.values(get().canvasNodes).filter((cn) => cn.nodeId === nodeId),

      getConnection: (id) => get().canvasConnections[id] || null,

      getAllConnections: () => Object.values(get().canvasConnections),

      getGrouping: (id) => get().groupings[id] || null,

      addCanvasNode: (nodeId, x = 30, y = 30, title, dataType) => {
        const node = useNodesStore.getState().getNode(nodeId);
        const id = generateId("CN");
        const cn = {
          id,
          nodeId,
          title: title || (node?.title || "NOTE").toUpperCase().slice(0, 20),
          dataType: dataType || node?.dataType || "text",
          content: node?.content,
          x,
          y,
          hidden: false,
          selected: false,
        };
        set((state) => ({
          canvasNodes: { ...state.canvasNodes, [id]: cn },
        }));
        useNodesStore.getState().setLinkedToCanvas(nodeId, id, true);
        return id;
      },

      updateCanvasNode: (id, patch) => {
        set((state) => {
          const cn = state.canvasNodes[id];
          if (!cn) return state;
          return {
            canvasNodes: {
              ...state.canvasNodes,
              [id]: { ...cn, ...patch },
            },
          };
        });
        const cn = get().canvasNodes[id];
        if (cn?.nodeId) {
          useNodesStore.getState().updateNode(cn.nodeId, nodePatchFromCanvasNode({ ...cn, ...patch }));
        }
      },

      updateCanvasNodePosition: (id, x, y) => get().updateCanvasNode(id, { x, y }),

      /** Patch canvas node without propagating to nodesStore (used by sync middleware) */
      patchCanvasNodeLocal: (id, patch) =>
        set((state) => {
          const cn = state.canvasNodes[id];
          if (!cn) return state;
          return {
            canvasNodes: {
              ...state.canvasNodes,
              [id]: { ...cn, ...patch },
            },
          };
        }),

      moveCanvasNode: (id, x, y) => get().updateCanvasNodePosition(id, x, y),

      toggleCanvasNodeSelection: (id) =>
        set((state) => {
          const cn = state.canvasNodes[id];
          if (!cn) return state;
          const selected = !cn.selected;
          return {
            canvasNodes: {
              ...state.canvasNodes,
              [id]: { ...cn, selected },
            },
            selection: selected
              ? [...state.selection.filter((s) => s !== id), id]
              : state.selection.filter((s) => s !== id),
          };
        }),

      selectMultipleCanvasNodes: (ids) =>
        set((state) => {
          const updatedNodes = { ...state.canvasNodes };
          Object.keys(updatedNodes).forEach((nid) => {
            updatedNodes[nid] = {
              ...updatedNodes[nid],
              selected: ids.includes(nid),
            };
          });
          return { canvasNodes: updatedNodes, selection: ids };
        }),

      setSelection: (ids) => get().selectMultipleCanvasNodes(ids),

      toggleSelection: (id) => get().toggleCanvasNodeSelection(id),

      clearSelection: () =>
        set((state) => {
          const updatedNodes = { ...state.canvasNodes };
          Object.keys(updatedNodes).forEach((nid) => {
            updatedNodes[nid] = { ...updatedNodes[nid], selected: false };
          });
          return { canvasNodes: updatedNodes, selection: [] };
        }),

      addConnection: (fromCanvasNodeId, toCanvasNodeId) => {
        const id = generateId("CONN");
        set((state) => ({
          canvasConnections: {
            ...state.canvasConnections,
            [id]: {
              id,
              from: fromCanvasNodeId,
              to: toCanvasNodeId,
              fromCanvasNodeId,
              toCanvasNodeId,
              createdAt: new Date().toISOString(),
            },
          },
        }));
        return id;
      },

      deleteConnection: (id) =>
        set((state) => {
          const next = { ...state.canvasConnections };
          delete next[id];
          return { canvasConnections: next };
        }),

      createGrouping: (name, canvasNodeIds, parentDocId = null) => {
        const id = generateId("GROUP");
        set((state) => ({
          groupings: {
            ...state.groupings,
            [id]: {
              id,
              name,
              canvasNodeIds,
              parentDocId,
              createdAt: new Date().toISOString(),
            },
          },
        }));
        return id;
      },

      deleteGrouping: (id) =>
        set((state) => {
          const next = { ...state.groupings };
          delete next[id];
          return { groupings: next };
        }),

      setPan: (x, y) => set({ panX: x, panY: y }),

      setScale: (scale) => set({ scale }),

      hideCanvasNode: (id) => get().updateCanvasNode(id, { hidden: true }),

      clearCanvas: () =>
        set((state) => {
          const updatedNodes = { ...state.canvasNodes };
          Object.keys(updatedNodes).forEach((nid) => {
            updatedNodes[nid] = { ...updatedNodes[nid], hidden: true };
          });
          return { canvasNodes: updatedNodes };
        }),

      hideAll: () => get().clearCanvas(),

      deleteCanvasNode: (id) =>
        set((state) => {
          const cn = state.canvasNodes[id];
          if (cn?.nodeId) {
            useNodesStore.getState().setLinkedToCanvas(cn.nodeId, id, false);
          }
          const nextNodes = { ...state.canvasNodes };
          delete nextNodes[id];
          const nextConn = {};
          Object.values(state.canvasConnections).forEach((c) => {
            const from = c.fromCanvasNodeId || c.from;
            const to = c.toCanvasNodeId || c.to;
            if (from !== id && to !== id) nextConn[c.id] = c;
          });
          return {
            canvasNodes: nextNodes,
            canvasConnections: nextConn,
            selection: state.selection.filter((s) => s !== id),
          };
        }),
    }),
    { name: "CanvasStore" },
  ),
);
