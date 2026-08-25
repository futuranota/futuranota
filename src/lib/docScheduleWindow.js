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
 * @param {{ anchorAt?: unknown, anchorFinishAt?: unknown } | null | undefined} node
 * @returns {{ start: Date, finish: Date } | null}
 */
export function resolveDocumentScheduleWindow(node) {
  const start = parseDate(node?.anchorAt);
  const finish = parseDate(node?.anchorFinishAt) || start;
  if (!start || !finish) return null;
  const startMs = start.getTime();
  const finishMs = finish.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return null;
  return { start, finish: finishMs >= startMs ? finish : start };
}

/**
 * True when the document has start + finish hours (a real range on the timeline).
 * @param {{ anchorAt?: unknown, anchorFinishAt?: unknown } | null | undefined} node
 */
export function hasDocumentScheduleHours(node) {
  if (!node?.anchorAt) return false;
  if (typeof node.anchorAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(node.anchorAt.trim())) {
    return false;
  }
  const window = resolveDocumentScheduleWindow(node);
  if (!window) return false;
  if (window.finish.getTime() > window.start.getTime()) return true;
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
 * Find linked doc block for a node entity.
 * @param {string | null | undefined} nodeId
 * @param {object | null | undefined} entity
 * @param {Record<string, object>} docsById
 */
function findLinkedScheduleBlock(nodeId, entity, docsById = {}) {
  const parentDocId = entity?.parentDocId || null;
  if (parentDocId && docsById[parentDocId]) {
    const hit = (docsById[parentDocId].blocks || []).find((b) => {
      if (nodeId && b?.nodeId === nodeId) return true;
      if (entity?.sourceBlockId && b?.id === entity.sourceBlockId) return true;
      return false;
    });
    if (hit) return hit;
  }
  if (!nodeId) return null;
  for (const doc of Object.values(docsById)) {
    const hit = (doc?.blocks || []).find((b) => b?.nodeId === nodeId);
    if (hit) return hit;
  }
  return null;
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

  const block = findLinkedScheduleBlock(nodeId, entity, docsById);
  if (block) {
    const date = String(block.anchorDate || "").trim();
    const startTime = String(block.anchorTime || "").trim();
    const finishTime = String(block.anchorFinishTime || "").trim();
    if (!anchorAt && date && startTime) {
      anchorAt = isoFromAnchorFields(date, startTime);
    }
    if (!anchorFinishAt && date && finishTime) {
      anchorFinishAt = isoFromAnchorFields(date, finishTime);
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
 * Whether now falls inside [anchorAt, anchorFinishAt] (finish defaults to start).
 * @param {{ anchorAt?: unknown, anchorFinishAt?: unknown } | null | undefined} node
 * @param {Date} [now]
 */
export function isDocumentInScheduleWindow(node, now = new Date()) {
  const window = resolveDocumentScheduleWindow(node);
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
 * @param {{ notificationActive?: boolean, ledVariant?: TimelineLedVariant, storage?: { getItem?: (key: string) => string | null } }} [options]
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

  const window = resolveDocumentScheduleWindow(node);
  const inWindow = Boolean(
    window
    && now.getTime() >= window.start.getTime()
    && now.getTime() <= window.finish.getTime(),
  );

  if (!inWindow && !notificationActive) {
    return { active: false, variant: null, notificationActive };
  }

  const variant = options.ledVariant
    ?? getTimelineLedVariant(options.storage);
  return { active: true, variant, notificationActive };
}
