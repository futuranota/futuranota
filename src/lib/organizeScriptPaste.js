/**
 * Arreglar Guion: bracket actions → arrows, reflow dialogue, collapse TEXT gaps,
 * clean pasted ** / -- markers → native boldRanges + colon separators.
 * Does not promote headings — H1/H2/H3 titles only strip stray **.
 */

import {
  createEmptyTextBlock,
  ensureNodeWritingTail,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  trimTrailingEmptyTextBlocks,
} from "./nodeInlineContent.js";
import { normalizeBoldRanges } from "./docTextBoldRanges.js";
import { normalizeMarkerRanges } from "./docTextMarkerRanges.js";
import { DOC_TEXT_MARKER_COLORS } from "./docTextMarkerColors.js";

const BRACKET_ACTION_RE = /\[([^\]]+)\]/g;
const LINE_START_ARROW_RE = /^(\s*)(?:->|⇒|➔|➜)\s*/;
const SPEAKER_LINE_RE = /^[A-ZÁÉÍÓÚÑÜ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÑÜ][\p{L}]+)?$/u;
const LIST_SEP_RE = /\s*(?:[—–]|--)\s+/;
const MIN_LIST_BODY_LEN = 8;
const MAX_LIST_LABEL_LEN = 48;
const MAX_LIST_LABEL_WORDS = 6;

/**
 * @param {() => number} [rng]
 * @returns {string}
 */
export function pickRandomMarkerColorId(rng = Math.random) {
  const roll = typeof rng === "function" ? rng() : Math.random();
  const idx = Math.floor(Math.max(0, Math.min(0.999999, roll)) * DOC_TEXT_MARKER_COLORS.length);
  return DOC_TEXT_MARKER_COLORS[idx]?.id ?? DOC_TEXT_MARKER_COLORS[0].id;
}

/**
 * @param {string} line
 * @returns {{ lines: string[], boldRanges: import("./docTextBoldRanges.js").BoldRange[], markerRanges: import("./docTextMarkerRanges.js").MarkerRange[] }}
 */
function unchangedScriptLine(line) {
  return { lines: [line], boldRanges: [], markerRanges: [] };
}

/**
 * @param {string} text
 * @param {() => number} [rng]
 */
export function normalizeScriptText(text, rng = Math.random) {
  return normalizeScriptTextWithBold(text, rng).text;
}

/**
 * @param {string} text
 * @param {() => number} [rng]
 * @returns {{ text: string, boldRanges: import("./docTextBoldRanges.js").BoldRange[], markerRanges: import("./docTextMarkerRanges.js").MarkerRange[] }}
 */
