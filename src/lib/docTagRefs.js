import { generateId } from "./ids.js";
import { computeTextEditDelta } from "./docTextBoldRanges.js";

/** Mirror of MOODBOARD_FILE_ICON_SRC — keep in sync (avoid circular import with docBlocks). */
const MOODBOARD_FILE_THUMB = "/uploads/Folders/MediaFolder.png";

/**
 * @typedef {Object} DocTagRef
 * @property {string} id
 * @property {string} slotId
 * @property {string} blockId
 * @property {string} label
 * @property {number} start
 * @property {number} end
 * @property {string} insertedAt
 */

/**
 * @typedef {Object} TagRefQuery
 * @property {number} start - index of '#'
 * @property {number} end - caret index
 * @property {string} query - text after '#'
 */

/**
 * @typedef {Object} TagRefSegment
 * @property {'plain'|'tagRef'} type
 * @property {string} text
 * @property {DocTagRef} [tagRef]
 */

/** @param {unknown} value */
function asText(value) {
  return String(value ?? "");
}

/** @param {unknown} value */
export function normalizeTagRefLabel(value) {
  return String(value ?? "")
    .trim()
    .replace(/^#+/, "")
    .slice(0, 64);
}

/** Case-insensitive compare key for tag labels. */
export function normalizeTagRefKey(value) {
  return normalizeTagRefLabel(value).toLowerCase();
}

/**
 * @param {string} text
 * @param {unknown} tagRefs
 * @returns {DocTagRef[]}
 */
export function normalizeTagRefs(text, tagRefs) {
  const str = asText(text);
  if (!Array.isArray(tagRefs) || tagRefs.length === 0) return [];

  /** @type {DocTagRef[]} */
  const cleaned = [];
  for (const raw of tagRefs) {
    if (!raw || typeof raw !== "object") continue;
    const label = normalizeTagRefLabel(raw.label);
    if (!label) continue;
    let start = Number(raw.start);
    let end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    start = Math.max(0, Math.min(str.length, Math.floor(start)));
    end = Math.max(0, Math.min(str.length, Math.floor(end)));
    if (end <= start) continue;

    const slice = str.slice(start, end);
    // Bare label only — "#" is never stored in the text.
    if (normalizeTagRefKey(slice) !== normalizeTagRefKey(label)) continue;

    cleaned.push({
      id: String(raw.id || generateId("TGR")),
      slotId: String(raw.slotId || ""),
      blockId: String(raw.blockId || ""),
      label,
      start,
      end,
      insertedAt: String(raw.insertedAt || new Date().toISOString()),
    });
  }

  cleaned.sort((a, b) => a.start - b.start || a.end - b.end);

  /** @type {DocTagRef[]} */
  const nonOverlapping = [];
  for (const tagRef of cleaned) {
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (prev && tagRef.start < prev.end) continue;
    nonOverlapping.push(tagRef);
  }
  return nonOverlapping;
}

/**
 * Detect an active `#query` immediately before the caret.
 * Only opens when `#` is at start or preceded by whitespace.
 * @param {string} text
 * @param {number} caret
 * @returns {TagRefQuery|null}
 */
export function getTagRefQueryAtCaret(text, caret) {
  const str = asText(text);
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  if (pos === 0) return null;

  let hash = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = str[i];
    if (ch === "#") {
      hash = i;
      break;
    }
    if (!/[A-Za-z0-9_.-]/.test(ch)) return null;
  }
  if (hash < 0) return null;
  if (hash > 0 && !/\s/.test(str[hash - 1])) return null;

  return {
    start: hash,
    end: pos,
    query: str.slice(hash + 1, pos),
  };
}

/**
 * @param {DocTagRef[]} tagRefs
 * @param {number} editStart
 * @param {number} removedLength
 * @param {number} insertedLength
 * @param {string} nextText
 * @returns {DocTagRef[]}
 */
export function shiftTagRefs(tagRefs, editStart, removedLength, insertedLength, nextText) {
  const editEnd = editStart + removedLength;
  const delta = insertedLength - removedLength;
  /** @type {DocTagRef[]} */
  const out = [];

  for (const tagRef of tagRefs || []) {
    if (tagRef.end <= editStart) {
      out.push(tagRef);
      continue;
    }
    if (tagRef.start >= editEnd) {
      out.push({
        ...tagRef,
        start: tagRef.start + delta,
        end: tagRef.end + delta,
      });
      continue;
    }
    // Any edit that touches a tag-ref range drops the linked metadata.
  }

  return normalizeTagRefs(nextText, out);
}

/**
 * @param {string} prevText
 * @param {string} nextText
 * @param {DocTagRef[]} tagRefs
 * @returns {DocTagRef[]}
 */
export function applyTextEditToTagRefs(prevText, nextText, tagRefs) {
  if (asText(prevText) === asText(nextText)) {
    return normalizeTagRefs(nextText, tagRefs);
  }
  const { editStart, removedLength, insertedLength } = computeTextEditDelta(prevText, nextText);
  return shiftTagRefs(tagRefs, editStart, removedLength, insertedLength, nextText);
}

