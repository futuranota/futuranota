import {
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  ensureEmptyTextBlockAfter,
  ensureWritableDocTail,
  getVideoEmbedBlockAfterH1,
  h1HasVideoEmbedSibling,
  insertBlockAfter,
  isEmptyTextBlock,
  normalizeDocBlock,
  normalizeDocBlocks,
  updateBlockAt,
} from "./docBlocks.js";
import { nodeDataTypeForBlock } from "./docBlockSlash.js";
import { NODE_DATA_TYPES } from "./nodeDataTypes.js";
import {
  blockTodoToNodeContent,
  isNodeTodoContent,
  normalizeNodeTodoContent,
  nodeTodoMacroChecked,
} from "./nodeTodoContent.js";
import { buildVideoNodeContent } from "./videoEmbed.js";
import { isNodeWritingBody } from "./nodeInlineContent.js";
import {
  getCalendarEventDisplayText,
} from "./calendarEventDisplay.js";
import {
  isCalendarEventNodeContent,
} from "./eventCalendarSearch.js";
import {
  getForecastDisplayText,
} from "./forecastNodeDisplay.js";
import {
  isWeatherForecastNodeContent,
} from "./forecastSearch.js";
import {
  anchorAtFromBlock,
  anchorFieldsFromIso,
  isoFromAnchorFields,
  normalizeAnchorFields,
  resolveBlockAnchor,
  resolveBlockAnchorFields,
} from "./nodeAnchor.js";
import {
  isNoNodeLinkMode,
  NO_NODE_LINK_COLOR_ID,
  resolveBlockNodeLinkColor,
} from "./docNodeLinkColors.js";

/** TEXT block roles under a linked macro-node owner — prevent merge + drive focus/hide. */
export const MACRO_NODE_TEXT_SLOT = {
  ANSWER: "macro-answer",
  CONTINUATION: "macro-continuation",
};

export function isMacroContinuationTextBlock(block) {
  return block?.type === DOC_BLOCK_TYPES.TEXT
    && block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION;
}

/** Primary answer TEXT index under a linked H1/Todo — never the continuation slot. */
export function resolveLinkedAnswerTextIndex(blocks, ownerIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (!owner || !isDocBlockLinkedToNode(owner)) return -1;
  if (owner.type !== DOC_BLOCK_TYPES.H1 && owner.type !== DOC_BLOCK_TYPES.TODO) return -1;

  const owned = getOwnedTextBlockIndices(normalized, ownerIndex);
  if (owned.length > 0) return owned[0];

  for (let index = ownerIndex + 1; index < normalized.length; index++) {
    const block = normalized[index];
    if (block?.type !== DOC_BLOCK_TYPES.TEXT) break;
    if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION) break;
    if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.ANSWER) return index;
  }
  return -1;
}

export function findMacroContinuationIndex(blocks, ownerIndex) {
  const normalized = normalizeDocBlocks(blocks);
  for (let index = ownerIndex + 1; index < normalized.length; index++) {
    const block = normalized[index];
    if (block?.type !== DOC_BLOCK_TYPES.TEXT) break;
    if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION) return index;
    if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.ANSWER) continue;
    if (getOwningScheduleBlockIndexForText(normalized, index) !== ownerIndex) break;
  }
  return -1;
}

export {
  anchorAtFromBlock,
  anchorFieldsFromIso,
  isoFromAnchorFields,
  normalizeAnchorFields,
  resolveBlockAnchor,
  resolveBlockAnchorFields,
};

export function getTextBlockIndexAfterH1(blocks, h1Index) {
  const normalized = normalizeDocBlocks(blocks);
  const next = normalized[h1Index + 1];
  if (next?.type === DOC_BLOCK_TYPES.TEXT) return h1Index + 1;
  return -1;
}

export { getVideoEmbedBlockAfterH1, h1HasVideoEmbedSibling };

export function getAnswerBelowH1(blocks, h1Index) {
  const textIndex = getTextBlockIndexAfterH1(blocks, h1Index);
  if (textIndex < 0) return "";
  const normalized = normalizeDocBlocks(blocks);
  return normalized[textIndex]?.text || "";
}

export function setAnswerBelowH1(blocks, h1Index, answerText) {
  const textIndex = getTextBlockIndexAfterH1(blocks, h1Index);
  if (textIndex >= 0) {
    return updateBlockAt(blocks, textIndex, { text: answerText });
  }
  return insertBlockAfter(
    blocks,
    h1Index,
    createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: answerText }),
  );
}

export function findBlockIndex(blocks, blockId, blockType = null) {
  const normalized = normalizeDocBlocks(blocks);
  return normalized.findIndex(
    (b) => b.id === blockId && (blockType == null || b.type === blockType),
  );
}