export function normalizeScriptTextWithBold(text, rng = Math.random) {
  const lines = buildScriptLinesBeforeBoldClean(text);
  const markerColorId = pickRandomMarkerColorId(rng);
  /** @type {string[]} */
  const outLines = [];
  /** @type {import("./docTextBoldRanges.js").BoldRange[]} */
  const boldRanges = [];
  /** @type {import("./docTextMarkerRanges.js").MarkerRange[]} */
  const markerRanges = [];
  let offset = 0;

  for (const rawLine of lines) {
    const line = fixTightPunctuation(normalizeScriptLine(rawLine));
    if (!line) {
      if (outLines.length && outLines[outLines.length - 1] !== "") {
        outLines.push("");
        offset += 1;
      }
      continue;
    }

    const {
      lines: cleanedLines,
      boldRanges: lineBold,
      markerRanges: lineMarker,
    } = cleanScriptLineMarkers(line, markerColorId);

    for (let i = 0; i < cleanedLines.length; i += 1) {
      const subLine = cleanedLines[i];
      if (outLines.length > 0) offset += 1;
      if (i === 0) {
        for (const range of lineBold) {
          boldRanges.push({
            start: offset + range.start,
            end: offset + range.end,
          });
        }
        for (const range of lineMarker) {
          markerRanges.push({
            start: offset + range.start,
            end: offset + range.end,
            colorId: range.colorId,
          });
        }
      }
      outLines.push(subLine);
      offset += subLine.length;
    }
  }

  while (outLines.length && outLines[outLines.length - 1] === "") outLines.pop();
  const resultText = outLines.join("\n").trim();
  return {
    text: resultText,
    boldRanges: normalizeBoldRanges(resultText, boldRanges),
    markerRanges: normalizeMarkerRanges(resultText, markerRanges),
  };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function buildScriptLinesBeforeBoldClean(text) {
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
  return collapseBlankRuns(spaced);
}

/**
 * Strip markdown-style ** wrappers from heading titles.
 * @param {string} title
 */
export function cleanScriptHeadingTitle(title) {
  return String(title ?? "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
}

/**
 * @param {string} label
 */
function isValidListLabel(label) {
  const t = String(label ?? "").trim();
  if (!t || t.length > MAX_LIST_LABEL_LEN) return false;
  if (/\*\*|(?:^|\s)--/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= MAX_LIST_LABEL_WORDS;
}

/**
 * @param {string} line
 */
function isBoldCleanExemptLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return true;
  if (isActionLine(t)) return true;
  if (/^["“«]/.test(t)) return true;
  if (isSpeakerLine(t)) return true;
  return false;
}

/**
 * @param {string} line
 */
function isAlreadySplitLabelLine(line) {
  const m = String(line ?? "").trim().match(/^([^:]+):\s*$/);
  if (!m) return false;
  return isValidListLabel(m[1].trim());
}

/**
 * @param {string} label
 * @param {string} body
 * @param {string} colorId
 */
function formatListLine(label, body, colorId) {
  const cleanLabel = label.trim();
  const cleanBody = body.trim();
  const headLine = `${cleanLabel}:`;
  const end = headLine.length;
  const headRange = { start: 0, end };
  return {
    lines: [headLine, cleanBody],
    boldRanges: [headRange],
    markerRanges: [{ ...headRange, colorId }],
  };
}

/**
 * Clean pasted ** / -- markers → Label: / body on two lines + bold + marker color.
 *
 * @param {string} line
 * @param {string} [colorId] one session color for all labels in a run
 * @returns {{ lines: string[], boldRanges: import("./docTextBoldRanges.js").BoldRange[], markerRanges: import("./docTextMarkerRanges.js").MarkerRange[] }}
 */
export function cleanScriptLineMarkers(line, colorId) {
  const markerColorId = colorId ?? pickRandomMarkerColorId();
  const trimmed = String(line ?? "").trim();
  if (!trimmed || isBoldCleanExemptLine(trimmed)) {
    return unchangedScriptLine(trimmed);
  }

  if (isAlreadySplitLabelLine(trimmed)) {
    const end = trimmed.length;
    return {
      lines: [trimmed],
      boldRanges: [{ start: 0, end }],
      markerRanges: [{ start: 0, end, colorId: markerColorId }],
    };
  }

  const starDash = trimmed.match(/^\*\*(.+?)\*\*\s*(?:[—–]|--)\s*(.+)$/);
  if (starDash) {
    const label = starDash[1].trim();
    const body = starDash[2].trim();
    if (isValidListLabel(label) && body.length >= MIN_LIST_BODY_LEN) {
      return formatListLine(label, body, markerColorId);
    }
  }

  const starColon = trimmed.match(/^\*\*(.+?)\*\*\s*:\s*(.+)$/);
  if (starColon) {
    const label = starColon[1].trim();
    const body = starColon[2].trim();
    if (isValidListLabel(label) && body.length >= MIN_LIST_BODY_LEN) {
      return formatListLine(label, body, markerColorId);
    }
  }

  const dashMarker = trimmed.match(/^--(?![\s-])(.+?)\s*(?:[—–]|--)\s*(.+)$/);
  if (dashMarker) {
    const label = dashMarker[1].trim();
    const body = dashMarker[2].trim();
    if (isValidListLabel(label) && body.length >= MIN_LIST_BODY_LEN) {
      return formatListLine(label, body, markerColorId);
    }
  }

  const dashMarkerSpaced = trimmed.match(/^--\s+(.+?)\s*(?:[—–]|--)\s*(.+)$/);
  if (dashMarkerSpaced) {
    const label = dashMarkerSpaced[1].trim();
    const body = dashMarkerSpaced[2].trim();
    if (isValidListLabel(label) && body.length >= MIN_LIST_BODY_LEN) {
      return formatListLine(label, body, markerColorId);
    }
  }

  const colonList = trimmed.match(/^([^:]+?)\s*:\s*(.+)$/);
  if (colonList && !trimmed.includes("**")) {
    const label = colonList[1].trim();
    const body = colonList[2].trim();
    if (isValidListLabel(label) && body.length >= MIN_LIST_BODY_LEN) {
      return formatListLine(label, body, markerColorId);
    }
  }

  if (LIST_SEP_RE.test(trimmed)) {
    const parts = trimmed.split(LIST_SEP_RE);
    if (parts.length === 2) {
      const label = parts[0].replace(/^\*\*(.+)\*\*$/, "$1").replace(/^--(?![\s-])/, "").trim();
      const body = parts[1].trim();
      if (isValidListLabel(label) && body.length >= MIN_LIST_BODY_LEN) {
        return formatListLine(label, body, markerColorId);
      }
    }
  }

  return unchangedScriptLine(trimmed);
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
 * @param {string} line
 */
function isAffiliateListLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return false;
  if (/^\*\*(.+?)\*\*\s*(?:[—–]|--|:)/.test(t)) return true;
  if (/^--(?![\s-])/.test(t)) return true;
  if (/^--\s+\S/.test(t)) return true;
  if (/^[^:\n]{1,48}:\s+\S/.test(t)) return true;
  return false;
}

/**
 * @param {string} prev
 * @param {string} next
 */
function shouldJoinScriptLines(prev, next) {
  const a = String(prev ?? "").trim();
  const b = String(next ?? "").trim();
  if (!a || !b) return false;
  if (isAffiliateListLine(a) || isAffiliateListLine(b)) return false;
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
  return trimTrailingEmptyTextBlocks(normalizeWritingBlocks(blocks))
    .map((block) => {
      if (
        block.type === NODE_BLOCK_TYPES.H1
        || block.type === NODE_BLOCK_TYPES.H2
        || block.type === NODE_BLOCK_TYPES.H3
      ) {
        return `${block.type}:${cleanScriptHeadingTitle(block.title)}`;
      }
      if (isMergeableTextBlock(block)) {
        const bold = (block.boldRanges || [])
          .map((range) => `${range.start}-${range.end}`)
          .join(",");
        const markers = (block.markerRanges || [])
          .map((range) => `${range.start}-${range.end}-${range.colorId}`)
          .join(",");
        return `text:${String(block.text ?? "").trim()}:b${bold}:m${markers}`;
      }
      return `${block.type}:${block.id}`;
    })
    .join("|");
}

/**
 * @param {object} block
 */
function normalizeHeadingBlock(block) {
  if (
    block.type !== NODE_BLOCK_TYPES.H1
    && block.type !== NODE_BLOCK_TYPES.H2
    && block.type !== NODE_BLOCK_TYPES.H3
  ) {
    return block;
  }
  const title = cleanScriptHeadingTitle(block.title);
  if (title === String(block.title ?? "").trim()) return block;
  return { ...block, title };
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
    const { text, boldRanges, markerRanges } = normalizeScriptTextWithBold(plain);
    if (text) {
      out.push(createEmptyTextBlock(
        text,
        {
          ...(boldRanges.length ? { boldRanges } : {}),
          ...(markerRanges.length ? { markerRanges } : {}),
        },
      ));
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
    out.push(normalizeHeadingBlock(block));
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
