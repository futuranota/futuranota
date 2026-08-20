/**
 * Organize pasted / messy document prose into real H1/H2/H3 + TEXT blocks.
 *
 * Live `#` rules stay intact: `#i` / `#o` are Library actions (never headings).
 * Heading structure is created as block types — not by typing `#` / `##` into the textarea.
 *
 * Packs body text into writing cells using measured / default char capacity so empty
 * expanded cells get filled and dead empty gaps collapse.
 */

import { createDocBlock, DOC_BLOCK_TYPES, ensureWritableDocTail, normalizeDocBlocks } from "./docBlocks.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  createInlineH2Block,
  createInlineH3Block,
  ensureNodeWritingTail,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";
import {
  DEFAULT_CELL_CHARS,
  packTextIntoCellChunks,
  resolvePackCellChars,
} from "./organizeDocCellCapacity.js";

const LIBRARY_HASH_RE = /^#(i|o|input|output)(\s|$)/i;

/**
 * Exact Library hash lines — must stay plain TEXT forever.
 * @param {string} line
 */
export function isLibraryHashLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return false;
  return LIBRARY_HASH_RE.test(t);
}

/**
 * @param {string} text
 */
export function normalizeSocialPasteText(text) {
  const raw = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");

  const lines = raw.split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  const repaired = repairSoftWrappedLines(lines);

  /** @type {string[]} */
  const paragraphs = [];
  /** @type {string[]} */
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    const joined = buf.join("\n").trim();
    if (joined) paragraphs.push(joined);
    buf = [];
  };

  for (const line of repaired) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const standalone = isStrictHeadingCandidate(trimmed)
      || isLibraryHashLine(trimmed)
      || isMarkdownHeadingLine(trimmed)
      || isSoftHeadingCandidate(trimmed);
    if (standalone) {
      flush();
      paragraphs.push(trimmed);
      continue;
    }
    buf.push(trimmed);
  }
  flush();

  return paragraphs;
}

/**
 * Join mid-sentence soft wraps common in social / mobile paste.
 * @param {string[]} lines
 */