export function findH1BlockIndex(blocks, blockId) {
  return findBlockIndex(blocks, blockId, DOC_BLOCK_TYPES.H1);
}

/** Text block index immediately after an H1, or -1. */
export function getH1IndexForTextBlock(blocks, textBlockIndex) {
  if (textBlockIndex <= 0) return -1;
  const normalized = normalizeDocBlocks(blocks);
  const prev = normalized[textBlockIndex - 1];
  if (prev?.type === DOC_BLOCK_TYPES.H1) return textBlockIndex - 1;
  return -1;
}

/** Consecutive TEXT block indices directly below an H1 or Todo. */
export function getOwnedTextBlockIndices(blocks, ownerIndex) {
  if (ownerIndex < 0) return [];
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (owner?.type !== DOC_BLOCK_TYPES.H1 && owner?.type !== DOC_BLOCK_TYPES.TODO) return [];

  const indices = [];
  for (let i = ownerIndex + 1; i < normalized.length; i++) {
    const textBlock = normalized[i];
    if (textBlock?.type !== DOC_BLOCK_TYPES.TEXT) break;
    if (textBlock.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION) break;
    indices.push(i);
  }
  return indices;
}

/** H1 or Todo index owning a run of text blocks below it, or -1. */
export function getOwningScheduleBlockIndexForText(blocks, textBlockIndex) {
  if (textBlockIndex < 0) return -1;
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[textBlockIndex];
  if (block?.type !== DOC_BLOCK_TYPES.TEXT) return -1;

  for (let i = textBlockIndex - 1; i >= 0; i--) {
    const prev = normalized[i];
    if (prev.type === DOC_BLOCK_TYPES.TEXT) continue;
    if (prev.type === DOC_BLOCK_TYPES.H1 || prev.type === DOC_BLOCK_TYPES.TODO) return i;
    return -1;
  }
  return -1;
}

/** H1/Todo index for meta-strip node color when a block (or its text) is focused. */
export function findLinkableBlockIndexForFocus(blocks, focusBlockId) {
  if (!focusBlockId) return -1;
  const normalized = normalizeDocBlocks(blocks);
  const index = normalized.findIndex((b) => b.id === focusBlockId);
  if (index < 0) return -1;
  const block = normalized[index];
  if (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO) {
    return index;
  }
  if (block.type === DOC_BLOCK_TYPES.TEXT) {
    return getH1IndexForTextBlock(normalized, index);
  }
  return -1;
}

export function nodeContentAsString(node) {
  if (!node) return "";
  if (isCalendarEventNodeContent(node.content)) {
    return getCalendarEventDisplayText(node.content);
  }
  if (isWeatherForecastNodeContent(node.content)) {
    return getForecastDisplayText(node.content);
  }
  if (typeof node.content === "string") return node.content;
  if (node.dataType === NODE_DATA_TYPES.TEXT) {
    const plain = resolveTextNodeContent(node.content);
    if (plain !== null) return plain;
  }
  return JSON.stringify(node.content ?? "");
}

/** Extract editable plain text from node store content (string or legacy node-body). */
export function resolveTextNodeContent(content) {
  if (typeof content === "string") return content;
  if (
    content
    && typeof content === "object"
    && content.kind === "node-body"
    && Array.isArray(content.blocks)
  ) {
    const textBlocks = content.blocks.filter((block) => block?.type === "text");
    if (!textBlocks.length) return "";
    if (textBlocks.length === 1) return textBlocks[0].text ?? "";
    return textBlocks.map((block) => block.text ?? "").join("\n\n");
  }
  return null;
}

function normalizeDateContent(content) {
  if (content && typeof content === "object") {
    return { date: content.date || "", time: content.time || "" };
  }
  if (typeof content === "string") {
    return { date: content, time: "" };
  }
  return { date: "", time: "" };
}

function normalizeMetricContent(content) {
  if (content && typeof content === "object") {
    return {
      value: content.value != null && content.value !== "" ? String(content.value) : "",
      unit: content.unit || "",
    };
  }
  if (content != null && content !== "") {
    return { value: String(content), unit: "" };
  }
  return { value: "", unit: "" };
}

/** Node content shape from a doc block (for modal draft / save). */
export function getContentForNodeBlock(block, blocks = [], blockIndex = -1) {
  if (!block) return "";

  if (block.type === DOC_BLOCK_TYPES.H1) {
    const video = blockIndex >= 0 ? getVideoEmbedBlockAfterH1(blocks, blockIndex) : null;
    if (video) {
      return buildVideoNodeContent(video, block.title || "");
    }
    return "";
  }

  if (block.type === DOC_BLOCK_TYPES.TODO) {
    return blockTodoToNodeContent(block);
  }

  if (block.type === DOC_BLOCK_TYPES.DATE) {
    return { date: block.date || "", time: block.time || "" };
  }

  if (block.type === DOC_BLOCK_TYPES.METRIC) {
    return {
      value: block.value != null && block.value !== "" ? block.value : "",
      unit: block.unit || "",
    };
  }

  return "";
}

