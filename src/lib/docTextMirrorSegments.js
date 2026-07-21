import { normalizeMentions } from "./docMentions.js";
import { normalizeMarkerRanges } from "./docTextMarkerRanges.js";

/**
 * @typedef {Object} MirrorSegment
 * @property {string} text
 * @property {import('./docMentions.js').DocMention} [mention]
 * @property {import('./docTextMarkerRanges.js').MarkerRange} [marker] full range (seed source)
 */

/**
 * Flattens @mention chips and marker strokes into one render pass for the
 * textarea mirror. Segments break at every mention/marker boundary; a segment
 * can carry both (mention inside a marker stroke).
 *
 * @returns {MirrorSegment[]}
 */
export function buildMirrorSegments(text, mentions, markerRanges) {
  const value = String(text ?? "");
  if (!value) return [];

  const mentionList = normalizeMentions(value, mentions);
  const markerList = normalizeMarkerRanges(value, markerRanges);

  const boundaries = new Set([0, value.length]);
  for (const mention of mentionList) {
    boundaries.add(mention.start);
    boundaries.add(mention.end);
  }
  for (const marker of markerList) {
    boundaries.add(marker.start);
    boundaries.add(marker.end);
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
    const marker = markerList.find(
      (item) => item.start <= start && item.end >= end,
    );

    segments.push({
      text: value.slice(start, end),
      ...(mention ? { mention } : {}),
      ...(marker ? { marker } : {}),
    });
  }

  return segments;
}
