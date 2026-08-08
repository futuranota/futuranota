import {
  DOC_BLOCK_TYPES,
  ensureWritableDocTail,
  normalizeDocBlocks,
} from "./docBlocks.js";
import {
  getOwnedTextBlockIndices,
  getOwningScheduleBlockIndexForText,
  MACRO_NODE_TEXT_SLOT,
} from "./docNodeSync.js";
import { moveIdBeforeTarget } from "./folderSidebarOrder.js";

/** HTML5 DnD mime for documents inside a folder (left-panel collapse). */
export const FOLDER_DOC_REORDER_MIME = "application/x-futura-nota-folder-doc-reorder";

/** H1/TODO that owns a folder document membership via nodeId. */
function isFolderDocumentOwnerBlock(block, nodeIdSet) {
  if (!block?.nodeId || !nodeIdSet?.has(block.nodeId)) return false;
  return block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO;
}

/**
 * Inclusive end index of a linked owner bundle starting at ownerIndex
 * (owner + optional video + owned TEXT + CONTINUATION slots).
 * @param {object[]} blocks
 * @param {number} ownerIndex
 */
export function getLinkedOwnerBundleEndIndex(blocks, ownerIndex) {
  const normalized = normalizeDocBlocks(blocks);
  const owner = normalized[ownerIndex];
  if (
    !owner
    || (owner.type !== DOC_BLOCK_TYPES.H1 && owner.type !== DOC_BLOCK_TYPES.TODO)
    || !owner.nodeId
  ) {
    return ownerIndex;
  }

  let end = ownerIndex;
  if (
    owner.type === DOC_BLOCK_TYPES.H1
    && normalized[ownerIndex + 1]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
  ) {
    end = ownerIndex + 1;
  }

  for (const textIndex of getOwnedTextBlockIndices(normalized, ownerIndex)) {
    if (textIndex > end) end = textIndex;
  }

  for (let i = ownerIndex + 1; i < normalized.length; i += 1) {
    const block = normalized[i];
    if (block?.macroNodeSlot !== MACRO_NODE_TEXT_SLOT.CONTINUATION) continue;
    if (getOwningScheduleBlockIndexForText(normalized, i) === ownerIndex) {
      if (i > end) end = i;
    }
  }

  return end;
}

/**
 * Partition blocks into loose runs and linked owner bundles (for nodeIds in `nodeIdSet`).
 * @param {object[]} blocks
 * @param {Set<string>} nodeIdSet
 * @returns {Array<{ type: 'loose', blocks: object[] } | { type: 'bundle', nodeId: string, blocks: object[] }>}
 */
export function partitionLinkedOwnerSegments(blocks, nodeIdSet) {
  const normalized = normalizeDocBlocks(blocks);
  const set = nodeIdSet instanceof Set ? nodeIdSet : new Set(nodeIdSet || []);
  /** @type {Array<{ type: 'loose', blocks: object[] } | { type: 'bundle', nodeId: string, blocks: object[] }>} */
  const segments = [];
  let i = 0;
  while (i < normalized.length) {
    const block = normalized[i];
    if (isFolderDocumentOwnerBlock(block, set)) {
      const end = getLinkedOwnerBundleEndIndex(normalized, i);
      segments.push({
        type: "bundle",
        nodeId: block.nodeId,
        blocks: normalized.slice(i, end + 1),
      });
      i = end + 1;
      continue;
    }
    const loose = [block];
    i += 1;
    while (i < normalized.length) {
      const next = normalized[i];
      if (isFolderDocumentOwnerBlock(next, set)) break;
      loose.push(next);
      i += 1;
    }
    segments.push({ type: "loose", blocks: loose });
  }
  return segments;
}

/**
 * Reorder linked owner bundles to match `orderedNodeIds`, keeping loose blocks in place.
 * @param {object[]} blocks
 * @param {string[]} orderedNodeIds
 */
export function reorderLinkedOwnerBundlesInBlocks(blocks, orderedNodeIds) {
  const ids = (orderedNodeIds || []).filter(Boolean);
  if (!ids.length) return normalizeDocBlocks(blocks);

  const idSet = new Set(ids);
  const segments = partitionLinkedOwnerSegments(blocks, idSet);
  const bundleSegs = segments.filter((s) => s.type === "bundle");
  if (!bundleSegs.length) return normalizeDocBlocks(blocks);

  const byId = new Map();
  for (const seg of bundleSegs) {
    if (!byId.has(seg.nodeId)) byId.set(seg.nodeId, seg);
  }

  const reordered = [];
  const used = new Set();
  for (const id of ids) {
    const seg = byId.get(id);
    if (!seg || used.has(id)) continue;
    reordered.push(seg);
    used.add(id);
  }
  for (const seg of bundleSegs) {
    if (used.has(seg.nodeId)) continue;
    reordered.push(seg);
    used.add(seg.nodeId);
  }

  let bi = 0;
  const out = [];
  for (const seg of segments) {
    if (seg.type === "loose") {
      out.push(...seg.blocks);
    } else {
      const nextBundle = reordered[bi++];
      if (nextBundle) out.push(...nextBundle.blocks);
    }
  }
  return ensureWritableDocTail(out);
}

/**
 * Merge visible reorder into full nodeIds list (members not in the dragged list stay put).
 * @param {string[]} fullIds
 * @param {string[]} visibleOrderedIds
 */
export function applyVisibleNodeReorder(fullIds, visibleOrderedIds) {
  const full = Array.isArray(fullIds) ? fullIds.filter(Boolean) : [];
  const visible = Array.isArray(visibleOrderedIds) ? visibleOrderedIds.filter(Boolean) : [];
  if (!visible.length) return full;

  const visibleSet = new Set(visible);
  let vi = 0;
  const next = full.map((id) => (visibleSet.has(id) ? visible[vi++] : id));
  while (vi < visible.length) {
    if (!next.includes(visible[vi])) next.push(visible[vi]);
    vi += 1;
  }
  return next;
}

export { moveIdBeforeTarget };

/**
 * Solid row preview for document reorder inside a folder.
 * @param {DataTransfer} dataTransfer
 * @param {HTMLElement | null | undefined} sourceEl
 * @param {DragEvent | { clientX: number, clientY: number } | null} [event]
 */
export function setFolderDocDragImage(dataTransfer, sourceEl, event = null) {
  if (!dataTransfer || !sourceEl || typeof dataTransfer.setDragImage !== "function") return;
  const rect = sourceEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const clone = sourceEl.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return;
  clone.classList.add("lp-doc-nodes-block__node--drag-image");
  clone.classList.remove("is-folder-doc-dragging", "is-folder-doc-drag-over", "is-gina-reveal");

  Object.assign(clone.style, {
    position: "fixed",
    top: "-10000px",
    left: "-10000px",
    width: `${Math.round(rect.width)}px`,
    margin: "0",
    zIndex: "99999",
    pointerEvents: "none",
    opacity: "1",
  });
  document.body.appendChild(clone);

  const clientX = event && typeof event.clientX === "number" ? event.clientX : rect.left + 16;
  const clientY = event && typeof event.clientY === "number" ? event.clientY : rect.top + 10;
  const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const offsetY = Math.max(0, Math.min(rect.height, clientY - rect.top));
  dataTransfer.setDragImage(clone, offsetX, offsetY);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      clone.remove();
    });
  });
}