function repairSoftWrappedLines(lines) {
  /** @type {string[]} */
  const out = [];
  for (const line of lines) {
    if (!out.length) {
      out.push(line);
      continue;
    }
    const prev = out[out.length - 1];
    if (shouldJoinSoftWrap(prev, line)) {
      out[out.length - 1] = `${prev.trimEnd()} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * @param {string} prev
 * @param {string} next
 */
function shouldJoinSoftWrap(prev, next) {
  const a = String(prev ?? "").trim();
  const b = String(next ?? "").trim();
  if (!a || !b) return false;
  if (isLibraryHashLine(a) || isLibraryHashLine(b)) return false;
  if (isMarkdownHeadingLine(a) || isMarkdownHeadingLine(b)) return false;
  if (isStrictHeadingCandidate(a) || isStrictHeadingCandidate(b)) return false;
  if (isSoftHeadingCandidate(a) || isSoftHeadingCandidate(b)) return false;
  if (/[.!?…:]$/.test(a)) return false;
  // Continue a wrapped sentence (next starts lowercase / digit).
  if (/^[a-záéíóúñüàèìòùäëïöü0-9(]/.test(b)) return true;
  // Long open line without terminal punctuation → likely wrap.
  if (a.length >= 42 && b.length >= 12 && !/^[A-ZÁÉÍÓÚÑÜ]{2,}\b/.test(b)) return true;
  return false;
}

/**
 * Markdown-style heading with space after hashes (`# Title`).
 * Does NOT match `#i` / `#o` (no space required for those).
 * @param {string} line
 */
function isMarkdownHeadingLine(line) {
  return /^#{1,3}\s+\S/.test(String(line ?? "").trim());
}

/**
 * @param {string} text
 */
function stripMarkdownHeadingPrefix(text) {
  const m = String(text ?? "").trim().match(/^(#{1,3})\s+(.+)$/);
  if (!m) return { level: 0, title: String(text ?? "").trim() };
  return { level: m[1].length, title: m[2].trim() };
}

/**
 * Stricter title detection for paragraphs after the first.
 * @param {string} text
 */
export function isStrictHeadingCandidate(text) {
  const t = String(text ?? "").trim();
  if (!t || t.includes("\n")) return false;
  if (isLibraryHashLine(t)) return false;
  if (isMarkdownHeadingLine(t)) return true;
  if (t.length > 72) return false;
  if (/[.!?…]$/.test(t)) return false;
  if (/:$/.test(t) && t.length <= 60) return true;
  if (isAllCapsHeading(t)) return true;
  if (startsWithEmoji(t) && t.length <= 64) return true;
  return false;
}

/**
 * Softer section titles (Title Case, numbered "1. Foo").
 * @param {string} text
 */
export function isSoftHeadingCandidate(text) {
  const t = String(text ?? "").trim();
  if (!t || t.includes("\n")) return false;
  if (isLibraryHashLine(t)) return false;
  if (isMarkdownHeadingLine(t) || isStrictHeadingCandidate(t)) return true;
  if (t.length > 64 || t.length < 2) return false;
  if (/[.!?…]$/.test(t)) return false;
  if (looksLikeBodySentence(t)) return false;
  if (/^\d+[.)]\s+\S/.test(t) && t.length <= 64) return true;
  if (isTitleCaseHeading(t)) return true;
  return false;
}

/**
 * @param {string} text
 */
function isTitleCaseHeading(text) {
  const t = String(text ?? "").trim();
  if (t.length < 4 || t.length > 60) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 10) return false;
  const small = /^(a|an|the|of|and|or|in|on|to|for|vs|vs\.|de|del|la|el|los|las|y|o|un|una)$/i;
  let capped = 0;
  for (const w of words) {
    if (small.test(w)) continue;
    if (/^[\p{Lu}]/u.test(w)) capped += 1;
    else return false;
  }
  return capped >= 2;
}

/**
 * @param {string} text
 */
function looksLikeBodySentence(text) {
  const t = String(text ?? "").trim();
  if (t.length > 90) return true;
  if ((t.match(/[,;]/g) || []).length >= 2) return true;
  if (/\b(the|and|with|that|this|from|have|will|para|que|con|una|unos)\b/i.test(t) && t.length > 36) {
    return true;
  }
  return false;
}

/**
 * Prefer short titles for H1 — long prose stays body.
 * @param {string} text
 */
export function looksLikeDocumentTitle(text) {
  const t = String(text ?? "").trim();
  if (!t || t.includes("\n")) return false;
  if (isLibraryHashLine(t)) return false;
  if (isMarkdownHeadingLine(t)) return true;
  if (t.length > 90) return false;
  if (/[.!?…]$/.test(t)) return false;
  if (looksLikeBodySentence(t) && t.length > 70) return false;
  if (isStrictHeadingCandidate(t) || isSoftHeadingCandidate(t)) return true;
  if (t.length <= 72) return true;
  return false;
}

/**
 * @param {string} text
 */
function isAllCapsHeading(text) {
  const t = String(text ?? "").trim();
  if (t.length < 3 || t.length > 64) return false;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

/**
 * @param {string} text
 */
function startsWithEmoji(text) {
  return /^[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(String(text ?? "").trim());
}

/**
 * @typedef {{ kind: "h1" | "h2" | "h3" | "text", text: string }} OrganizeSegment
 */

/**
 * Classify cleaned paragraphs into heading / text segments.
 * @param {string[]} paragraphs
 * @returns {OrganizeSegment[]}
 */
export function classifyOrganizeParagraphs(paragraphs) {
  const parts = Array.isArray(paragraphs) ? paragraphs : [];
  /** @type {OrganizeSegment[]} */
  const segments = [];
  let sawH1 = false;
  let sawH2 = false;

  for (let i = 0; i < parts.length; i += 1) {
    const raw = String(parts[i] ?? "").trim();
    if (!raw) continue;

    if (isLibraryHashLine(raw)) {
      segments.push({ kind: "text", text: raw });
      continue;
    }

    if (isMarkdownHeadingLine(raw)) {
      const { level, title } = stripMarkdownHeadingPrefix(raw);
      if (!title) continue;
      if (level === 1) {
        segments.push({ kind: "h1", text: title });
        sawH1 = true;
      } else if (level === 2) {
        segments.push({ kind: "h2", text: title });
        sawH2 = true;
      } else {
        segments.push({ kind: "h3", text: title });
      }
      continue;
    }

    if (!sawH1 && looksLikeDocumentTitle(raw)) {
      segments.push({ kind: "h1", text: raw.replace(/:$/, "").trim() || raw });
      sawH1 = true;
      continue;
    }

    if (!sawH1) {
      // First structural heading after dense body → document H1.
      if (isStrictHeadingCandidate(raw) || isSoftHeadingCandidate(raw)) {
        segments.push({ kind: "h1", text: raw.replace(/:$/, "").trim() || raw });
        sawH1 = true;
        continue;
      }
      segments.push({ kind: "text", text: raw });
      continue;
    }

    if (isStrictHeadingCandidate(raw) || isSoftHeadingCandidate(raw)) {
      const title = raw.replace(/:$/, "").trim() || raw;
      const last = segments[segments.length - 1];
      if (
        (last?.kind === "h2" || sawH2)
        && isAllCapsHeading(raw)
        && title.length <= 28
      ) {
        segments.push({ kind: "h3", text: title });
      } else if (
        last?.kind === "h2"
        && isSoftHeadingCandidate(raw)
        && title.length <= 36
        && !isAllCapsHeading(raw)
      ) {
        segments.push({ kind: "h3", text: title });
      } else {
        segments.push({ kind: "h2", text: title });
        sawH2 = true;
      }
      continue;
    }

    segments.push({ kind: "text", text: raw });
  }

  // No title found — promote the first short text segment to H1 when reasonable.
  if (!sawH1 && segments.length) {
    const firstTextIdx = segments.findIndex((s) => s.kind === "text");
    if (firstTextIdx >= 0) {
      const first = segments[firstTextIdx];
      const line = first.text.split("\n")[0].trim();
      if (looksLikeDocumentTitle(line)) {
        segments.splice(firstTextIdx, 1, { kind: "h1", text: line });
        const rest = first.text.slice(line.length).trim();
        if (rest) segments.splice(firstTextIdx + 1, 0, { kind: "text", text: rest });
      }
    }
  }

  return mergeAdjacentTextSegments(segments);
}

/**
 * @param {OrganizeSegment[]} segments
 */
function mergeAdjacentTextSegments(segments) {
  /** @type {OrganizeSegment[]} */
  const out = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (
      seg.kind === "text"
      && last?.kind === "text"
      && !isLibraryHashLine(last.text)
      && !isLibraryHashLine(seg.text)
    ) {
      last.text = `${last.text}\n\n${seg.text}`;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/**
 * @param {string} text
 * @returns {OrganizeSegment[]}
 */
export function organizePastedTextToSegments(text) {
  return classifyOrganizeParagraphs(normalizeSocialPasteText(text));
}

/**
 * @param {OrganizeSegment[]} segments
 * @param {{ charsPerCell?: number }} [options]
 */
export function organizeSegmentsToNodeBlocks(segments, options = {}) {
  const list = Array.isArray(segments) ? segments : [];
  const charsPerCell = Math.max(
    48,
    Number(options.charsPerCell) || DEFAULT_CELL_CHARS,
  );
  /** @type {object[]} */
  const blocks = [];
  for (const seg of list) {
    if (!seg?.text?.trim()) continue;
    if (seg.kind === "h1") blocks.push(createInlineH1Block(seg.text.trim()));
    else if (seg.kind === "h2") blocks.push(createInlineH2Block(seg.text.trim()));
    else if (seg.kind === "h3") blocks.push(createInlineH3Block(seg.text.trim()));
    else {
      for (const chunk of packTextIntoCellChunks(seg.text.trim(), charsPerCell)) {
        blocks.push(createEmptyTextBlock(chunk));
      }
    }
  }
  if (!blocks.length) return ensureNodeWritingTail([createEmptyTextBlock()]);
  return ensureNodeWritingTail(blocks);
}

/**
 * @param {OrganizeSegment[]} segments
 * @param {{ charsPerCell?: number }} [options]
 */
export function organizeSegmentsToDocBlocks(segments, options = {}) {
  const list = Array.isArray(segments) ? segments : [];
  const charsPerCell = Math.max(
    48,
    Number(options.charsPerCell) || DEFAULT_CELL_CHARS,
  );
  /** @type {object[]} */
  const blocks = [];
  for (const seg of list) {
    if (!seg?.text?.trim()) continue;
    if (seg.kind === "h1") {
      blocks.push(createDocBlock(DOC_BLOCK_TYPES.H1, { title: seg.text.trim() }));
    } else if (seg.kind === "h2") {
      blocks.push(createDocBlock(DOC_BLOCK_TYPES.H2, { title: seg.text.trim() }));
    } else if (seg.kind === "h3") {
      blocks.push(createDocBlock(DOC_BLOCK_TYPES.H3, { title: seg.text.trim() }));
    } else {
      for (const chunk of packTextIntoCellChunks(seg.text.trim(), charsPerCell)) {
        blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: chunk }));
      }
    }
  }
  if (!blocks.length) return ensureWritableDocTail([]);
  return ensureWritableDocTail(blocks);
}

/**
 * @param {string} text
 * @param {{ charsPerCell?: number }} [options]
 */
export function organizePastedTextToNodeBlocks(text, options = {}) {
  return organizeSegmentsToNodeBlocks(organizePastedTextToSegments(text), options);
}

/**
 * @param {string} text
 * @param {{ charsPerCell?: number }} [options]
 */
export function organizePastedTextToDocBlocks(text, options = {}) {
  return organizeSegmentsToDocBlocks(organizePastedTextToSegments(text), options);
}

/**
 * Plain prose from writing blocks (headings as markdown so re-organize preserves them).
 * Skips widgets / todos / vaults.
 * @param {object[]} blocks
 */
export function collectWritingProsePlainText(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  /** @type {string[]} */
  const parts = [];
  for (const block of normalized) {
    if (block.type === NODE_BLOCK_TYPES.H1) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(`# ${title}`);
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.H2) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(`## ${title}`);
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.H3) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(`### ${title}`);
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.TEXT && !block.embedded) {
      const text = String(block.text ?? "").trim();
      if (text) parts.push(text);
    }
  }
  return parts.join("\n\n");
}

/**
 * @param {object} block
 */
function isWritingProseBlock(block) {
  if (!block) return false;
  if (
    block.type === NODE_BLOCK_TYPES.H1
    || block.type === NODE_BLOCK_TYPES.H2
    || block.type === NODE_BLOCK_TYPES.H3
  ) {
    return true;
  }
  return block.type === NODE_BLOCK_TYPES.TEXT && !block.embedded;
}

/**
 * Replace prose (H1/H2/H3/TEXT) with organized structure; keep other blocks.
 * Collapses empty TEXT gaps by rebuilding from content + packing into cell capacity.
 *
 * @param {object[]} blocks
 * @param {{ cellCapacities?: number[], charsPerCell?: number }} [options]
 * @returns {{ blocks: object[], changed: boolean }}
 */
export function applyOrganizeToWritingBlocks(blocks, options = {}) {
  const plan = planOrganizeWritingBlocks(blocks, options);
  return { blocks: plan.blocks, changed: plan.changed };
}

/**
 * Build the final organized doc plus progressive snapshots for UI reveal.
 * Steps: (1) clear empty prose shell, (2…) append each organized block in order.
 *
 * @param {object[]} blocks
 * @param {{ cellCapacities?: number[], charsPerCell?: number }} [options]
 * @returns {{ blocks: object[], changed: boolean, steps: object[][] }}
 */
export function planOrganizeWritingBlocks(blocks, options = {}) {
  const normalized = normalizeWritingBlocks(blocks);
  const prose = normalized.filter(isWritingProseBlock);
  const rest = normalized.filter((block) => !isWritingProseBlock(block));
  const plain = collectWritingProsePlainText(prose);
  if (!plain.trim()) {
    const unchanged = ensureNodeWritingTail(normalized);
    return { blocks: unchanged, changed: false, steps: [] };
  }
  const charsPerCell = Number(options.charsPerCell) > 0
    ? Number(options.charsPerCell)
    : resolvePackCellChars(options.cellCapacities);
  const organized = organizePastedTextToNodeBlocks(plain, { charsPerCell });
  const organizedCore = organized.filter(
    (block, index, arr) => !(
      index === arr.length - 1
      && block.type === NODE_BLOCK_TYPES.TEXT
      && !block.embedded
      && !(block.text || "").trim()
    ),
  );
  const next = ensureNodeWritingTail([...organizedCore, ...rest]);
  const beforeKey = proseKey(normalized);
  const afterKey = proseKey(next);
  const changed = beforeKey !== afterKey;
  if (!changed) {
    return { blocks: next, changed: false, steps: [] };
  }

  /** @type {object[][]} */
  const steps = [];
  // Clear messy empty cells first so packing is visible.
  steps.push(ensureNodeWritingTail([createEmptyTextBlock(), ...rest]));

  /** @type {object[]} */
  let built = [];
  for (let i = 0; i < organizedCore.length; i += 1) {
    built = [...built, organizedCore[i]];
    if (i === organizedCore.length - 1) {
      steps.push(next);
    } else {
      steps.push(ensureNodeWritingTail([...built, ...rest]));
    }
  }
  return { blocks: next, changed: true, steps };
}

/**
 * @param {object[]} blocks
 */
function proseKey(blocks) {
  return normalizeWritingBlocks(blocks)
    .filter(isWritingProseBlock)
    .map((block) => {
      if (
        block.type === NODE_BLOCK_TYPES.H1
        || block.type === NODE_BLOCK_TYPES.H2
        || block.type === NODE_BLOCK_TYPES.H3
      ) {
        return `${block.type}:${String(block.title ?? "").trim()}`;
      }
      return `text:${String(block.text ?? "").trim()}`;
    })
    .join("|");
}

/**
 * @param {object} block
 */
function isDocProseBlock(block) {
  if (!block) return false;
  if (
    block.type === DOC_BLOCK_TYPES.H1
    || block.type === DOC_BLOCK_TYPES.H2
    || block.type === DOC_BLOCK_TYPES.H3
  ) {
    return true;
  }
  return block.type === DOC_BLOCK_TYPES.TEXT && !block.embedded;
}

/**
 * @param {object[]} blocks
 */
export function collectDocProsePlainText(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  /** @type {string[]} */
  const parts = [];
  for (const block of normalized) {
    if (block.type === DOC_BLOCK_TYPES.H1) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(`# ${title}`);
      continue;
    }
    if (block.type === DOC_BLOCK_TYPES.H2) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(`## ${title}`);
      continue;
    }
    if (block.type === DOC_BLOCK_TYPES.H3) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(`### ${title}`);
      continue;
    }
    if (block.type === DOC_BLOCK_TYPES.TEXT && !block.embedded) {
      const text = String(block.text ?? "").trim();
      if (text) parts.push(text);
    }
  }
  return parts.join("\n\n");
}