/**
 * Replace the active `#query` with the bare label (no "#") and attach a tag ref.
 * Requires slotId + blockId — never store a broken local link.
 * @param {string} text
 * @param {DocTagRef[]} tagRefs
 * @param {TagRefQuery} activeQuery
 * @param {{ slotId: string, blockId: string, label: string }} candidate
 * @returns {{ text: string, tagRefs: DocTagRef[], caret: number }}
 */
export function insertTagRefAtQuery(text, tagRefs, activeQuery, candidate) {
  const str = asText(text);
  const label = normalizeTagRefLabel(candidate?.label);
  const slotId = String(candidate?.slotId || "").trim();
  const blockId = String(candidate?.blockId || "").trim();
  if (!label || !activeQuery || !slotId || !blockId) {
    return { text: str, tagRefs: normalizeTagRefs(str, tagRefs), caret: str.length };
  }

  const before = str.slice(0, activeQuery.start);
  const after = str.slice(activeQuery.end);
  const needsSpace = after.length > 0 && !/^\s/.test(after);
  const insertion = needsSpace ? `${label} ` : label;
  const nextText = before + insertion + after;
  const start = before.length;
  const end = start + label.length;

  const nextTagRef = {
    id: generateId("TGR"),
    slotId,
    blockId,
    label,
    start,
    end,
    insertedAt: new Date().toISOString(),
  };

  const cleared = shiftTagRefs(
    tagRefs,
    activeQuery.start,
    activeQuery.end - activeQuery.start,
    insertion.length,
    nextText,
  );

  return {
    text: nextText,
    tagRefs: normalizeTagRefs(nextText, [...cleared, nextTagRef]),
    caret: start + insertion.length,
  };
}

/**
 * @param {string} text
 * @param {DocTagRef[]} tagRefs
 * @returns {TagRefSegment[]}
 */
export function tagRefsToSegments(text, tagRefs) {
  const str = asText(text);
  const list = normalizeTagRefs(str, tagRefs);
  if (!list.length) {
    return str ? [{ type: "plain", text: str }] : [];
  }

  /** @type {TagRefSegment[]} */
  const segments = [];
  let cursor = 0;
  for (const tagRef of list) {
    if (tagRef.start > cursor) {
      segments.push({ type: "plain", text: str.slice(cursor, tagRef.start) });
    }
    segments.push({
      type: "tagRef",
      text: str.slice(tagRef.start, tagRef.end),
      tagRef,
    });
    cursor = tagRef.end;
  }
  if (cursor < str.length) {
    segments.push({ type: "plain", text: str.slice(cursor) });
  }
  return segments;
}

/**
 * @param {DocTagRef[]} tagRefs
 * @param {number} offset
 * @returns {DocTagRef|null}
 */
export function findTagRefAtOffset(tagRefs, offset) {
  const pos = Number(offset);
  if (!Number.isFinite(pos)) return null;
  for (const tagRef of tagRefs || []) {
    if (pos >= tagRef.start && pos < tagRef.end) return tagRef;
  }
  return null;
}

/**
 * Delete a whole tag-ref chip in one keystroke.
 * Backspace: caret right after the chip (or inside it).
 * Delete: caret at the start of / inside the chip.
 * Also handles a selection that exactly covers one chip.
 *
 * @param {string} text
 * @param {DocTagRef[]} tagRefs
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @param {'Backspace'|'Delete'} key
 * @returns {{ text: string, tagRefs: DocTagRef[], caret: number } | null}
 */
export function deleteTagRefAtomically(text, tagRefs, selectionStart, selectionEnd, key) {
  const str = asText(text);
  const list = normalizeTagRefs(str, tagRefs);
  if (!list.length) return null;

  const start = Math.max(0, Math.min(str.length, Number(selectionStart) || 0));
  const end = Math.max(0, Math.min(str.length, Number(selectionEnd) || 0));
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  /** @type {DocTagRef|null} */
  let target = null;
  if (lo !== hi) {
    target = list.find((tagRef) => tagRef.start === lo && tagRef.end === hi) || null;
  } else if (key === "Backspace") {
    if (lo <= 0) return null;
    target = list.find((tagRef) => tagRef.end === lo) || findTagRefAtOffset(list, lo - 1);
  } else if (key === "Delete") {
    if (lo >= str.length) return null;
    target = findTagRefAtOffset(list, lo);
  }

  if (!target) return null;

  const nextText = str.slice(0, target.start) + str.slice(target.end);
  const nextTagRefs = shiftTagRefs(
    list,
    target.start,
    target.end - target.start,
    0,
    nextText,
  );
  return {
    text: nextText,
    tagRefs: nextTagRefs,
    caret: target.start,
  };
}

/**
 * Filter moodboard tag candidates by query.
 * @param {Array<{ label: string, slotId?: string, blockId?: string, thumbSrc?: string }>} candidates
 * @param {string} query
 * @param {number} [limit=8]
 */
