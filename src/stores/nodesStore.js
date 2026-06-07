import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useDocsStore } from "./docsStore.js";
import { injectNodeAnswerIntoDocBody } from "../lib/sync.js";
import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  normalizeDocBlocks,
} from "../lib/docBlocks.js";
import { anchorFieldsFromIso } from "../lib/nodeAnchor.js";

function stringifyNodeContent(dataType, content) {
  if (dataType === "date") {
    if (content && typeof content === "object") {
      const date = content.date || "";
      const time = content.time || "";
      if (date && time) return `${date} ${time}`;
      return date || time;
    }
    return String(content ?? "");
  }

  if (dataType === "metric" && content && typeof content === "object") {
    const value = content.value ?? "";
    const unit = content.unit ? ` ${content.unit}` : "";
    return `${value}${unit}`.trim();
  }

  if (dataType === "checkbox") {
    return content ? "true" : "false";
  }

  if (dataType === "video" && content && typeof content === "object") {
    return content.rawInput || content.embedSrc || "";
  }

  if (typeof content === "string") return content;
  if (content == null) return "";
  return JSON.stringify(content);
}

function buildSyncedNodeText(node) {
  const title = (node.sourceQuery || node.title || "Untitled query").trim() || "Untitled query";
  const detail = stringifyNodeContent(node.dataType, node.content);
  return detail;
}

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
              anchorAt: extra.anchorAt ?? null,
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

      createOrUpdateNodeFromDocBlock: ({
        nodeId,
        docId,
        blockId,
        query,
        content,
        dataType = "text",
        docCreatedAt = null,
        anchorAt = undefined,
      }) => {
        const title = (query || "").trim() || "Untitled query";
        const payload = {
          title,
          dataType,
          content: content ?? (
            dataType === "checkbox"
              ? false
              : dataType === "date"
                ? { date: "", time: "" }
                : dataType === "metric"
                  ? { value: "", unit: "" }
                  : dataType === "video"
                    ? {
                        kind: "embedded-video",
                        provider: "unknown",
                        videoId: "",
                        embedSrc: "",
                        rawInput: "",
                        description: "",
                      }
                    : ""
          ),
          sourceBlockId: blockId,
          sourceQuery: query || title,
        };

        if (anchorAt !== undefined) {
          payload.anchorAt = anchorAt;
        }

        if (nodeId) {
          get().updateNode(nodeId, payload);
          return nodeId;
        }

        const parentDoc = docId ? useDocsStore.getState().getDoc(docId) : null;
        const inheritedCreatedAt =
          docCreatedAt || parentDoc?.createdAt || new Date().toISOString();

        const id = get().addNode(title, dataType, payload.content, docId, {
          sourceBlockId: blockId,
          sourceQuery: payload.sourceQuery,
          createdAt: inheritedCreatedAt,
          anchorAt: payload.anchorAt ?? null,
        });
        return id;
      },

      createOrUpdateNodeFromH1: (args) =>
        get().createOrUpdateNodeFromDocBlock({ ...args, dataType: "text" }),

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

      syncNodeToParentDoc: (nodeId, parentDocId = null) => {
        const node = get().nodes[nodeId];
        if (!node) return;

        const docId = parentDocId || node.parentDocId;
        if (!docId) return;

        const doc = useDocsStore.getState().getDoc(docId);
        if (!doc) return;

        const normalized = normalizeDocBlocks(doc.blocks);
        const syncedTitle = (node.sourceQuery || node.title || "Untitled").trim() || "Untitled";
        const syncedText = buildSyncedNodeText(node);
        const sourceBlockIndex = node.sourceBlockId
          ? normalized.findIndex((b) => b.id === node.sourceBlockId)
          : -1;
        const sourceBlock = sourceBlockIndex >= 0 ? normalized[sourceBlockIndex] : null;

        let nextBlocks;
        let sourceBlockId = node.sourceBlockId || null;
        let sourceTextBlockId = node.sourceTextBlockId || null;

        if (sourceBlock?.type === DOC_BLOCK_TYPES.DATE) {
          const dateContent =
            node.content && typeof node.content === "object"
              ? node.content
              : { date: String(node.content ?? ""), time: "" };
          nextBlocks = normalized.map((block, i) =>
            i === sourceBlockIndex
              ? {
                  ...block,
                  title: syncedTitle,
                  sourceQuery: syncedTitle,
                  date: dateContent.date || "",
                  time: dateContent.time || "",
                  nodeId: node.id,
                }
              : block,
          );
        } else if (sourceBlock?.type === DOC_BLOCK_TYPES.METRIC) {
          const metricContent =
            node.content && typeof node.content === "object"
              ? node.content
              : { value: node.content ?? "", unit: "" };
          nextBlocks = normalized.map((block, i) =>
            i === sourceBlockIndex
              ? {
                  ...block,
                  title: syncedTitle,
                  sourceQuery: syncedTitle,
                  value: metricContent.value ?? "",
                  unit: metricContent.unit || "",
                  nodeId: node.id,
                }
              : block,
          );
        } else if (sourceBlock?.type === DOC_BLOCK_TYPES.TODO) {
          const checked = Boolean(node.content);
          const anchorFields = anchorFieldsFromIso(node.anchorAt);
          nextBlocks = normalized.map((block, i) => {
            if (i !== sourceBlockIndex) return block;
            const items = (block.items || []).map((item, idx) =>
              idx === 0 ? { ...item, checked } : item,
            );
            return {
              ...block,
              listTitle: syncedTitle,
              sourceQuery: syncedTitle,
              items: items.length ? items : block.items,
              nodeId: node.id,
              ...anchorFields,
            };
          });
        } else if (
          sourceBlock?.type === DOC_BLOCK_TYPES.H1
          && normalized[sourceBlockIndex + 1]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
        ) {
          const videoContent =
            node.content && typeof node.content === "object" ? node.content : {};
          const anchorFields = anchorFieldsFromIso(node.anchorAt);
          nextBlocks = normalized.map((block, i) => {
            if (i === sourceBlockIndex) {
              return {
                ...block,
                title: syncedTitle,
                sourceQuery: syncedTitle,
                nodeId: node.id,
                ...anchorFields,
              };
            }
            if (i === sourceBlockIndex + 1) {
              return {
                ...block,
                rawInput: videoContent.rawInput || block.rawInput || "",
                provider: videoContent.provider || block.provider || "unknown",
                videoId: videoContent.videoId || block.videoId || "",
                embedSrc: videoContent.embedSrc || block.embedSrc || "",
                parseError: null,
              };
            }
            return block;
          });
        } else {
          const existingH1Index =
            sourceBlock?.type === DOC_BLOCK_TYPES.H1 ? sourceBlockIndex : -1;
          const existingTextIndex = node.sourceTextBlockId
            ? normalized.findIndex((b) => b.id === node.sourceTextBlockId && b.type === DOC_BLOCK_TYPES.TEXT)
            : -1;
          const anchorFields = anchorFieldsFromIso(node.anchorAt);

          if (existingH1Index >= 0) {
            nextBlocks = normalized.map((block, i) => {
              if (i === existingH1Index) {
                return {
                  ...block,
                  title: syncedTitle,
                  sourceQuery: syncedTitle,
                  nodeId: node.id,
                  ...anchorFields,
                };
              }
              if (existingTextIndex >= 0 && i === existingTextIndex) {
                return { ...block, text: syncedText };
              }
              return block;
            });

            if (existingTextIndex < 0) {
              const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: syncedText });
              sourceTextBlockId = textBlock.id;
              nextBlocks = [
                ...nextBlocks.slice(0, existingH1Index + 1),
                textBlock,
                ...nextBlocks.slice(existingH1Index + 1),
              ];
            }
          } else {
            const h1Block = createDocBlock(DOC_BLOCK_TYPES.H1, {
              title: syncedTitle,
              sourceQuery: syncedTitle,
              nodeId: node.id,
            });
            const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: syncedText });
            sourceBlockId = h1Block.id;
            sourceTextBlockId = textBlock.id;
            nextBlocks = [...normalized, h1Block, textBlock];
          }
        }

        useDocsStore.getState().updateDoc(docId, { blocks: nextBlocks });
        get().updateNode(nodeId, {
          parentDocId: docId,
          linkedToDoc: true,
          sourceBlockId: sourceBlockId || undefined,
          sourceTextBlockId: sourceTextBlockId || undefined,
        });
      },

      removeNodeSyncFromDoc: (nodeId, docId = null) => {
        const node = get().nodes[nodeId];
        if (!node?.sourceBlockId && !node?.sourceTextBlockId) return;

        const targetDocId = docId || node.parentDocId;
        if (!targetDocId) return;

        const doc = useDocsStore.getState().getDoc(targetDocId);
        if (!doc) return;

        const normalized = normalizeDocBlocks(doc.blocks);
        const nextBlocks = normalized.filter(
          (b) => b.id !== node.sourceBlockId && b.id !== node.sourceTextBlockId,
        );
        if (nextBlocks.length === normalized.length) return;

        useDocsStore.getState().updateDoc(targetDocId, { blocks: nextBlocks });
        get().updateNode(nodeId, { sourceBlockId: undefined, sourceTextBlockId: undefined });
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
        get().removeNodeSyncFromDoc(id, node?.parentDocId || null);
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