/**
 * @param {object[]} blocks
 * @param {{ cellCapacities?: number[], charsPerCell?: number }} [options]
 * @returns {{ blocks: object[], changed: boolean }}
 */
export function applyOrganizeToDocBlocks(blocks, options = {}) {
  const normalized = normalizeDocBlocks(blocks);
  const prose = normalized.filter(isDocProseBlock);
  const rest = normalized.filter((block) => !isDocProseBlock(block));
  const plain = collectDocProsePlainText(prose);
  if (!plain.trim()) {
    return { blocks: ensureWritableDocTail(normalized), changed: false };
  }
  const charsPerCell = Number(options.charsPerCell) > 0
    ? Number(options.charsPerCell)
    : resolvePackCellChars(options.cellCapacities);
  const organized = organizePastedTextToDocBlocks(plain, { charsPerCell });
  const organizedCore = organized.filter(
    (block, index, arr) => !(
      index === arr.length - 1
      && block.type === DOC_BLOCK_TYPES.TEXT
      && !block.embedded
      && !(block.text || "").trim()
    ),
  );
  const next = ensureWritableDocTail([...organizedCore, ...rest]);
  const before = collectDocProsePlainText(normalized);
  const after = collectDocProsePlainText(next);
  return { blocks: next, changed: before !== after || prose.length !== organizedCore.length };
}
