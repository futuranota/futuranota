/**
 * Script organize: bracket actions → line-start arrows, reflow dialogue,
 * collapse TEXT gaps. Does not promote headings — H1/H2/H3 stay untouched.
 */

import {
  createEmptyTextBlock,
  ensureNodeWritingTail,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";

const BRACKET_ACTION_RE = /\[([^\]]+)\]/g;
const LINE_START_ARROW_RE = /^(\s*)(?:->|⇒|➔|➜)\s*/;
const SPEAKER_LINE_RE = /^[A-ZÁÉÍÓÚÑÜ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÑÜ][\p{L}]+)?$/u;

/**
 * @param {string} text
 */
export function normalizeScriptText(text) {
  const expanded = expandBracketActions(
    String(text ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\u2028/g, "\n")
      .replace(/\u2029/g, "\n\n"),
  );

  const reflowed = reflowScriptLines(
    expanded.split("\n").map((line) => line.replace(/[ \t]+$/g, "")),
  );
  const spaced = formatScriptBlockSpacing(reflowed);
  return fixTightPunctuation(
    collapseBlankRuns(spaced).join("\n").trim(),
  );
}

/**
 * @param {string} line
 */
function isActionLine(line) {
  return LINE_START_ARROW_RE.test(String(line ?? "").trim());
}

/**
 * @param {string} line
 */
function isSpeakerLine(line) {
  const t = String(line ?? "").trim();
  if (!t || isActionLine(t)) return false;
  if (t.length > 36 || t.includes('"') || t.includes("“")) return false;
  if (/[.!?,:;]/.test(t)) return false;
  return SPEAKER_LINE_RE.test(t);
}

/**
 * @param {string} line
 */
function isInsideOpenDialogue(line) {
  let inside = false;
  for (const ch of String(line ?? "")) {
    if (ch === "\"") {
      inside = !inside;
      continue;
    }
    if (ch === "“" || ch === "«") inside = true;
    if (ch === "”" || ch === "»") inside = false;
  }
  return inside;
}

/**
 * @param {string} line
 */
function isDialogueLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return false;
  if (isActionLine(t) || isSpeakerLine(t)) return false;
  if (/^["“«]/.test(t)) return true;
  return isInsideOpenDialogue(t);
}

/**
 * @param {string} prev
 * @param {string} next
 */
function shouldJoinScriptLines(prev, next) {
  const a = String(prev ?? "").trim();
  const b = String(next ?? "").trim();
  if (!a || !b) return false;
  if (isActionLine(a) || isActionLine(b)) return false;
  if (isSpeakerLine(a) || isSpeakerLine(b)) return false;

  if (isInsideOpenDialogue(a)) return true;

  if (isDialogueLine(a) && isDialogueLine(b)) return true;

  if (/[,;:]$/.test(a) && !/^["“«]/.test(b)) return true;

  if (/[.!?…]["”»]?$/.test(a)) return false;

  if (/^[a-záéíóúñüàèìòùäëïöü0-9(]/.test(b)) return true;

  if (a.length >= 48 && b.length >= 8 && !/^[A-ZÁÉÍÓÚÑÜ]{2,}\b/.test(b)) {
    return true;
  }

  return false;
}

/**
 * @param {string} prev
 * @param {string} next
 */
function joinScriptLines(prev, next) {
  const a = String(prev ?? "").trimEnd();
  const b = String(next ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  if (/[,;:!?]$/.test(a.trim())) {
    return `${a.trim()} ${b}`;
  }
  return `${a.trim()} ${b}`;
}

/**
 * Join soft-wrapped dialogue / prose without merging actions or speakers.
 * @param {string[]} lines
 */
export function reflowScriptLines(lines) {
  const input = Array.isArray(lines) ? lines : [];
  /** @type {string[]} */
  const out = [];

  for (const rawLine of input) {
    const line = String(rawLine ?? "").trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== "__BLANK__") {
        out.push("__BLANK__");
      }
      continue;
    }

    const prev = out[out.length - 1];
    if (prev && prev !== "__BLANK__" && shouldJoinScriptLines(prev, line)) {
      out[out.length - 1] = joinScriptLines(prev, line);
      continue;
    }
    out.push(line);
  }

  return out
    .filter((line, index, arr) => line !== "__BLANK__" || arr[index - 1] !== "__BLANK__")
    .map((line) => (line === "__BLANK__" ? "" : line));
}

/**
 * Blank line between action ↔ dialogue ↔ action blocks (example 02 layout).
 * @param {string[]} lines
 */
export function formatScriptBlockSpacing(lines) {
  /** @type {string[]} */
  const out = [];

  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    if (!line.trim()) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }

    const prev = out[out.length - 1] ?? "";
    if (prev && prev !== "" && needsScriptBlockGap(prev, line)) {
      out.push("");
    }
    out.push(line.trim());
  }

  return out;
}

/**
 * @param {string} prev
 * @param {string} next
 */
function needsScriptBlockGap(prev, next) {
  if (isActionLine(prev) && (isDialogueLine(next) || /^["“«]/.test(next))) {
    return true;
  }
  if ((isDialogueLine(prev) || /["”»]$/.test(prev)) && isActionLine(next)) {
    return true;
  }
  if (isSpeakerLine(prev) && isActionLine(next)) return true;
  if (/["”»]$/.test(prev) && isSpeakerLine(next)) return true;
  if (isSpeakerLine(prev) && isDialogueLine(next)) return true;
  return false;
}

/**
 * @param {string} text
 */
export function fixTightPunctuation(text) {
  return String(text ?? "")
    .replace(/,([^\s\d"”»])/g, ", $1")
    .replace(/;([^\s])/g, "; $1");
}

/**
 * @param {string} line
 */
function normalizeScriptLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return "";

  const arrowMatch = trimmed.match(LINE_START_ARROW_RE);
  if (arrowMatch) {
    const body = trimmed.slice(arrowMatch[0].length).trim();
    return body ? `-> ${body}` : "->";
  }

  return trimmed;
}

/**
 * Turn `[ action ]` into `-> action` lines; split inline brackets.
 * @param {string} text
 */
export function expandBracketActions(text) {
  const value = String(text ?? "");
  if (!value) return "";

  /** @type {string[]} */
  const out = [];
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }

    const whole = trimmed.match(/^\[([^\]]+)\]$/);
    if (whole) {
      out.push(`-> ${whole[1].trim()}`);
      continue;
    }

    if (!BRACKET_ACTION_RE.test(trimmed)) {
      out.push(line.replace(/[ \t]+$/g, ""));
      continue;
    }

    BRACKET_ACTION_RE.lastIndex = 0;
    let lastIndex = 0;
    let match = BRACKET_ACTION_RE.exec(trimmed);
    let wrote = false;
    while (match) {
      const before = trimmed.slice(lastIndex, match.index).trim();
      if (before) {
        out.push(before);
        wrote = true;
      }
      out.push(`-> ${match[1].trim()}`);
      wrote = true;
      lastIndex = match.index + match[0].length;
      match = BRACKET_ACTION_RE.exec(trimmed);
    }
    const after = trimmed.slice(lastIndex).trim();
    if (after) {
      out.push(after);
      wrote = true;
    }
    if (!wrote) out.push(line.replace(/[ \t]+$/g, ""));
  }
  return out.join("\n");
}

/**
 * @param {string[]} lines
 */
function collapseBlankRuns(lines) {
  /** @type {string[]} */
  const out = [];
  for (const line of lines) {
    const normalized = normalizeScriptLine(line);
    if (!normalized) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    out.push(normalized);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

/**
 * @param {object} block
 */
function isMergeableTextBlock(block) {
  return block?.type === NODE_BLOCK_TYPES.TEXT && !block.embedded;
}

/**
 * @param {object[]} blocks
 */
function blocksScriptKey(blocks) {
  return normalizeWritingBlocks(blocks)
    .map((block) => {
      if (
        block.type === NODE_BLOCK_TYPES.H1
        || block.type === NODE_BLOCK_TYPES.H2
        || block.type === NODE_BLOCK_TYPES.H3
      ) {
        return `${block.type}:${String(block.title ?? "").trim()}`;
      }
      if (isMergeableTextBlock(block)) {
        return `text:${String(block.text ?? "").trim()}`;
      }
      return `${block.type}:${block.id}`;
    })
    .join("|");
}

/**
 * Merge contiguous TEXT cells, normalize script markup, drop empty gaps.
 * Headings and widgets are preserved in place.
 *
 * @param {object[]} blocks
 * @returns {{ blocks: object[], changed: boolean }}
 */
export function applyOrganizeScriptToWritingBlocks(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  /** @type {object[]} */
  const out = [];
  /** @type {string[]} */
  let textBuf = [];

  const flushText = () => {
    if (!textBuf.length) return;
    const plain = textBuf.join("\n\n");
    const script = normalizeScriptText(plain);
    if (script) {
      out.push(createEmptyTextBlock(script));
    }
    textBuf = [];
  };

  for (const block of normalized) {
    if (isMergeableTextBlock(block)) {
      const chunk = String(block.text ?? "").trim();
      if (chunk) textBuf.push(chunk);
      continue;
    }
    flushText();
    out.push(block);
  }
  flushText();

  const next = ensureNodeWritingTail(out);
  const changed = blocksScriptKey(normalized) !== blocksScriptKey(next);
  return { blocks: next, changed };
}

/**
 * @param {object[]} blocks
 * @returns {{ blocks: object[], changed: boolean }}
 */
export function planOrganizeScriptWritingBlocks(blocks) {
  return applyOrganizeScriptToWritingBlocks(blocks);
}
