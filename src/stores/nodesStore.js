import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useDocsStore } from "./docsStore.js";
import { useUIStateStore } from "./uiStateStore.js";
import { injectNodeAnswerIntoDocBody } from "../lib/sync.js";
import {
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  ensureWritableDocTail,
  normalizeDocBlocks,
} from "../lib/docBlocks.js";
import { anchorFieldsFromIso } from "../lib/nodeAnchor.js";
import { parseCalendarEventNodeContent } from "../lib/eventCalendarSearch.js";
import {
  buildCalendarEmbeddedBlockFields,
  getCalendarEventDisplayText,
} from "../lib/calendarEventDisplay.js";
import {
  buildForecastEmbeddedBlockFields,
  getForecastDisplayText,
} from "../lib/forecastNodeDisplay.js";
import { parseWeatherForecastNodeContent } from "../lib/forecastSearch.js";
import {
  resolveDocWorkStatus,
  syncDocWorkStatusFields,
  hasMeaningfulNodeContent,
  nextStatusOnMeaningfulWrite,
} from "../lib/docWorkStatus.js";
import { isFolderScheduleReserved } from "../lib/folderScheduleReservation.js";
import {
  ensureContinuationAfterLinkedOwner,
  findMacroContinuationIndex,
  isMacroContinuationTextBlock,
  MACRO_NODE_TEXT_SLOT,
  mergeMissingLinkedOwnerBundles,
  removeLinkedOwnerBundleFromBlocks,
  resolveLinkedAnswerTextIndex,
  stripLeadingEmptyTextBlocks,
  unlinkNodeFromDocBlocks,
} from "../lib/docNodeSync.js";
import { purgeNodeFromTimelineAndCanvas } from "../lib/nodeSurfacePurge.js";
import { markDocsDeletedForSync } from "./middleware/persistenceMiddleware.js";
import { normalizeNodeTodoContent, createDefaultNodeTodoContent } from "../lib/nodeTodoContent.js";
import {
  getNodeWritingPlainText,
  isNodeWritingBody,
  nodeDraftContentForStorage,
  NODE_BLOCK_TYPES,
  parseNodeWritingBody,
} from "../lib/nodeInlineContent.js";
import { resolveAdoptedBlockNodeLinkColor } from "../lib/docNodeLinkColors.js";
import { getVideoNodePayload } from "../lib/videoEmbed.js";
import {
  CAMPAIGN_DOC_STATUS_INACTIVE,
  normalizeCampaignDocStatus,
} from "../lib/campaignDocSource.js";

function resolveVideoContentForDocSync(node) {
  return getVideoNodePayload(node?.content) || {};
}

function buildVideoEmbedDocBlock(videoContent, patch = {}) {
  return createDocBlock(DOC_BLOCK_TYPES.VIDEO_EMBED, {
    rawInput: videoContent.rawInput ?? "",
    provider: videoContent.provider ?? "unknown",
    videoId: videoContent.videoId ?? "",
    embedSrc: videoContent.embedSrc ?? "",
    parseError: null,
    ...patch,
  });
}

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
    const todo = normalizeNodeTodoContent(content);
    const done = todo.items.filter((item) => item.checked).length;
    return `${done}/${todo.items.length}`;
  }

  if (dataType === "text" && isNodeWritingBody(content)) {
    const { blocks } = parseNodeWritingBody(content);
    const text = getNodeWritingPlainText(blocks);
    const todoCount = blocks.filter((block) => block.type === NODE_BLOCK_TYPES.TODO).length;
    const lists = todoCount ? ` · ${todoCount} todo` : "";
    return `${text}${lists}`.trim();
  }

  if (dataType === "video" && content && typeof content === "object") {
    return content.rawInput || content.embedSrc || "";
  }

  if (typeof content === "string") return content;
  if (content == null) return "";
  return JSON.stringify(content);
}