/** Apply node content back onto a doc block. */
export function setContentForNodeBlock(blocks, blockIndex, content, dataType) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block) return normalized;

  if (block.type === DOC_BLOCK_TYPES.H1 && dataType === NODE_DATA_TYPES.TEXT) {
    return setAnswerBelowH1(blocks, blockIndex, typeof content === "string" ? content : "");
  }

  if (block.type === DOC_BLOCK_TYPES.TODO && dataType === NODE_DATA_TYPES.CHECKBOX) {
    if (isNodeTodoContent(content)) {
      const normalized = normalizeNodeTodoContent(content, block.listTitle);
      return updateBlockAt(blocks, blockIndex, {
        listTitle: normalized.listTitle,
        items: normalized.items,
      });
    }
    const checked = Boolean(content);
    const items = (block.items || []).map((item, i) =>
      i === 0 ? { ...item, checked } : item,
    );
    if (items.length === 0) {
      return updateBlockAt(blocks, blockIndex, {
        items: [createTodoItem({ checked })],
      });
    }
    return updateBlockAt(blocks, blockIndex, { items });
  }

  if (block.type === DOC_BLOCK_TYPES.DATE && dataType === NODE_DATA_TYPES.DATE) {
    const { date, time } = normalizeDateContent(content);
    return updateBlockAt(blocks, blockIndex, { date, time });
  }

  if (block.type === DOC_BLOCK_TYPES.METRIC && dataType === NODE_DATA_TYPES.METRIC) {
    const { value, unit } = normalizeMetricContent(content);
    return updateBlockAt(blocks, blockIndex, { value, unit });
  }

  return blocks;
}

/** Opening the node from the doc: prefer block content when present, else node store. */
export function resolveNodeDraftFromDoc(blockContent, node, dataType) {
  if (isNodeWritingBody(blockContent)) {
    return blockContent;
  }

  if (blockContent != null && blockContent !== "") {
    if (dataType === NODE_DATA_TYPES.DATE && typeof blockContent === "object") {
      return normalizeDateContent(blockContent);
    }
    if (dataType === NODE_DATA_TYPES.METRIC && typeof blockContent === "object") {
      return normalizeMetricContent(blockContent);
    }
    if (dataType === NODE_DATA_TYPES.VIDEO && typeof blockContent === "object") {
      return blockContent;
    }
    if (typeof blockContent === "string" && blockContent.trim() !== "") {
      return blockContent;
    }
    if (dataType === NODE_DATA_TYPES.CHECKBOX) {
      if (isNodeTodoContent(blockContent)) return blockContent;
      if (typeof blockContent === "boolean") {
        return normalizeNodeTodoContent(blockContent);
      }
    }
  }

  if (!node) {
    if (dataType === NODE_DATA_TYPES.DATE) return { date: "", time: "" };
    if (dataType === NODE_DATA_TYPES.METRIC) return { value: "", unit: "" };
    if (dataType === NODE_DATA_TYPES.CHECKBOX) {
      return normalizeNodeTodoContent(false);
    }
    if (dataType === NODE_DATA_TYPES.VIDEO) {
      return buildVideoNodeContent(null, "");
    }
    return "";
  }

  if (dataType === NODE_DATA_TYPES.DATE) {
    return normalizeDateContent(node.content);
  }
  if (dataType === NODE_DATA_TYPES.METRIC) {
    return normalizeMetricContent(node.content);
  }
  if (dataType === NODE_DATA_TYPES.CHECKBOX) {
    if (isNodeTodoContent(node.content)) return node.content;
    if (typeof node.content === "boolean") {
      return normalizeNodeTodoContent(node.content);
    }
    return normalizeNodeTodoContent(false);
  }
  if (dataType === NODE_DATA_TYPES.VIDEO) {
    if (node.content && typeof node.content === "object") return node.content;
    return buildVideoNodeContent(null, node.title || "");
  }

  if (isNodeWritingBody(node?.content)) {
    return node.content;
  }

  return resolveTextNodeContent(node.content) ?? "";
}

export function getBlockQueryText(block) {
  if (!block) return "";
  if (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.DATE || block.type === DOC_BLOCK_TYPES.METRIC) {
    return (block.title || block.sourceQuery || "").trim();
  }
  if (block.type === DOC_BLOCK_TYPES.TODO) {
    return (block.listTitle || block.sourceQuery || "").trim();
  }
  return "";
}

export function blockDataType(block, blocks = [], blockIndex = -1) {
  if (block?.type === DOC_BLOCK_TYPES.H1 && blockIndex >= 0 && h1HasVideoEmbedSibling(blocks, blockIndex)) {
    return NODE_DATA_TYPES.VIDEO;
  }
  return nodeDataTypeForBlock(block);
}

