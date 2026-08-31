import { normalizeMentions } from "./docMentions.js";
import { normalizeTagRefs } from "./docTagRefs.js";
import { normalizeMarkerRanges } from "./docTextMarkerRanges.js";
import { normalizeBoldRanges } from "./docTextBoldRanges.js";
import { normalizeLibraryNameRefs } from "./docLibraryNameRefs.js";
import { listGuideArrowRanges } from "./docGuideArrow.js";
import { listPromptPrefixRanges } from "./docPromptPrefix.js";

/**
 * @typedef {Object} MirrorSegment
 * @property {string} text
 * @property {import('./docMentions.js').DocMention} [mention]
 * @property {import('./docTagRefs.js').DocTagRef} [tagRef]
 * @property {import('./docLibraryNameRefs.js').DocLibraryNameRef} [libraryNameRef]
 * @property {import('./docTextMarkerRanges.js').MarkerRange} [marker] full range (seed source)
 * @property {boolean} [bold]
 * @property {boolean} [promptPrefix]
 * @property {boolean} [guideArrow]
 */

/**
 * Flattens @mention chips, #tag refs, library names, marker strokes, and bold into one mirror render pass.
 * Segments break at every boundary; a segment can carry any combination.
 *
 * @returns {MirrorSegment[]}
 */
export function buildMirrorSegments(text, mentions, markerRanges, boldRanges, tagRefs, libraryNameRefs) {
  const value = String(text ?? "");
  if (!value) return [];

  const mentionList = normalizeMentions(value, mentions);
  const tagRefList = normalizeTagRefs(value, tagRefs);
  const libraryNameList = normalizeLibraryNameRefs(value, libraryNameRefs);
  const markerList = normalizeMarkerRanges(value, markerRanges);
  const boldList = normalizeBoldRanges(value, boldRanges);
  const promptPrefixList = listPromptPrefixRanges(value);
  const guideArrowList = listGuideArrowRanges(value);

  const boundaries = new Set([0, value.length]);
  for (const mention of mentionList) {
    boundaries.add(mention.start);
    boundaries.add(mention.end);
  }
  for (const tagRef of tagRefList) {
    boundaries.add(tagRef.start);
    boundaries.add(tagRef.end);
  }
  for (const ref of libraryNameList) {
    boundaries.add(ref.start);
    boundaries.add(ref.end);
  }
  for (const marker of markerList) {
    boundaries.add(marker.start);
    boundaries.add(marker.end);
  }
  for (const range of boldList) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  for (const range of promptPrefixList) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  for (const range of guideArrowList) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;

    const mention = mentionList.find(
      (item) => item.start <= start && item.end >= end,
    );
    const tagRef = tagRefList.find(
      (item) => item.start <= start && item.end >= end,
    );
    const libraryNameRef = libraryNameList.find(
      (item) => item.start <= start && item.end >= end,
    );
    const marker = markerList.find(
      (item) => item.start <= start && item.end >= end,
    );
    const bold = boldList.some(
      (item) => item.start <= start && item.end >= end,
    );
    const promptPrefix = promptPrefixList.some(
      (item) => item.start <= start && item.end >= end,
    );
    const guideArrow = guideArrowList.some(
      (item) => item.start <= start && item.end >= end,
    );

    segments.push({
      text: value.slice(start, end),
      ...(mention ? { mention } : {}),
      ...(tagRef ? { tagRef } : {}),
      ...(libraryNameRef ? { libraryNameRef } : {}),
      ...(marker ? { marker } : {}),
      ...(bold ? { bold: true } : {}),
      ...(promptPrefix ? { promptPrefix: true } : {}),
      ...(guideArrow ? { guideArrow: true } : {}),
    });
  }

  return segments;
}

