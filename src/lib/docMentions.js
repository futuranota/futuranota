import { generateId } from "./ids.js";
import {
  formatMentionDisplayToken,
  formatMentionToken,
  normalizeTagKey,
} from "./urlTableTags.js";
import { computeTextEditDelta } from "./docTextBoldRanges.js";

/**
 * @typedef {Object} DocMention
 * @property {string} id
 * @property {string|null} sourceEntryId
 * @property {string} tag
 * @property {string} name
 * @property {string} description
 * @property {string} url
 * @property {number} start
 * @property {number} end
 * @property {string} insertedAt
 */

/**
 * @typedef {Object} MentionQuery
 * @property {number} start - index of '@'
 * @property {number} end - caret index
 * @property {string} query - text after '@'
 */

/**
 * @typedef {Object} MentionSegment
 * @property {'plain'|'mention'} type
 * @property {string} text
 * @property {DocMention} [mention]
 */

/** @param {unknown} value */
function asText(value) {
  return String(value ?? "");
}

/**
 * @param {string} text
 * @param {unknown} mentions
 * @returns {DocMention[]}
 */
export function normalizeMentions(text, mentions) {
  const str = asText(text);
  if (!Array.isArray(mentions) || mentions.length === 0) return [];

  /** @type {DocMention[]} */
  const cleaned = [];
  for (const raw of mentions) {
    if (!raw || typeof raw !== "object") continue;
    const tag = formatMentionDisplayToken(raw.tag);
    if (!tag) continue;
    const displayToken = formatMentionDisplayToken(tag);
    const atToken = formatMentionToken(tag);
    let start = Number(raw.start);
    let end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    start = Math.max(0, Math.min(str.length, Math.floor(start)));
    end = Math.max(0, Math.min(str.length, Math.floor(end)));
    if (end <= start) continue;

    const slice = str.slice(start, end);
    const sliceKey = normalizeTagKey(slice);
    // Accept bare tag (current) or legacy @tag so old docs keep chips.
    if (
      sliceKey !== normalizeTagKey(displayToken)
      && sliceKey !== normalizeTagKey(atToken)
    ) {
      continue;
    }

    cleaned.push({
      id: String(raw.id || generateId("MNT")),
      sourceEntryId: raw.sourceEntryId == null ? null : String(raw.sourceEntryId),
      tag,
      name: String(raw.name ?? ""),
      description: String(raw.description ?? ""),
      url: String(raw.url ?? ""),
      start,
      end,
      insertedAt: String(raw.insertedAt || new Date().toISOString()),
    });
  }

  cleaned.sort((a, b) => a.start - b.start || a.end - b.end);

  /** @type {DocMention[]} */
  const nonOverlapping = [];
  for (const mention of cleaned) {
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (prev && mention.start < prev.end) continue;
    nonOverlapping.push(mention);
  }
  return nonOverlapping;
}

/**
 * Detect an active `@query` immediately before the caret.
 * Only opens when `@` is at start or preceded by whitespace.
 * Skips spans that are already committed mention chips (so Enter after insert
 * does not reopen the URL-table picker).
 * @param {string} text
 * @param {number} caret
 * @param {DocMention[]|null|undefined} [mentions]
 * @param {number|null|undefined} [dismissedAt] @ index the user closed — stay plain text
 * @returns {MentionQuery|null}
 */
export function getMentionQueryAtCaret(text, caret, mentions = null, dismissedAt = null) {
  const str = asText(text);
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  if (pos === 0) return null;

  let at = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = str[i];
    if (ch === "@") {
      at = i;
      break;
    }
    // Query may include letters, digits, underscore, hyphen, period.
    if (!/[A-Za-z0-9_.-]/.test(ch)) return null;
  }
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(str[at - 1])) return null;

  // User closed the picker for this `@` — keep writing as plain text.
  if (Number.isFinite(dismissedAt) && at === dismissedAt) return null;

  // Caret still inside / at the end of an inserted @mention → not a live query.
  if (Array.isArray(mentions) && mentions.length) {
    const committed = normalizeMentions(str, mentions);
    if (committed.some((item) => item.start === at && pos <= item.end)) {
      return null;
    }
  }

  return {
    start: at,
    end: pos,
    query: str.slice(at + 1, pos),
  };
}

/**
 * @param {DocMention[]} mentions
 * @param {number} editStart
 * @param {number} removedLength
 * @param {number} insertedLength
 * @param {string} nextText
 * @returns {DocMention[]}
 */
export function shiftMentions(mentions, editStart, removedLength, insertedLength, nextText) {
  const editEnd = editStart + removedLength;
  const delta = insertedLength - removedLength;
  /** @type {DocMention[]} */
  const out = [];

  for (const mention of mentions || []) {
    if (mention.end <= editStart) {
      out.push(mention);
      continue;
    }
    if (mention.start >= editEnd) {
      out.push({
        ...mention,
        start: mention.start + delta,
        end: mention.end + delta,
      });
      continue;
    }
    // Any edit that touches a mention range drops the linked metadata.
  }

  return normalizeMentions(nextText, out);
}