function buildSyncedNodeText(node) {
  if (node?.dataType === "text" && parseCalendarEventNodeContent(node.content)) {
    return getCalendarEventDisplayText(node.content);
  }
  if (node?.dataType === "text" && parseWeatherForecastNodeContent(node.content)) {
    return getForecastDisplayText(node.content);
  }
  return stringifyNodeContent(node.dataType, node.content);
}

function buildSyncedTextBlockFields(node) {
  if (node?.dataType === "text" && parseCalendarEventNodeContent(node.content)) {
    const embedded = buildCalendarEmbeddedBlockFields(node);
    if (embedded) return embedded;
  }
  if (node?.dataType === "text" && parseWeatherForecastNodeContent(node.content)) {
    const embedded = buildForecastEmbeddedBlockFields(node);
    if (embedded) return embedded;
  }
  return { text: buildSyncedNodeText(node) };
}

/** Fields for macronode titles synced into a parent folder (Create a new Document). */
function linkedBlockFields(doc, extra = {}) {
  return {
    queryEnabled: true,
    macronodeHeading: true,
    nodeLinkColor: resolveAdoptedBlockNodeLinkColor(doc),
    ...extra,
  };
}

/** Panel Create a new Document: synced title+Description, no color-link handle (continue reading opens). */
function panelSyncedBlockFields(doc) {
  return linkedBlockFields(doc, { hideColorLink: true });
}

/** Block schedule fields from node.anchorAt; marks schedule as owned by the node. */
function scheduleFieldsFromNode(node) {
  if (!node?.anchorAt) return {};
  const fields = anchorFieldsFromIso(node.anchorAt);
  if (!fields.anchorDate) return {};
  const finishFields = anchorFieldsFromIso(node.anchorFinishAt || null);
  return {
    ...fields,
    anchorFinishTime: finishFields.anchorTime || "",
    anchorFromNode: true,
  };
}

