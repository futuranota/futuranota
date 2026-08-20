/**
 * Phase 1 — organize pasted / messy social text into real H1/H2/H3 + TEXT blocks.
 *
 * Live `#` rules stay intact: `#i` / `#o` are Library actions (never headings).
 * Heading structure is created as block types — not by typing `#` / `##` into the textarea.
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
      || isMarkdownHeadingLine(trimmed);
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
      } else {
        segments.push({ kind: "h3", text: title });
      }
      continue;
    }

    if (!sawH1) {
      segments.push({ kind: "h1", text: raw });
      sawH1 = true;
      continue;
    }

    if (isStrictHeadingCandidate(raw)) {
      const title = raw.replace(/:$/, "").trim() || raw;
      // ALL CAPS / emoji section → H2; very short ALL CAPS after an H2 can be H3
      const last = segments[segments.length - 1];
      if (
        last?.kind === "h2"
        && isAllCapsHeading(raw)
        && title.length <= 28
      ) {
        segments.push({ kind: "h3", text: title });
      } else {
        segments.push({ kind: "h2", text: title });
      }
      continue;
    }

    segments.push({ kind: "text", text: raw });
  }

  return segments;
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
 */
export function organizeSegmentsToNodeBlocks(segments) {
  const list = Array.isArray(segments) ? segments : [];
  /** @type {object[]} */
  const blocks = [];
  for (const seg of list) {
    if (!seg?.text?.trim()) continue;
    if (seg.kind === "h1") blocks.push(createInlineH1Block(seg.text.trim()));
    else if (seg.kind === "h2") blocks.push(createInlineH2Block(seg.text.trim()));
    else if (seg.kind === "h3") blocks.push(createInlineH3Block(seg.text.trim()));
    else blocks.push(createEmptyTextBlock(seg.text.trim()));
  }
  if (!blocks.length) return ensureNodeWritingTail([createEmptyTextBlock()]);
  return ensureNodeWritingTail(blocks);
}

/**
 * @param {OrganizeSegment[]} segments
 */
export function organizeSegmentsToDocBlocks(segments) {
  const list = Array.isArray(segments) ? segments : [];
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
      blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: seg.text.trim() }));
    }
  }
  if (!blocks.length) return ensureWritableDocTail([]);
  return ensureWritableDocTail(blocks);
}

/**
 * @param {string} text
 */
export function organizePastedTextToNodeBlocks(text) {
  return organizeSegmentsToNodeBlocks(organizePastedTextToSegments(text));
}

/**
 * @param {string} text
 */
export function organizePastedTextToDocBlocks(text) {
  return organizeSegmentsToDocBlocks(organizePastedTextToSegments(text));
}

/**
 * Plain prose from writing blocks (headings + text). Skips widgets / todos / vaults.
 * @param {object[]} blocks
 */
export function collectWritingProsePlainText(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  /** @type {string[]} */
  const parts = [];
  for (const block of normalized) {
    if (
      block.type === NODE_BLOCK_TYPES.H1
      || block.type === NODE_BLOCK_TYPES.H2
      || block.type === NODE_BLOCK_TYPES.H3
    ) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(title);
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
 * @param {object[]} blocks
 * @returns {{ blocks: object[], changed: boolean }}
 */
export function applyOrganizeToWritingBlocks(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  const prose = normalized.filter(isWritingProseBlock);
  const rest = normalized.filter((block) => !isWritingProseBlock(block));
  const plain = collectWritingProsePlainText(prose);
  if (!plain.trim()) {
    return { blocks: ensureNodeWritingTail(normalized), changed: false };
  }
  const organized = organizePastedTextToNodeBlocks(plain);
  // Drop the trailing empty TEXT from organized before appending non-prose, then re-tail.
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
  return { blocks: next, changed: beforeKey !== afterKey };
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
    if (
      block.type === DOC_BLOCK_TYPES.H1
      || block.type === DOC_BLOCK_TYPES.H2
      || block.type === DOC_BLOCK_TYPES.H3
    ) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(title);
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
 * @returns {{ blocks: object[], changed: boolean }}
 */
export function applyOrganizeToDocBlocks(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  const prose = normalized.filter(isDocProseBlock);
  const rest = normalized.filter((block) => !isDocProseBlock(block));
  const plain = collectDocProsePlainText(prose);
  if (!plain.trim()) {
    return { blocks: ensureWritableDocTail(normalized), changed: false };
  }
  const organized = organizePastedTextToDocBlocks(plain);
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
