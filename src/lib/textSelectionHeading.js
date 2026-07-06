import { generateId } from "./ids.js";
import { createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { normalizeBoldRanges } from "./docTextBoldRanges.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  createInlineH2Block,
  createInlineH3Block,
} from "./nodeInlineContent.js";

export const HEADING_BLOCK_TYPES = new Set(["h1", "h2", "h3"]);

export function isHeadingBlockType(type) {
  return HEADING_BLOCK_TYPES.has(type);
}

export function headingLevelFromFormatId(formatId) {
  if (formatId === "h1" || formatId === "h2" || formatId === "h3") return formatId;
  return null;
}

/** Bounds of the full line(s) touched by [start, end). */
export function getLineRange(text, start, end) {
  const str = String(text ?? "");
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(str.length, Math.max(start, end));
  const rangeStart = str.lastIndexOf("\n", lo - 1) + 1;
  const nextNewline = str.indexOf("\n", hi);
  const rangeEnd = nextNewline === -1 ? str.length : nextNewline;
  return { start: rangeStart, end: rangeEnd };
}

/** Individual lines within [rangeStart, rangeEnd). */
export function getLinesInRange(text, rangeStart, rangeEnd) {
  const str = String(text ?? "");
  /** @type {{ start: number, end: number, text: string }[]} */
  const lines = [];
  let pos = rangeStart;

  while (pos < rangeEnd) {
    let lineEnd = str.indexOf("\n", pos);
    if (lineEnd === -1 || lineEnd > rangeEnd) lineEnd = rangeEnd;
    lines.push({
      start: pos,
      end: lineEnd,
      text: str.slice(pos, lineEnd),
    });
    if (lineEnd >= rangeEnd) break;
    pos = lineEnd + 1;
  }

  return lines;
}

function createTextSlice(text, boldRanges, sliceStart, sliceEnd) {
  const sliceText = text.slice(sliceStart, sliceEnd);
  if (!sliceText) return null;

  const localRanges = (boldRanges ?? [])
    .filter((range) => range.end > sliceStart && range.start < sliceEnd)
    .map((range) => ({
      start: Math.max(0, range.start - sliceStart),
      end: Math.min(sliceEnd - sliceStart, range.end - sliceStart),
    }));

  return {
    type: "text",
    text: sliceText,
    boldRanges: normalizeBoldRanges(sliceText, localRanges),
  };
}

function createHeadingSlice(level, title) {
  const trimmed = String(title ?? "");
  if (!trimmed.trim()) return null;
  return {
    type: level,
    title: trimmed,
  };
}

/**
 * Split a TEXT block at selected lines and insert heading block(s).
 * @param {{ type: string, text?: string, boldRanges?: import('./docTextBoldRanges.js').BoldRange[], id?: string }} block
 */
export function splitTextBlockForHeadings(block, selection, level) {
  const text = block?.text ?? "";
  const boldRanges = block?.boldRanges;
  const { start: rangeStart, end: rangeEnd } = getLineRange(text, selection.start, selection.end);
  const selectedLines = getLinesInRange(text, rangeStart, rangeEnd);

  /** @type {Record<string, unknown>[]} */
  const pieces = [];

  const before = createTextSlice(text, boldRanges, 0, rangeStart);
  if (before) pieces.push(before);

  for (const line of selectedLines) {
    const heading = createHeadingSlice(level, line.text);
    if (heading) {
      pieces.push(heading);
      continue;
    }
    const emptyLine = text.slice(line.start, line.end + (text[line.end] === "\n" ? 1 : 0));
    if (emptyLine) {
      pieces.push({ type: "text", text: emptyLine, boldRanges: [] });
    }
  }

  const after = createTextSlice(text, boldRanges, rangeEnd, text.length);
  if (after) pieces.push(after);

  return pieces;
}

function assignBlockIds(pieces, idPrefix = "BLK") {
  return pieces.map((piece) => ({
    ...piece,
    id: piece.id || generateId(idPrefix),
  }));
}

export function applyHeadingToTextBlock(blocks, blockIndex, selection, level, options = {}) {
  const normalized = Array.isArray(blocks) ? blocks : [];
  const block = normalized[blockIndex];
  if (!block || block.type !== "text" || !headingLevelFromFormatId(level)) {
    return normalized;
  }

  const pieces = splitTextBlockForHeadings(block, selection, level);
  if (!pieces.length) return normalized;

  const idPrefix = options.idPrefix || "BLK";
  const withIds = assignBlockIds(pieces, idPrefix);

  return [
    ...normalized.slice(0, blockIndex),
    ...withIds,
    ...normalized.slice(blockIndex + 1),
  ];
}

export function demoteHeadingBlockToText(blocks, blockIndex) {
  const normalized = Array.isArray(blocks) ? blocks : [];
  const block = normalized[blockIndex];
  if (!isHeadingBlockType(block?.type)) return normalized;

  const textBlock = {
    id: block.id || generateId("BLK"),
    type: "text",
    text: block.title || "",
  };

  return [
    ...normalized.slice(0, blockIndex),
    textBlock,
    ...normalized.slice(blockIndex + 1),
  ];
}

export function materializeNodeBlocksFromPieces(pieces) {
  return pieces.map((piece) => {
    if (piece.type === "text") {
      return {
        ...createEmptyTextBlock(piece.text || ""),
        boldRanges: piece.boldRanges,
      };
    }
    if (piece.type === "h1") return createInlineH1Block(piece.title, { macronodeHeading: Boolean(piece.macronodeHeading) });
    if (piece.type === "h2") return createInlineH2Block(piece.title);
    if (piece.type === "h3") return createInlineH3Block(piece.title);
    return createEmptyTextBlock();
  });
}

export function materializeDocBlocksFromPieces(pieces) {
  return pieces.map((piece) => {
    if (piece.type === "text") {
      return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
        text: piece.text || "",
        boldRanges: piece.boldRanges,
        id: piece.id,
      });
    }
    const typeMap = {
      h1: DOC_BLOCK_TYPES.H1,
      h2: DOC_BLOCK_TYPES.H2,
      h3: DOC_BLOCK_TYPES.H3,
    };
    return createDocBlock(typeMap[piece.type], {
      title: piece.title || "",
      id: piece.id,
      ...(piece.type === "h1"
        ? { macronodeHeading: Boolean(piece.macronodeHeading) }
        : {}),
    });
  });
}