export function syncVideoNodeFromH1Blocks(blocks, h1Index, updateNode) {
  if (!updateNode || h1Index < 0) return;
  const normalized = normalizeDocBlocks(blocks);
  const h1 = normalized[h1Index];
  const video = getVideoEmbedBlockAfterH1(normalized, h1Index);
  if (!h1?.nodeId || !video) return;
  const title = (h1.title || h1.sourceQuery || "Untitled query").trim() || "Untitled query";
  updateNode(h1.nodeId, {
    title,
    sourceQuery: title,
    dataType: NODE_DATA_TYPES.VIDEO,
    content: buildVideoNodeContent(video, h1.title || ""),
  });
}

export function syncVideoNodeFromVideoBlock(blocks, videoIndex, videoPatch, updateNode) {
  if (!updateNode || videoIndex < 0) return;
  const normalized = normalizeDocBlocks(blocks);
  const h1Index = videoIndex - 1;
  const h1 = normalized[h1Index];
  if (h1?.type !== DOC_BLOCK_TYPES.H1 || !h1.nodeId) return;
  const video = { ...normalized[videoIndex], ...videoPatch };
  syncVideoNodeFromH1Blocks(
    updateBlockAt(normalized, videoIndex, videoPatch),
    h1Index,
    updateNode,
  );
}

const LINKABLE_NODE_BLOCK_TYPES = new Set([
  DOC_BLOCK_TYPES.H1,
  DOC_BLOCK_TYPES.DATE,
  DOC_BLOCK_TYPES.METRIC,
  DOC_BLOCK_TYPES.TODO,
]);

export function isLinkableNodeBlock(block) {
  return LINKABLE_NODE_BLOCK_TYPES.has(block?.type);
}

/** Block should spawn / sync a canvas child when dragging the parent document. */
export function shouldIncludeBlockOnCanvas(block) {
  return isLinkableNodeBlock(block) && Boolean(block?.queryEnabled || block?.nodeId);
}

function supportsScheduleAnchor(dataType) {
  return dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;
}

/**
 * Create or update the Zustand node for an activated doc block (even with empty content).
 * @returns {string|null} node id
 */
export function ensureNodeForDocBlock({
  block,
  blocks = [],
  blockIndex = -1,
  docId = null,
  docCreatedAt = "",
  nodeId: existingNodeId = null,
  contentOverride = undefined,
  createOrUpdateNodeFromDocBlock,
}) {
  if (!block || !isLinkableNodeBlock(block)) return null;
  if (!block.queryEnabled && !existingNodeId && !block.nodeId) return null;
  if (!createOrUpdateNodeFromDocBlock) return block.nodeId || existingNodeId || null;

  const resolvedNodeId = existingNodeId || block.nodeId || null;
  if (isDocBlockLinkedToNode(block) && resolvedNodeId && contentOverride === undefined) {
    return resolvedNodeId;
  }

  const dataType = blockDataType(block, blocks, blockIndex);
  let content = contentOverride !== undefined
    ? contentOverride
    : getContentForNodeBlock(block, blocks, blockIndex);
  if (block.type === DOC_BLOCK_TYPES.H1 && contentOverride === undefined && dataType === NODE_DATA_TYPES.TEXT) {
    if (!isDocBlockLinkedToNode(block)) {
      const answer = blockIndex >= 0 ? getAnswerBelowH1(blocks, blockIndex) : "";
      if (answer.trim()) content = answer;
    }
  }

  const query = getBlockQueryText(block) || "Untitled query";
  const anchorFields = resolveBlockAnchorFields(block, docCreatedAt);
  const anchorAt = supportsScheduleAnchor(dataType)
    ? isoFromAnchorFields(anchorFields.anchorDate, anchorFields.anchorTime)
    : undefined;

  return createOrUpdateNodeFromDocBlock({
    nodeId: existingNodeId || block.nodeId || null,
    docId,
    blockId: block.id,
    query,
    content,
    dataType,
    docCreatedAt,
    anchorAt,
  });
}

/** True when node body should not be mirrored into doc blocks (linked macro node). */
export function shouldMirrorNodeContentInDoc(block) {
  return !isDocBlockLinkedToNode(block);
}

/** Hide answer TEXT under a linked H1/TODO — content lives in the node entity only. */
export function isTextHiddenByLinkedMacroNode(blocks, textBlockIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[textBlockIndex];
  if (block?.type !== DOC_BLOCK_TYPES.TEXT) return false;
  if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.ANSWER) {
    const ownerIndex = getOwningScheduleBlockIndexForText(normalized, textBlockIndex);
    return ownerIndex >= 0 && isDocBlockLinkedToNode(normalized[ownerIndex]);
  }

  const ownerIndex = getOwningScheduleBlockIndexForText(normalized, textBlockIndex);
  if (ownerIndex < 0) return false;
  const owner = normalized[ownerIndex];
  if (!isDocBlockLinkedToNode(owner)) return false;

  const owned = getOwnedTextBlockIndices(normalized, ownerIndex);
  return owned.includes(textBlockIndex);
}

