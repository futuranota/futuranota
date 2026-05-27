import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useDocsStore } from "./docsStore.js";
import { injectNodeAnswerIntoDocBody } from "../lib/sync.js";

export const useNodesStore = create(
  devtools(
    (set, get) => ({
      nodes: {},

      getNode: (id) => get().nodes[id] || null,

      getAllNodes: () => Object.values(get().nodes),

      getNodesByDoc: (docId) =>
        Object.values(get().nodes).filter((node) => node.parentDocId === docId),

      getNodeByCanvasId: (canvasNodeId) =>
        Object.values(get().nodes).find((node) =>
          node.canvasConnections?.includes(canvasNodeId),
        ),

      addNode: (title, dataType, content, parentDocId = null, extra = {}) => {
        const id = generateId("NODE");
        const now = new Date().toISOString();
        const createdAt = extra.createdAt ?? now;
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: {
              id,
              title,
              dataType,
              content,
              parentDocId,
              parentNodeId: null,
              objectId: null,
              sourceBlockId: extra.sourceBlockId ?? null,
              sourceQuery: extra.sourceQuery ?? null,
              canvasConnections: [],
              linkedToCanvas: false,
              linkedToDoc: Boolean(parentDocId),
              canvasNodeId: null,
              createdAt,
              updatedAt: now,
            },
          },
        }));
        if (parentDocId) {
          useDocsStore.getState().addNodeToDoc(parentDocId, id);
        }
        return id;
      },

      createOrUpdateNodeFromH1: ({
        nodeId,
        docId,
        blockId,
        query,
        content,
        docCreatedAt = null,
      }) => {
        const title = (query || "").trim() || "Untitled query";
        const payload = {
          title,
          dataType: "text",
          content: content ?? "",
          sourceBlockId: blockId,
          sourceQuery: query || title,
        };

        if (nodeId) {
          get().updateNode(nodeId, payload);
          return nodeId;
        }

        const parentDoc = docId ? useDocsStore.getState().getDoc(docId) : null;
        const inheritedCreatedAt =
          docCreatedAt || parentDoc?.createdAt || new Date().toISOString();

        const id = get().addNode(title, "text", payload.content, docId, {
          sourceBlockId: blockId,
          sourceQuery: payload.sourceQuery,
          createdAt: inheritedCreatedAt,
        });
        return id;
      },

      addNodeFromDoc: (title, dataType, content, parentDocId, sourceQuery, inject = true) => {
        const id = get().addNode(title, dataType, content, parentDocId);
        if (inject && parentDocId) {
          const doc = useDocsStore.getState().getDoc(parentDocId);
          if (doc) {
            const answer = typeof content === "string" ? content : JSON.stringify(content);
            const body = injectNodeAnswerIntoDocBody(
              doc.body || doc.content || "",
              { query: sourceQuery || title },
              answer,
            );
            useDocsStore.getState().updateDocContent(parentDocId, body);
          }
        }
        return id;
      },

      updateNode: (id, updates) =>
        set((state) => {
          const node = state.nodes[id];
          if (!node) return state;
          return {
            nodes: {
              ...state.nodes,
              [id]: { ...node, ...updates, updatedAt: new Date().toISOString() },
            },
          };
        }),

      setLinkedToCanvas: (nodeId, canvasNodeId, linked = true) =>
        set((state) => {
          const node = state.nodes[nodeId];
          if (!node) return state;
          const connections = linked
            ? [...(node.canvasConnections || []), canvasNodeId].filter(
              (v, i, a) => a.indexOf(v) === i,
            )
            : (node.canvasConnections || []).filter((cid) => cid !== canvasNodeId);
          return {
            nodes: {
              ...state.nodes,
              [nodeId]: {
                ...node,
                canvasConnections: connections,
                linkedToCanvas: connections.length > 0,
                canvasNodeId: linked ? canvasNodeId : node.canvasNodeId,
              },
            },
          };
        }),

      setCanvasNodeId: (nodeId, canvasNodeId) =>
        get().updateNode(nodeId, { canvasNodeId }),

      addNodeConnection: (fromNodeId, toNodeId) =>
        set((state) => {
          const node = state.nodes[fromNodeId];
          if (!node) return state;
          if ((node.canvasConnections || []).includes(toNodeId)) return state;
          return {
            nodes: {
              ...state.nodes,
              [fromNodeId]: {
                ...node,
                canvasConnections: [...(node.canvasConnections || []), toNodeId],
              },
            },
          };
        }),

      deleteNode: (id) => {
        const node = get().nodes[id];
        if (node?.parentDocId) {
          useDocsStore.getState().removeNodeFromDoc(node.parentDocId, id);
        }
        set((state) => {
          const next = { ...state.nodes };
          delete next[id];
          return { nodes: next };
        });
      },
    }),
    { name: "NodesStore" },
  ),
);