function finalizeSyncedDocBlocks(blocks, doc, ownerBlockId = null) {
  let next = blocks;
  if (ownerBlockId) {
    const ownerIndex = next.findIndex((b) => b.id === ownerBlockId);
    if (ownerIndex >= 0) {
      next = ensureContinuationAfterLinkedOwner(next, ownerIndex);
    }
  }
  return ensureWritableDocTail(next);
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
        const work = syncDocWorkStatusFields({
          status: extra.status,
          completed: extra.completed,
        });
        // Prefer explicit status; else migrate completed boolean.
        const status = Object.prototype.hasOwnProperty.call(extra, "status")
          ? work.status
          : resolveDocWorkStatus({ status: extra.status, completed: extra.completed });
        const completed = status === "completed";
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
              // Company/corpus scope for Independent Documents (parentless nodes).
              objectId: extra.objectId ?? null,
              sourceBlockId: extra.sourceBlockId ?? null,
              sourceQuery: extra.sourceQuery ?? null,
              anchorAt: extra.anchorAt ?? null,
              anchorFinishAt: extra.anchorFinishAt ?? null,
              status,
              completed,
              // Campaign documents (under campaign folders): active|inactive + launch + window.
              campaignStatus: normalizeCampaignDocStatus(
                extra.campaignStatus ?? CAMPAIGN_DOC_STATUS_INACTIVE,
              ),
              launchAt: extra.launchAt ?? null,
              windowStartAt: extra.windowStartAt ?? null,
              windowEndAt: extra.windowEndAt ?? null,
              sourceId: extra.sourceId ?? null,
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
        anchorFinishAt = undefined,
        completed = undefined,
        status = undefined,
        sourceId = undefined,
      }) => {
        const title = (query || "").trim() || "Untitled query";
        const defaultContent = dataType === "checkbox"
          ? createDefaultNodeTodoContent()
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
                : "";
        const resolvedContent = dataType === "text"
          ? nodeDraftContentForStorage(content ?? "", dataType)
          : (content ?? defaultContent);

        const payload = {
          title,
          dataType,
          content: resolvedContent,
          sourceBlockId: blockId,
          sourceQuery: query || title,
        };

        if (anchorAt !== undefined) {
          payload.anchorAt = anchorAt;
        }
        if (anchorFinishAt !== undefined) {
          payload.anchorFinishAt = anchorFinishAt;
        }
        if (status !== undefined) {
          Object.assign(payload, syncDocWorkStatusFields({ status }));
        } else if (completed !== undefined) {
          Object.assign(payload, syncDocWorkStatusFields({ completed }));
        } else if (nodeId) {
          const existing = get().nodes[nodeId];
          const parentForAuto = docId
            ? useDocsStore.getState().getDoc(docId)
            : (existing?.parentDocId
              ? useDocsStore.getState().getDoc(existing.parentDocId)
              : null);
          const auto = nextStatusOnMeaningfulWrite(
            resolveDocWorkStatus(existing),
            hasMeaningfulNodeContent(resolvedContent),
            { folderScheduleReserved: isFolderScheduleReserved(parentForAuto) },
          );
          if (auto) Object.assign(payload, syncDocWorkStatusFields({ status: auto }));
        } else if (hasMeaningfulNodeContent(resolvedContent)) {
          const parentForAuto = docId ? useDocsStore.getState().getDoc(docId) : null;
          if (isFolderScheduleReserved(parentForAuto)) {
            Object.assign(payload, syncDocWorkStatusFields({ status: "in_progress" }));
          }
        }
        if (sourceId !== undefined) {
          payload.sourceId = sourceId;
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
          anchorFinishAt: payload.anchorFinishAt ?? null,
          status: payload.status ?? null,
          completed: payload.completed ?? false,
          sourceId: payload.sourceId ?? null,
          objectId: parentDoc?.parentObjectId ?? null,
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
        const syncedTextFields = buildSyncedTextBlockFields(node);
        const syncedText = syncedTextFields.text;
        let sourceBlockId = node.sourceBlockId || null;
        let sourceBlockIndex = sourceBlockId
          ? normalized.findIndex((b) => b.id === sourceBlockId)
          : -1;
        if (sourceBlockIndex < 0) {
          sourceBlockIndex = normalized.findIndex((b) => b.nodeId === node.id);
          if (sourceBlockIndex >= 0) {
            sourceBlockId = normalized[sourceBlockIndex].id;
          }
        }
        const sourceBlock = sourceBlockIndex >= 0 ? normalized[sourceBlockIndex] : null;

        let nextBlocks;
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
          const anchorFields = scheduleFieldsFromNode(node);
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
              ...linkedBlockFields(doc),
              ...anchorFields,
            };
          });
        } else if (
          sourceBlock?.type === DOC_BLOCK_TYPES.H1
          && normalized[sourceBlockIndex + 1]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
        ) {
          const videoContent = resolveVideoContentForDocSync(node);
          const anchorFields = scheduleFieldsFromNode(node);
          nextBlocks = normalized.map((block, i) => {
            if (i === sourceBlockIndex) {
              return {
                ...block,
                title: syncedTitle,
                sourceQuery: syncedTitle,
                nodeId: node.id,
                ...linkedBlockFields(doc),
                ...anchorFields,
              };
            }
            if (i === sourceBlockIndex + 1) {
              return {
                ...block,
                rawInput: videoContent.rawInput ?? "",
                provider: videoContent.provider ?? "unknown",
                videoId: videoContent.videoId ?? "",
                embedSrc: videoContent.embedSrc ?? "",
                parseError: null,
              };
            }
            return block;
          });
          sourceTextBlockId = null;
        } else {
          const existingH1Index =
            sourceBlock?.type === DOC_BLOCK_TYPES.H1 ? sourceBlockIndex : -1;
          const existingTextIndex = node.sourceTextBlockId
            ? normalized.findIndex((b) => b.id === node.sourceTextBlockId && b.type === DOC_BLOCK_TYPES.TEXT)
            : -1;
          const anchorFields = scheduleFieldsFromNode(node);

          if (existingH1Index >= 0 && node.dataType === "video") {
            const videoContent = resolveVideoContentForDocSync(node);
            const h1Id = normalized[existingH1Index].id;
            sourceTextBlockId = null;

            const mapped = normalized.map((block, i) => {
              if (i === existingH1Index) {
                return {
                  ...block,
                  title: syncedTitle,
                  sourceQuery: syncedTitle,
                  nodeId: node.id,
                  ...linkedBlockFields(doc),
                  ...anchorFields,
                };
              }
              if (i === existingH1Index + 1) {
                return buildVideoEmbedDocBlock(videoContent, {
                  id: block.id,
                  ownerH1Id: h1Id,
                });
              }
              if (block.id === node.sourceTextBlockId && block.type === DOC_BLOCK_TYPES.TEXT) {
                return null;
              }
              return block;
            }).filter(Boolean);

            if (normalized[existingH1Index + 1]) {
              nextBlocks = mapped;
            } else {
              const videoBlock = buildVideoEmbedDocBlock(videoContent, { ownerH1Id: h1Id });
              nextBlocks = [
                ...mapped.slice(0, existingH1Index + 1),
                videoBlock,
                ...mapped.slice(existingH1Index + 1),
              ];
            }
          } else if (existingH1Index >= 0) {
            let answerTextIndex = node.sourceTextBlockId
              ? normalized.findIndex((b) => b.id === node.sourceTextBlockId && b.type === DOC_BLOCK_TYPES.TEXT)
              : -1;
            if (answerTextIndex >= 0 && isMacroContinuationTextBlock(normalized[answerTextIndex])) {
              answerTextIndex = -1;
            }
            if (answerTextIndex < 0) {
              answerTextIndex = resolveLinkedAnswerTextIndex(normalized, existingH1Index);
            }

            nextBlocks = normalized.map((block, i) => {
              if (i === existingH1Index) {
                return {
                  ...block,
                  title: syncedTitle,
                  sourceQuery: syncedTitle,
                  nodeId: node.id,
                  ...linkedBlockFields(doc),
                  ...anchorFields,
                };
              }
              if (answerTextIndex >= 0 && i === answerTextIndex) {
                return {
                  ...block,
                  text: syncedText,
                  macroNodeSlot: MACRO_NODE_TEXT_SLOT.ANSWER,
                  ...(syncedTextFields.embedded ? { embedded: syncedTextFields.embedded } : {}),
                };
              }
              return block;
            });

            if (answerTextIndex < 0) {
              const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, {
                text: syncedText,
                macroNodeSlot: MACRO_NODE_TEXT_SLOT.ANSWER,
                ...(syncedTextFields.embedded ? { embedded: syncedTextFields.embedded } : {}),
              });
              sourceTextBlockId = textBlock.id;
              const continuationIndex = findMacroContinuationIndex(nextBlocks, existingH1Index);
              if (continuationIndex >= 0) {
                nextBlocks = [
                  ...nextBlocks.slice(0, continuationIndex),
                  textBlock,
                  ...nextBlocks.slice(continuationIndex),
                ];
              } else {
                nextBlocks = [
                  ...nextBlocks.slice(0, existingH1Index + 1),
                  textBlock,
                  ...nextBlocks.slice(existingH1Index + 1),
                ];
              }
            } else {
              sourceTextBlockId = normalized[answerTextIndex]?.id || node.sourceTextBlockId || null;
            }
          } else if (node.dataType === "date") {
            const dateContent =
              node.content && typeof node.content === "object"
                ? node.content
                : { date: String(node.content ?? ""), time: "" };
            const dateBlock = createDocBlock(DOC_BLOCK_TYPES.DATE, {
              title: syncedTitle,
              sourceQuery: syncedTitle,
              nodeId: node.id,
              date: dateContent.date || "",
              time: dateContent.time || "",
              queryEnabled: true,
            });
            sourceBlockId = dateBlock.id;
            nextBlocks = [...stripLeadingEmptyTextBlocks(normalized), dateBlock];
          } else if (node.dataType === "metric") {
            const metricContent =
              node.content && typeof node.content === "object"
                ? node.content
                : { value: node.content ?? "", unit: "" };
            const metricBlock = createDocBlock(DOC_BLOCK_TYPES.METRIC, {
              title: syncedTitle,
              sourceQuery: syncedTitle,
              nodeId: node.id,
              value: metricContent.value ?? "",
              unit: metricContent.unit || "",
              queryEnabled: true,
            });
            sourceBlockId = metricBlock.id;
            nextBlocks = [...stripLeadingEmptyTextBlocks(normalized), metricBlock];
          } else if (node.dataType === "checkbox") {
            const todoContent = normalizeNodeTodoContent(node.content, syncedTitle);
            const todoBlock = createDocBlock(DOC_BLOCK_TYPES.TODO, {
              listTitle: todoContent.listTitle || syncedTitle,
              sourceQuery: syncedTitle,
              nodeId: node.id,
              ...panelSyncedBlockFields(doc),
              items: todoContent.items?.length
                ? todoContent.items
                : [createTodoItem()],
              ...anchorFields,
            });
            sourceBlockId = todoBlock.id;
            nextBlocks = [...stripLeadingEmptyTextBlocks(normalized), todoBlock];
          } else if (node.dataType === "video") {
            const videoContent = resolveVideoContentForDocSync(node);
            const h1Block = createDocBlock(DOC_BLOCK_TYPES.H1, {
              title: syncedTitle,
              sourceQuery: syncedTitle,
              nodeId: node.id,
              ...panelSyncedBlockFields(doc),
              ...anchorFields,
            });
            const videoBlock = buildVideoEmbedDocBlock(videoContent, {
              ownerH1Id: h1Block.id,
            });
            sourceBlockId = h1Block.id;
            sourceTextBlockId = null;
            nextBlocks = [...stripLeadingEmptyTextBlocks(normalized), h1Block, videoBlock];
          } else {
            const h1Block = createDocBlock(DOC_BLOCK_TYPES.H1, {
              title: syncedTitle,
              sourceQuery: syncedTitle,
              nodeId: node.id,
              ...panelSyncedBlockFields(doc),
              ...anchorFields,
            });
            const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, {
              text: syncedText,
              ...(syncedTextFields.embedded ? { embedded: syncedTextFields.embedded } : {}),
            });
            sourceBlockId = h1Block.id;
            sourceTextBlockId = textBlock.id;
            nextBlocks = [...stripLeadingEmptyTextBlocks(normalized), h1Block, textBlock];
          }
        }

        const finalizedBlocks = finalizeSyncedDocBlocks(nextBlocks, doc, sourceBlockId);
        useDocsStore.getState().updateDoc(docId, {
          blocks: finalizedBlocks,
        });
        // Keep open-folder editor draft in sync so new Create-a-new-Document
        // titles + Description layers appear even while the folder modal is open.
        const draft = useUIStateStore.getState().docEditorDrafts[docId];
        if (draft) {
          const mergedBlocks = mergeMissingLinkedOwnerBundles(
            draft.blocks || [],
            finalizedBlocks,
          );
          useUIStateStore.getState().setDocEditorDraft(docId, {
            ...draft,
            blocks: mergedBlocks,
          });
        }
        get().updateNode(nodeId, {
          parentDocId: docId,
          linkedToDoc: true,
          sourceBlockId: sourceBlockId || undefined,
          sourceTextBlockId: sourceTextBlockId || undefined,
        });
      },

      detachNodeFromDocAsCopy: (nodeId) => {
        const node = get().nodes[nodeId];
        if (!node?.parentDocId) return;

        const doc = useDocsStore.getState().getDoc(node.parentDocId);
        if (!doc) return;

        const normalized = normalizeDocBlocks(doc.blocks);
        const ownerIndex = node.sourceBlockId
          ? normalized.findIndex((b) => b.id === node.sourceBlockId)
          : -1;

        const nextBlocks = ownerIndex >= 0
          ? unlinkNodeFromDocBlocks(normalized, ownerIndex, node)
          : normalized.map((block) => {
            if (block.id === node.sourceBlockId) {
              return { ...block, nodeId: null };
            }
            if (block.id === node.sourceTextBlockId) {
              if (block.embedded?.kind === "calendar-event") {
                return {
                  ...block,
                  text: block.text || getCalendarEventDisplayText(node.content),
                  embedded: { ...block.embedded, linkedNodeId: null },
                };
              }
              if (block.embedded?.kind === "weather-forecast") {
                return {
                  ...block,
                  text: block.text || getForecastDisplayText(node.content),
                  embedded: { ...block.embedded, linkedNodeId: null },
                };
              }
              return { ...block, text: block.text || buildSyncedNodeText(node) };
            }
            return block;
          });

        useDocsStore.getState().updateDoc(node.parentDocId, { blocks: nextBlocks });
        useDocsStore.getState().removeNodeFromDoc(node.parentDocId, nodeId);
      },

      /** Remove node entity + doc.nodeIds entry without mutating doc blocks (draft editor handles blocks). */
      deleteNodeEntity: (nodeId) => {
        const node = get().nodes[nodeId];
        if (node?.parentDocId) {
          useDocsStore.getState().removeNodeFromDoc(node.parentDocId, nodeId);
        }
        set((state) => {
          if (!state.nodes[nodeId]) return state;
          const next = { ...state.nodes };
          delete next[nodeId];
          return { nodes: next };
        });
      },

      /** Remove node entity and purge its title/Description blocks from parent folder. */
      deleteNodeAndDocBlocks: (nodeId) => {
        const node = get().nodes[nodeId];
        if (!node) return;
        const docsStore = useDocsStore.getState();
        // Prefer live parent; also scrub any doc that still lists this nodeId.
        const parentIds = new Set();
        if (node.parentDocId) parentIds.add(node.parentDocId);
        for (const doc of Object.values(docsStore.docs || {})) {
          if ((doc?.nodeIds || []).includes(nodeId)) parentIds.add(doc.id);
        }
        // Timeline + canvas first (while node still exists for canvas unlink meta).
        // Same outcome as confirming delete in left panel AND × on the rail.
        for (const docId of parentIds) {
          purgeNodeFromTimelineAndCanvas(nodeId, docId);
        }
        if (!parentIds.size) {
          purgeNodeFromTimelineAndCanvas(nodeId, null);
        }
        // Block hydrate from resurrecting the hard-deleted entity.
        markDocsDeletedForSync([], [nodeId]);
        for (const docId of parentIds) {
          const doc = docsStore.getDoc(docId);
          if (doc) {
            const { blocks: nextBlocks } = removeLinkedOwnerBundleFromBlocks(
              doc.blocks,
              nodeId,
            );
            docsStore.updateDoc(docId, { blocks: nextBlocks });
            const draft = useUIStateStore.getState().docEditorDrafts[docId];
            if (draft?.blocks) {
              const { blocks: draftBlocks } = removeLinkedOwnerBundleFromBlocks(
                draft.blocks,
                nodeId,
              );
              useUIStateStore.getState().setDocEditorDraft(docId, {
                ...draft,
                blocks: draftBlocks,
              });
            }
          }
          docsStore.removeNodeFromDoc(docId, nodeId);
        }
        set((state) => {
          const next = { ...state.nodes };
          delete next[nodeId];
          return { nodes: next };
        });
      },

      removeNodeSyncFromDoc: (nodeId, docId = null) => {
        const node = get().nodes[nodeId];
        const targetDocId = docId || node?.parentDocId;
        if (!targetDocId) return;

        const doc = useDocsStore.getState().getDoc(targetDocId);
        if (!doc) return;

        const { blocks: nextBlocks, removed } = removeLinkedOwnerBundleFromBlocks(
          doc.blocks,
          nodeId,
        );
        if (!removed) {
          // Legacy fallback for sourceBlockId-only refs
          if (!node?.sourceBlockId && !node?.sourceTextBlockId) return;
          const normalized = normalizeDocBlocks(doc.blocks);
          const filtered = normalized.filter(
            (b) => b.id !== node.sourceBlockId && b.id !== node.sourceTextBlockId,
          );
          if (filtered.length === normalized.length) return;
          useDocsStore.getState().updateDoc(targetDocId, {
            blocks: ensureWritableDocTail(filtered),
          });
        } else {
          useDocsStore.getState().updateDoc(targetDocId, { blocks: nextBlocks });
        }
        if (node) {
          get().updateNode(nodeId, { sourceBlockId: undefined, sourceTextBlockId: undefined });
        }
      },

      updateNode: (id, updates) =>
        set((state) => {
          const existing = state.nodes[id];
          if (!existing) return state;
          const nextUpdates = { ...updates };
          if (Object.prototype.hasOwnProperty.call(nextUpdates, "campaignStatus")) {
            nextUpdates.campaignStatus = normalizeCampaignDocStatus(nextUpdates.campaignStatus);
          }
          if (
            Object.prototype.hasOwnProperty.call(nextUpdates, "status")
            || Object.prototype.hasOwnProperty.call(nextUpdates, "completed")
          ) {
            Object.assign(nextUpdates, syncDocWorkStatusFields(nextUpdates));
          } else if (Object.prototype.hasOwnProperty.call(nextUpdates, "content")) {
            const parentForAuto = existing.parentDocId
              ? useDocsStore.getState().getDoc(existing.parentDocId)
              : null;
            const auto = nextStatusOnMeaningfulWrite(
              resolveDocWorkStatus(existing),
              hasMeaningfulNodeContent(nextUpdates.content),
              { folderScheduleReserved: isFolderScheduleReserved(parentForAuto) },
            );
            if (auto) Object.assign(nextUpdates, syncDocWorkStatusFields({ status: auto }));
          }
          const nextNode = { ...existing, ...nextUpdates, updatedAt: new Date().toISOString() };
          if (
            Object.prototype.hasOwnProperty.call(nextUpdates, "title")
            || Object.prototype.hasOwnProperty.call(nextUpdates, "status")
            || Object.prototype.hasOwnProperty.call(nextUpdates, "completed")
          ) {
            // #region agent log
            fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974ed'},body:JSON.stringify({sessionId:'8974ed',runId:'pre-fix',hypothesisId:'H1-H2',location:'src/stores/nodesStore.js:updateNode',message:'Document identity/status mutation',data:{nodeId:id,updateKeys:Object.keys(nextUpdates),before:{numericTitle:/^\d+$/.test(String(existing.title||'').trim())?String(existing.title).trim():null,titleLength:String(existing.title||'').length,status:existing.status??null,completed:Boolean(existing.completed),updatedAt:existing.updatedAt??null},after:{numericTitle:/^\d+$/.test(String(nextNode.title||'').trim())?String(nextNode.title).trim():null,titleLength:String(nextNode.title||'').length,status:nextNode.status??null,completed:Boolean(nextNode.completed),updatedAt:nextNode.updatedAt}},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          }
          return {
            nodes: {
              ...state.nodes,
              [id]: nextNode,
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
        get().deleteNodeAndDocBlocks(id);
      },
    }),
    { name: "NodesStore" },
  ),
);