/** Index of the visible writable TEXT slot below a linked owner (continuation), or owner+1. */
export function getWritableTextIndexBelowLinkedOwner(blocks, ownerIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (!owner || !isDocBlockLinkedToNode(owner)) return ownerIndex + 1;

  const ensured = ensureContinuationAfterLinkedOwner(normalized, ownerIndex);
  const continuationIndex = findMacroContinuationIndex(ensured, ownerIndex);
  if (continuationIndex >= 0) return continuationIndex;

  const tailIndex = getLinkedContinuationTextIndex(ensured, ownerIndex);
  return tailIndex >= 0 ? tailIndex : ownerIndex + 1;
}

/** Linked owner index when textBlockIndex is the writable continuation slot below a macro node. */
export function getLinkedOwnerForContinuationSlot(blocks, textBlockIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[textBlockIndex];
  if (block?.type !== DOC_BLOCK_TYPES.TEXT) return -1;

  if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION) {
    const ownerIndex = getOwningScheduleBlockIndexForText(normalized, textBlockIndex);
    if (ownerIndex >= 0 && isDocBlockLinkedToNode(normalized[ownerIndex])) {
      return ownerIndex;
    }
  }

  if (!isLinkedOwnerContinuationSlot(blocks, textBlockIndex)) return -1;
  for (let ownerIndex = 0; ownerIndex < normalized.length; ownerIndex++) {
    const owner = normalized[ownerIndex];
    if (!isDocBlockLinkedToNode(owner)) continue;
    if (getLinkedContinuationTextIndex(normalized, ownerIndex) === textBlockIndex) {
      return ownerIndex;
    }
  }
  return -1;
}

/**
 * Remove a linked macronode's H1/TODO (and owned answer/video/continuation)
 * from folder blocks. Does not touch the node entity.
 */
export function removeLinkedOwnerBundleFromBlocks(blocks, nodeId) {
  const normalized = normalizeDocBlocks(blocks);
  const targetId = String(nodeId || "").trim();
  if (!targetId) return { blocks: normalized, removed: false };

  const ownerIndex = normalized.findIndex((b) => String(b?.nodeId || "") === targetId);
  if (ownerIndex < 0) return { blocks: normalized, removed: false };

  const owner = normalized[ownerIndex];
  const dropIds = new Set([owner.id]);

  if (
    owner.type === DOC_BLOCK_TYPES.H1
    && normalized[ownerIndex + 1]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
  ) {
    dropIds.add(normalized[ownerIndex + 1].id);
  }

  for (const textIndex of getOwnedTextBlockIndices(normalized, ownerIndex)) {
    dropIds.add(normalized[textIndex].id);
  }

  for (let i = 0; i < normalized.length; i += 1) {
    const block = normalized[i];
    if (block?.macroNodeSlot !== MACRO_NODE_TEXT_SLOT.CONTINUATION) continue;
    if (getOwningScheduleBlockIndexForText(normalized, i) === ownerIndex) {
      dropIds.add(block.id);
    }
  }

  const next = ensureWritableDocTail(
    normalized.filter((block) => !dropIds.has(block.id)),
  );
  return { blocks: next, removed: true };
}

/**
 * Strip linked bundles whose node entity now lives under a different folder.
 * @param {unknown} blocks
 * @param {Record<string, { parentDocId?: string|null }>} nodesById
 * @param {string|null|undefined} folderDocId
 */
export function pruneLinkedBundlesMovedOutOfFolder(blocks, nodesById, folderDocId) {
  const folderId = String(folderDocId || "").trim();
  if (!folderId) return normalizeDocBlocks(blocks);

  let next = normalizeDocBlocks(blocks);
  for (const block of next) {
    if (!block?.nodeId) continue;
    const node = nodesById?.[block.nodeId];
    if (!node) continue;
    if (String(node.parentDocId || "").trim() === folderId) continue;
    next = removeLinkedOwnerBundleFromBlocks(next, block.nodeId).blocks;
  }
  return next;
}

/** Zustand node ids still referenced by saved doc blocks (h1, todo, date, metric, …). */
export function isDocBlockLinkedToNode(block) {
  if (!block?.nodeId || !block.queryEnabled) return false;
  return !isNoNodeLinkMode(resolveBlockNodeLinkColor(block));
}

/**
 * Drop leading empty TEXT shells (placeholder newlines) so a new linked owner
 * starts at the first cell instead of after ~N blank lines.
 * Does not remove ANSWER/CONTINUATION slots or embeds.
 */