export function filterTagRefCandidates(candidates, query, limit = 8) {
  const q = normalizeTagRefKey(query);
  const list = Array.isArray(candidates) ? candidates : [];
  const filtered = !q
    ? list
    : list.filter((item) => normalizeTagRefKey(item.label).includes(q));
  return filtered.slice(0, limit);
}

/**
 * Merge tag refs when concatenating two text blocks with a separator.
 * @param {string} leftText
 * @param {DocTagRef[]} leftTagRefs
 * @param {string} rightText
 * @param {DocTagRef[]} rightTagRefs
 * @param {string} [separator]
 */
export function mergeTagRefBlocks(leftText, leftTagRefs, rightText, rightTagRefs, separator = "\n") {
  const left = asText(leftText);
  const right = asText(rightText);
  const sep = asText(separator);
  const nextText = `${left}${sep}${right}`;
  const offset = left.length + sep.length;
  const shiftedRight = (rightTagRefs || []).map((tagRef) => ({
    ...tagRef,
    start: tagRef.start + offset,
    end: tagRef.end + offset,
  }));
  return {
    text: nextText,
    tagRefs: normalizeTagRefs(nextText, [...(leftTagRefs || []), ...shiftedRight]),
  };
}

/**
 * Scroll to a moodboard image slot in the open document and pulse it.
 * Same-document only. Cascades: slotId → label in block → block container.
 * @param {{ blockId?: string, slotId?: string, label?: string }} target
 * @returns {boolean}
 */
export function scrollToMoodboardSlot(target) {
  if (typeof document === "undefined") return false;
  const blockId = String(target?.blockId || "").trim();
  const slotId = String(target?.slotId || "").trim();
  const label = normalizeTagRefLabel(target?.label);
  if (!blockId && !slotId && !label) return false;

  const escape = (value) => {
    const str = String(value ?? "");
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(str);
    }
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  };

  const pulse = (el) => {
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("doc-moodboard__cell--pulse");
    window.setTimeout(() => {
      el.classList.remove("doc-moodboard__cell--pulse");
    }, 1200);
  };

  const findBlockRoot = (id) => {
    if (!id) return null;
    const esc = escape(id);
    return document.querySelector(`[data-block-id="${esc}"]`)
      || document.querySelector(`[data-writing-block-id="${esc}"]`);
  };

  // 1) Prefer exact slot id (document-wide).
  if (slotId) {
    const cell = document.querySelector(`[data-mb-slot="${escape(slotId)}"]`);
    if (cell) {
      pulse(cell);
      return true;
    }
  }

  // 2) Within the moodboard block, match by visible tag label.
  const blockRoot = findBlockRoot(blockId);
  if (blockRoot && label) {
    const labels = blockRoot.querySelectorAll(".doc-moodboard__tag-label, .doc-moodboard__info");
    for (const node of labels) {
      if (normalizeTagRefKey(node.textContent) !== normalizeTagRefKey(label)) continue;
      const cell = node.closest(".doc-moodboard__cell") || node.closest(".doc-moodboard__info-row") || node;
      pulse(cell);
      return true;
    }
  }

  // 3) First image cell inside the block.
  if (blockRoot) {
    const cell = blockRoot.querySelector(".doc-moodboard__cell");
    if (cell) {
      pulse(cell);
      return true;
    }
    pulse(blockRoot);
    return true;
  }

  // 4) Last resort: any moodboard cell whose tag matches the label.
  if (label) {
    const labels = document.querySelectorAll(".doc-moodboard__tag-label");
    for (const node of labels) {
      if (normalizeTagRefKey(node.textContent) !== normalizeTagRefKey(label)) continue;
      const cell = node.closest(".doc-moodboard__cell") || node;
      pulse(cell);
      return true;
    }
  }

  return false;
}

/**
 * Collect tagged moodboard image slots from doc blocks.
 * Skips slots missing a stable slotId or blockId (cannot link locally).
 * @param {Array<{ id?: string, type?: string, columns?: object[] }>} blocks
 * @returns {Array<{ slotId: string, blockId: string, label: string, thumbSrc: string }>}
 */
export function collectMoodboardTagCandidates(blocks) {
  const out = [];
  for (const block of blocks || []) {
    if (block?.type !== "moodboard") continue;
    const blockId = String(block.id || "").trim();
    if (!blockId) continue;
    const columns = Array.isArray(block.columns) ? block.columns : [];
    for (const column of columns) {
      const images = Array.isArray(column?.images) ? column.images : [];
      for (const image of images) {
        if (!image?.imageSaved) continue;
        if (!image?.src && !image?.externalUrl) continue;
        const label = normalizeTagRefLabel(image.tagLabel);
        const slotId = String(image.slotId || "").trim();
        if (!label || !slotId) continue;
        out.push({
          slotId,
          blockId,
          label,
          thumbSrc: String(image.src || MOODBOARD_FILE_THUMB),
        });
      }
    }
  }
  return out;
}

