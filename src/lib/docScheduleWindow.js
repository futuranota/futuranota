import { parseDate } from "../temporal.js";
import {
  DOC_WORK_STATUS,
  resolveDocWorkStatus,
} from "./docWorkStatus.js";
import { anchorFieldsFromIso, isoFromAnchorFields } from "./nodeAnchor.js";

/** Dev/testing: localStorage.setItem('fn.timelineLedVariant', 'green' | 'brown') */
export const TIMELINE_LED_VARIANT_STORAGE_KEY = "fn.timelineLedVariant";

/**
 * @typedef {"green" | "brown"} TimelineLedVariant
 */

/**
 * @typedef {{ active: boolean, variant: TimelineLedVariant | null, notificationActive: boolean }} TimelineScheduleLedState
 */

/**
 * True when the document has a real hourly range (start → finish on the timeline).
 * @param {{ anchorAt?: unknown, anchorFinishAt?: unknown } | null | undefined} node
 */
export function hasDocumentScheduleHours(node) {
  if (!node?.anchorAt) return false;
  if (typeof node.anchorAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(node.anchorAt.trim())) {
    return false;
  }
  const window = resolveDocumentScheduleWindow(node);
  if (!window) return false;
  const startMs = window.start.getTime();
  const finishMs = window.finish.getTime();
  if (finishMs > startMs) return true;
  const { anchorTime } = anchorFieldsFromIso(node.anchorAt);
  return Boolean(anchorTime && anchorTime !== "12:00");
}

/**
 * Timeline chip eligible for schedule LED (file/macronodo — not folder doc cards).
 * @param {{ dataType?: unknown, docId?: unknown, entityId?: unknown, childKey?: unknown } | null | undefined} marker
 * @param {{ isTimeMarker?: boolean, isAgentSet?: boolean }} [ctx]
 */
export function isTimelineScheduleLedCandidate(marker, ctx = {}) {
  if (!marker || ctx.isTimeMarker || ctx.isAgentSet) return false;
  if (marker.dataType === "document" && marker.docId) return false;
  return Boolean(marker.entityId || marker.childKey);
}

/**
 * Merge schedule fields from store entity, track item, and linked doc block.
 * @param {object | null | undefined} entity
 * @param {{ item?: object | null, docsById?: Record<string, object>, entityId?: string | null }} [sources]
 * @returns {object | null}
 */
export function resolveTimelineScheduleSubject(entity, sources = {}) {
  const { item = null, docsById = {}, entityId = null } = sources;
  if (!entity && !item) return null;

  const nodeId = entity?.id || entityId || item?.noteId || null;
  let anchorAt = entity?.anchorAt ?? item?.anchorAt ?? null;
  let anchorFinishAt = entity?.anchorFinishAt ?? item?.anchorFinishAt ?? null;

  const parentDocId = entity?.parentDocId ?? item?.parentDocId ?? null;
  const doc = parentDocId ? docsById[parentDocId] : null;
  const block = (doc?.blocks || []).find((b) => {
    if (nodeId && b?.nodeId === nodeId) return true;
    if (entity?.sourceBlockId && b?.id === entity.sourceBlockId) return true;
    return false;
  });

  if (block) {
    const date = String(block.anchorDate || "").trim();
    const startTime = String(block.anchorTime || "").trim();
    const finishTime = String(block.anchorFinishTime || "").trim();
    if (date && startTime) {
      // Doc block is source of truth — keeps start/finish aligned (local wall clock).
      anchorAt = isoFromAnchorFields(date, startTime);
      anchorFinishAt = finishTime
        ? isoFromAnchorFields(date, finishTime)
        : anchorFinishAt;
    }
  }

  if (!anchorAt) return null;

  return {
    ...(entity || {}),
    ...(item || {}),
    anchorAt,
    anchorFinishAt: anchorFinishAt || null,
    status: entity?.status ?? item?.status ?? null,
    completed: entity?.completed ?? item?.completed ?? null,
  };
}

/**
 * @param {{ anchorAt?: unknown, anchorFinishAt?: unknown } | null | undefined} node
 * @param {Date} [now]
 * @returns {{ start: Date, finish: Date } | null}
 */
export function resolveDocumentScheduleWindow(node, now = new Date()) {
  const start = parseDate(node?.anchorAt);
  const finish = parseDate(node?.anchorFinishAt) || start;
  if (!start || !finish) return null;
  const startMs = start.getTime();
  const finishMs = finish.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return null;
  return { start, finish: finishMs >= startMs ? finish : start };
}

/**
 * Whether now falls inside [anchorAt, anchorFinishAt] (finish defaults to start).
 * @param {{ anchorAt?: unknown, anchorFinishAt?: unknown } | null | undefined} node
 * @param {Date} [now]
 */
export function isDocumentInScheduleWindow(node, now = new Date()) {
  const window = resolveDocumentScheduleWindow(node, now);
  if (!window) return false;
  const t = now.getTime();
  return t >= window.start.getTime() && t <= window.finish.getTime();
}

/**
 * @param {unknown} raw
 * @returns {TimelineLedVariant}
 */
export function readTimelineLedVariant(raw) {
  return String(raw || "").trim().toLowerCase() === "brown" ? "brown" : "green";
}

/**
 * @param {{ getItem?: (key: string) => string | null }} [storage]
 * @returns {TimelineLedVariant}
 */
export function getTimelineLedVariant(storage = null) {
  try {
    const reader = storage?.getItem
      ? storage
      : (typeof localStorage !== "undefined" ? localStorage : null);
    if (!reader?.getItem) return "green";
    return readTimelineLedVariant(reader.getItem(TIMELINE_LED_VARIANT_STORAGE_KEY));
  } catch {
    return "green";
  }
}

/**
 * Timeline tactical chip LED: on during schedule window; off for completed/past_due.
 * @param {{
 *   status?: unknown,
 *   completed?: unknown,
 *   anchorAt?: unknown,
 *   anchorFinishAt?: unknown,
 * } | null | undefined} node
 * @param {Date} [now]
 * @param {{ notificationActive?: boolean, ledVariant?: TimelineLedVariant, storage?: { getItem?: (key: string) => string | null }, forceLed?: boolean }} [options]
 * @returns {TimelineScheduleLedState}
 */
export function resolveTimelineScheduleLed(node, now = new Date(), options = {}) {
  const notificationActive = Boolean(options.notificationActive);
  const status = resolveDocWorkStatus(node);
  if (
    status === DOC_WORK_STATUS.COMPLETED
    || status === DOC_WORK_STATUS.PAST_DUE
  ) {
    return { active: false, variant: null, notificationActive };
  }

  if (!notificationActive && !hasDocumentScheduleHours(node)) {
    return { active: false, variant: null, notificationActive };
  }

  const inWindow = isDocumentInScheduleWindow(node, now);
  const active = inWindow || notificationActive;
  if (!active) {
    return { active: false, variant: null, notificationActive };
  }

  const variant = options.ledVariant
    ?? getTimelineLedVariant(options.storage);
  return { active: true, variant, notificationActive };
}