export function stripLeadingEmptyTextBlocks(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  let start = 0;
  while (start < normalized.length) {
    const block = normalized[start];
    if (block?.type !== DOC_BLOCK_TYPES.TEXT) break;
    if (block.macroNodeSlot) break;
    if (block.embedded?.kind) break;
    if (!isEmptyTextBlock(block)) break;
    start += 1;
  }
  return start === 0 ? normalized : normalized.slice(start);
}

/**
 * When Create a new Document syncs into a parent folder, the open editor draft
 * may lag behind the store. Append any linked owner bundles missing from draft.
 */
export function mergeMissingLinkedOwnerBundles(draftBlocks, storeBlocks) {
  const draft = normalizeDocBlocks(draftBlocks);
  const store = normalizeDocBlocks(storeBlocks);
  const draftNodeIds = new Set();
  for (const block of draft) {
    if (block?.nodeId) draftNodeIds.add(block.nodeId);
  }

  const toAppend = [];
  const consumed = new Set();
  for (let i = 0; i < store.length; i += 1) {
    if (consumed.has(i)) continue;
    const owner = store[i];
    if (!isDocBlockLinkedToNode(owner)) continue;
    if (draftNodeIds.has(owner.nodeId)) continue;

    toAppend.push(owner);
    consumed.add(i);

    if (
      owner.type === DOC_BLOCK_TYPES.H1
      && store[i + 1]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
    ) {
      toAppend.push(store[i + 1]);
      consumed.add(i + 1);
    }

    for (const textIndex of getOwnedTextBlockIndices(store, i)) {
      if (consumed.has(textIndex)) continue;
      const textBlock = store[textIndex];
      if (isMacroContinuationTextBlock(textBlock)) continue;
      toAppend.push(textBlock);
      consumed.add(textIndex);
    }
  }

  if (!toAppend.length) return draftBlocks;
  // First linked title into an empty-ish draft: collapse leading blank TEXTs.
  const base = stripLeadingEmptyTextBlocks(draft);
  return ensureWritableDocTail([...base, ...toAppend]);
}

/**
 * Merge missing linked owners, but never remarge hard-deleted / missing entities.
 * Also strips ghost linked bundles from the draft when the node no longer exists.
 *
 * @param {object[]} draftBlocks
 * @param {object[]} storeBlocks
 * @param {Record<string, object>} [liveNodesById]
 * @param {(nodeId: string) => boolean} [isDeleted]
 */
export function mergeMissingLinkedOwnerBundlesLive(
  draftBlocks,
  storeBlocks,
  liveNodesById = {},
  isDeleted = () => false,
) {
  const isLive = (nodeId) => {
    const id = String(nodeId || "").trim();
    if (!id) return false;
    if (isDeleted(id)) return false;
    return Boolean(liveNodesById[id]);
  };

  let draft = normalizeDocBlocks(draftBlocks);
  for (const block of [...draft]) {
    if (!block?.nodeId || isLive(block.nodeId)) continue;
    draft = removeLinkedOwnerBundleFromBlocks(draft, block.nodeId).blocks;
  }

  const filteredStore = normalizeDocBlocks(storeBlocks).filter((block) => {
    if (!block?.nodeId) return true;
    if (!isDocBlockLinkedToNode(block)) return true;
    return isLive(block.nodeId);
  });

  return mergeMissingLinkedOwnerBundles(draft, filteredStore);
}

/**
 * Node title is source of truth for linked macronodes.
 * Align H1/TODO/DATE/METRIC block titles with the linked node entity.
 */
export function reconcileLinkedBlockTitlesFromNodes(blocks, nodesById = {}) {
  const normalized = normalizeDocBlocks(blocks);
  let changed = false;
  const next = normalized.map((block) => {
    if (!isDocBlockLinkedToNode(block)) return block;
    const node = nodesById[block.nodeId];
    if (!node) return block;
    const synced = (node.sourceQuery || node.title || "").trim();
    if (!synced) return block;

    if (
      block.type === DOC_BLOCK_TYPES.H1
      || block.type === DOC_BLOCK_TYPES.DATE
      || block.type === DOC_BLOCK_TYPES.METRIC
    ) {
      if ((block.title || "").trim() === synced && (block.sourceQuery || "").trim() === synced) {
        return block;
      }
      changed = true;
      return { ...block, title: synced, sourceQuery: synced };
    }

    if (block.type === DOC_BLOCK_TYPES.TODO) {
      if ((block.listTitle || "").trim() === synced && (block.sourceQuery || "").trim() === synced) {
        return block;
      }
      changed = true;
      return { ...block, listTitle: synced, sourceQuery: synced };
    }

    return block;
  });
  return changed ? next : normalized;
}