/**
 * @param {string} prevText
 * @param {string} nextText
 * @param {DocMention[]} mentions
 * @returns {DocMention[]}
 */
export function applyTextEditToMentions(prevText, nextText, mentions) {
  if (asText(prevText) === asText(nextText)) {
    return normalizeMentions(nextText, mentions);
  }
  const { editStart, removedLength, insertedLength } = computeTextEditDelta(prevText, nextText);
  return shiftMentions(mentions, editStart, removedLength, insertedLength, nextText);
}

/**
 * Replace the active `@query` with the bare tag chip and attach a snapshot mention.
 * Trigger stays `@`; the inserted body text has no leading `@`.
 * @param {string} text
 * @param {DocMention[]} mentions
 * @param {MentionQuery} activeQuery
 * @param {{ entryId?: string, id?: string, tag: string, name?: string, description?: string, url?: string }} candidate
 * @returns {{ text: string, mentions: DocMention[], caret: number }}
 */
export function insertMentionAtQuery(text, mentions, activeQuery, candidate) {
  const str = asText(text);
  const tag = formatMentionDisplayToken(candidate?.tag);
  if (!tag || !activeQuery) {
    return { text: str, mentions: normalizeMentions(str, mentions), caret: str.length };
  }

  const token = formatMentionDisplayToken(tag);
  const before = str.slice(0, activeQuery.start);
  const after = str.slice(activeQuery.end);
  // Always leave a trailing space after the chip when the next char isn't
  // already whitespace — keeps the caret out of the token so the picker
  // does not reopen on the next Enter / focus sync.
  const needsSpace = !/^\s/.test(after);
  const insertion = needsSpace ? `${token} ` : token;
  const nextText = before + insertion + after;
  const start = before.length;
  const end = start + token.length;

  const nextMention = {
    id: generateId("MNT"),
    sourceEntryId: candidate.entryId || candidate.id || null,
    tag,
    name: String(candidate.name ?? ""),
    description: String(candidate.description ?? ""),
    url: String(candidate.url ?? ""),
    start,
    end,
    insertedAt: new Date().toISOString(),
  };

  // Drop any mentions overlapping the replaced query span, then shift the rest.
  const cleared = shiftMentions(
    mentions,
    activeQuery.start,
    activeQuery.end - activeQuery.start,
    insertion.length,
    nextText,
  );

  return {
    text: nextText,
    mentions: normalizeMentions(nextText, [...cleared, nextMention]),
    caret: start + insertion.length,
  };
}

/**
 * @param {string} text
 * @param {DocMention[]} mentions
 * @returns {MentionSegment[]}
 */
export function mentionsToSegments(text, mentions) {
  const str = asText(text);
  const list = normalizeMentions(str, mentions);
  if (!list.length) {
    return str ? [{ type: "plain", text: str }] : [];
  }

  /** @type {MentionSegment[]} */
  const segments = [];
  let cursor = 0;
  for (const mention of list) {
    if (mention.start > cursor) {
      segments.push({ type: "plain", text: str.slice(cursor, mention.start) });
    }
    segments.push({
      type: "mention",
      text: str.slice(mention.start, mention.end),
      mention,
    });
    cursor = mention.end;
  }
  if (cursor < str.length) {
    segments.push({ type: "plain", text: str.slice(cursor) });
  }
  return segments;
}

/**
 * @param {DocMention[]} mentions
 * @param {number} offset
 * @returns {DocMention|null}
 */
export function findMentionAtOffset(mentions, offset) {
  const pos = Number(offset);
  if (!Number.isFinite(pos)) return null;
  for (const mention of mentions || []) {
    if (pos >= mention.start && pos < mention.end) return mention;
  }
  return null;
}

/**
 * Merge mentions when concatenating two text blocks with a separator.
 * @param {string} leftText
 * @param {DocMention[]} leftMentions
 * @param {string} rightText
 * @param {DocMention[]} rightMentions
 * @param {string} [separator]
 */
export function mergeMentionBlocks(leftText, leftMentions, rightText, rightMentions, separator = "\n") {
  const left = asText(leftText);
  const right = asText(rightText);
  const sep = asText(separator);
  const nextText = `${left}${sep}${right}`;
  const offset = left.length + sep.length;
  const shiftedRight = (rightMentions || []).map((mention) => ({
    ...mention,
    start: mention.start + offset,
    end: mention.end + offset,
  }));
  return {
    text: nextText,
    mentions: normalizeMentions(nextText, [...(leftMentions || []), ...shiftedRight]),
  };
}