/** H1 index when textBlockIndex is the primary answer slot under a linked H1, else -1. */
export function getLinkedOwnerIndexForTextBlock(blocks, textBlockIndex) {
  const h1Index = getH1IndexForTextBlock(blocks, textBlockIndex);
  if (h1Index < 0) return -1;
  const normalized = normalizeDocBlocks(blocks);
  const h1 = normalized[h1Index];
  if (!isDocBlockLinkedToNode(h1)) return -1;
  const owned = getOwnedTextBlockIndices(normalized, h1Index);
  return owned[0] === textBlockIndex ? h1Index : -1;
}

/** Empty TEXT slot directly after a linked H1/Todo answer — for continued writing / new blocks. */
export function ensureContinuationAfterLinkedOwner(blocks, ownerIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (!owner || !isDocBlockLinkedToNode(owner)) return normalized;
  if (owner.type !== DOC_BLOCK_TYPES.H1 && owner.type !== DOC_BLOCK_TYPES.TODO) {
    return normalized;
  }

  let next = normalized;
  const owned = getOwnedTextBlockIndices(next, ownerIndex);

  for (const textIndex of owned) {
    const textBlock = next[textIndex];
    if (textBlock?.macroNodeSlot !== MACRO_NODE_TEXT_SLOT.ANSWER) {
      next = updateBlockAt(next, textIndex, { macroNodeSlot: MACRO_NODE_TEXT_SLOT.ANSWER });
    }
  }

  const existingContinuation = findMacroContinuationIndex(next, ownerIndex);
  if (existingContinuation >= 0) return next;

  const insertAfterIndex = owned.length > 0 ? owned[owned.length - 1] : ownerIndex;
  return insertBlockAfter(
    next,
    insertAfterIndex,
    createDocBlock(DOC_BLOCK_TYPES.TEXT, {
      text: "",
      macroNodeSlot: MACRO_NODE_TEXT_SLOT.CONTINUATION,
    }),
  );
}

/** Ensure every linked H1/TODO has an answer stamp + empty continuation slot. */
export function ensureAllLinkedOwnerContinuationSlots(blocks) {
  let next = normalizeDocBlocks(blocks);
  for (let i = 0; i < next.length; i += 1) {
    const block = next[i];
    if (
      (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO)
      && isDocBlockLinkedToNode(block)
    ) {
      next = ensureContinuationAfterLinkedOwner(next, i);
    }
  }
  return next;
}

/** True when this TEXT block holds the node-linked answer (syncs to node). */
export function isPrimaryAnswerTextForLinkedOwner(blocks, textBlockIndex) {
  return getLinkedOwnerIndexForTextBlock(blocks, textBlockIndex) >= 0;
}

/** True when this empty TEXT block is the writable tail below a linked owner. */
export function isLinkedOwnerContinuationSlot(blocks, textBlockIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[textBlockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return false;

  if (block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION) {
    const ownerIndex = getOwningScheduleBlockIndexForText(normalized, textBlockIndex);
    return ownerIndex >= 0 && isDocBlockLinkedToNode(normalized[ownerIndex]);
  }

  if (!isEmptyTextBlock(block)) return false;

  for (let ownerIndex = 0; ownerIndex < normalized.length; ownerIndex++) {
    const owner = normalized[ownerIndex];
    if (
      (owner.type !== DOC_BLOCK_TYPES.H1 && owner.type !== DOC_BLOCK_TYPES.TODO)
      || !isDocBlockLinkedToNode(owner)
    ) {
      continue;
    }
    const owned = getOwnedTextBlockIndices(normalized, ownerIndex);
    const tailIndex = owned.length > 0 ? owned[owned.length - 1] + 1 : ownerIndex + 1;
    if (tailIndex === textBlockIndex) return true;
  }
  return false;
}

/** TEXT index of the writable tail below a linked owner, or -1. */
export function getLinkedContinuationTextIndex(blocks, ownerIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (!owner || !isDocBlockLinkedToNode(owner)) return -1;
  if (owner.type !== DOC_BLOCK_TYPES.H1 && owner.type !== DOC_BLOCK_TYPES.TODO) {
    return -1;
  }

  const marked = findMacroContinuationIndex(normalized, ownerIndex);
  if (marked >= 0) return marked;

  const owned = getOwnedTextBlockIndices(normalized, ownerIndex);
  const tailIndex = owned.length > 0 ? owned[owned.length - 1] + 1 : ownerIndex + 1;
  return isLinkedOwnerContinuationSlot(normalized, tailIndex) ? tailIndex : -1;
}

const UNLINK_BLOCK_PATCH = {
  nodeId: undefined,
  queryEnabled: false,
  nodeLinkColor: NO_NODE_LINK_COLOR_ID,
  anchorFromNode: false,
  anchorDate: "",
  anchorTime: "",
  sourceQuery: undefined,
};

/** Detach node link: keep doc content as local copy, drop color + schedule on owner block. */
export function unlinkNodeFromDocBlocks(blocks, ownerIndex, node = null, options = {}) {
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (!owner?.nodeId) return normalized;

  const fallbackText = node ? nodeContentAsString(node) : "";

  if (owner.type === DOC_BLOCK_TYPES.H1) {
    const owned = getOwnedTextBlockIndices(normalized, ownerIndex);
    const primaryTextIndex = owned[0] ?? -1;

    const cleared = normalized.map((block, i) => {
      if (i === ownerIndex) {
        return normalizeDocBlock({ ...block, ...UNLINK_BLOCK_PATCH });
      }
      if (i === primaryTextIndex) {
        const text = block.text || fallbackText;
        if (options.textBlockEmbedded !== undefined) {
          return normalizeDocBlock({
            ...block,
            text,
            embedded: options.textBlockEmbedded,
            macroNodeSlot: undefined,
          });
        }
        if (block.embedded?.kind === "calendar-event" || block.embedded?.kind === "weather-forecast") {
          return normalizeDocBlock({
            ...block,
            text,
            embedded: { ...block.embedded, linkedNodeId: null },
            macroNodeSlot: undefined,
          });
        }
        return normalizeDocBlock({ ...block, text, embedded: undefined, macroNodeSlot: undefined });
      }
      if (
        block.macroNodeSlot === MACRO_NODE_TEXT_SLOT.CONTINUATION
        && getOwningScheduleBlockIndexForText(normalized, i) === ownerIndex
        && isEmptyTextBlock(block)
      ) {
        return null;
      }
      if (
        block.macroNodeSlot
        && getOwningScheduleBlockIndexForText(normalized, i) === ownerIndex
      ) {
        return normalizeDocBlock({ ...block, macroNodeSlot: undefined });
      }
      return block;
    }).filter(Boolean);

    return normalizeDocBlocks(cleared);
  }

  if (owner.type === DOC_BLOCK_TYPES.TODO && node) {
    if (isNodeTodoContent(node.content)) {
      const normalized = normalizeNodeTodoContent(node.content, owner.listTitle);
      return normalized.map((block, i) => {
        if (i !== ownerIndex) return block;
        return normalizeDocBlock({
          ...block,
          ...UNLINK_BLOCK_PATCH,
          listTitle: normalized.listTitle,
          items: normalized.items,
        });
      });
    }
    const checked = typeof node.content === "boolean" ? node.content : nodeTodoMacroChecked(node.content);
    return normalized.map((block, i) => {
      if (i !== ownerIndex) return block;
      const items = (block.items || []).map((item, idx) =>
        idx === 0 ? { ...item, checked } : item,
      );
      return normalizeDocBlock({ ...block, ...UNLINK_BLOCK_PATCH, items });
    });
  }

  return normalized.map((block, i) =>
    i === ownerIndex
      ? normalizeDocBlock({ ...block, ...UNLINK_BLOCK_PATCH })
      : block,
  );
}

export function collectNodeIdsReferencedByBlocks(blocks) {
  const ids = new Set();
  for (const block of normalizeDocBlocks(blocks)) {
    if (block?.nodeId) ids.add(block.nodeId);
  }
  return ids;
}

/**
 * Unique H1/TODO owner nodeIds in document order (first appearance).
 * @param {object[]} blocks
 * @returns {string[]}
 */
export function linkedOwnerNodeIdsInOrder(blocks) {
  const ids = [];
  const seen = new Set();
  for (const block of normalizeDocBlocks(blocks)) {
    if (!block?.nodeId || seen.has(block.nodeId)) continue;
    if (block.type !== DOC_BLOCK_TYPES.H1 && block.type !== DOC_BLOCK_TYPES.TODO) continue;
    seen.add(block.nodeId);
    ids.push(block.nodeId);
  }
  return ids;
}

/** Nodes still belonging to a folder (panel membership), with or without body layers. */
export function collectFolderMemberNodeIds(docId, nodesById = {}) {
  const ids = new Set();
  if (!docId) return ids;
  for (const node of Object.values(nodesById)) {
    if (node?.parentDocId === docId) ids.add(node.id);
  }
  return ids;
}

/**
 * Union of block-linked node ids and folder members (`parentDocId === docId`).
 * Unlinked docs stay on the left panel without body layers.
 */
export function collectDocNodeIdsForSave(docId, blocks, nodesById = {}) {
  const ids = collectNodeIdsReferencedByBlocks(blocks);
  for (const id of collectFolderMemberNodeIds(docId, nodesById)) {
    ids.add(id);
  }
  return [...ids];
}

/**
 * @deprecated Hard-delete after save must not treat "parentDocId without block"
 * as orphan — those are intentional folder members. Always returns [].
 */
export function findOrphanNodeIdsForDoc() {
  return [];
}
