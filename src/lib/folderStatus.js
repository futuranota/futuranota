/**
 * Folder status inherited from linked document work statuses (priority order).
 *
 * Priority:
 * 1. any `submitted` → submitted
 * 2. any `reserved` → reserved (also suppresses past_due on the folder)
 * 3. any `past_due` → past_due
 * 4. any `in_progress` → in_progress
 * 5. all children `completed` → completed
 * 6. else → not_started
 *
 * Progress metrics:
 * - `total` = all child documents (with or without schedule)
 * - `percent` / `scheduledPercent` = closed among children that have date+start (`anchorAt`)
 * - Docs without hours do not affect %
 *
 * @param {Record<string, object> | Array<object> | null | undefined} nodes
 * @param {string | null | undefined} folderDocId
 * @returns {{
 *   status: "not_started" | "reserved" | "in_progress" | "submitted" | "past_due" | "completed",
 *   total: number,
 *   done: number,
 *   percent: number,
 *   scheduledTotal: number,
 *   scheduledDone: number,
 *   scheduledPercent: number,
 *   unscheduledTotal: number,
 * }}
 */

import {
  DOC_WORK_STATUS,
  resolveDocWorkStatus,
} from "./docWorkStatus.js";

/**
 * Document has a schedule when date+start exist (`anchorAt` ISO).
 * @param {object | null | undefined} node
 */
export function docNodeHasSchedule(node) {
  const iso = node?.anchorAt;
  if (iso == null || iso === "") return false;
  const t = Date.parse(String(iso));
  return Number.isFinite(t);
}

/**
 * Closed for % progress (day + folder scheduled metrics).
 * @param {string | null | undefined} status
 */
export function isClosedForScheduleProgress(status) {
  return status === DOC_WORK_STATUS.COMPLETED || status === DOC_WORK_STATUS.SUBMITTED;
}

/**
 * Day / week progress over an already-filtered list of timed documents.
 * Caller scopes the list (e.g. anchorDate === today); unscheduled docs must not be passed in.
 * @param {object[]} docs
 * @returns {{ completed: number, total: number, remaining: number, percent: number }}
 */
export function buildTimedScheduleProgress(docs = []) {
  const list = Array.isArray(docs) ? docs : [];
  let completed = 0;
  for (const d of list) {
    const status = resolveDocWorkStatus(d);
    if (isClosedForScheduleProgress(status)) completed += 1;
  }
  const total = list.length;
  return {
    completed,
    total,
    remaining: Math.max(0, total - completed),
    percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0,
  };
}

function emptyFolderStatus() {
  return {
    status: "not_started",
    total: 0,
    done: 0,
    percent: 0,
    scheduledTotal: 0,
    scheduledDone: 0,
    scheduledPercent: 0,
    unscheduledTotal: 0,
  };
}

export function resolveFolderStatus(nodes, folderDocId) {
  const id = typeof folderDocId === "string" ? folderDocId.trim() : "";
  if (!id || !nodes) {
    return emptyFolderStatus();
  }

  const list = Array.isArray(nodes) ? nodes : Object.values(nodes);
  let total = 0;
  let done = 0;
  let scheduledTotal = 0;
  let scheduledDone = 0;
  let hasSubmitted = false;
  let hasReserved = false;
  let hasPastDue = false;
  let hasInProgress = false;

  for (const node of list) {
    if (node?.parentDocId !== id) continue;
    total += 1;
    const status = resolveDocWorkStatus(node);
    if (status === DOC_WORK_STATUS.COMPLETED) done += 1;
    if (status === DOC_WORK_STATUS.SUBMITTED) hasSubmitted = true;
    if (status === DOC_WORK_STATUS.RESERVED) hasReserved = true;
    if (status === DOC_WORK_STATUS.PAST_DUE) hasPastDue = true;
    if (status === DOC_WORK_STATUS.IN_PROGRESS) hasInProgress = true;

    if (docNodeHasSchedule(node)) {
      scheduledTotal += 1;
      if (isClosedForScheduleProgress(status)) scheduledDone += 1;
    }
  }

  const scheduledPercent = scheduledTotal > 0
    ? Math.min(100, Math.round((scheduledDone / scheduledTotal) * 100))
    : 0;
  const unscheduledTotal = Math.max(0, total - scheduledTotal);
  const base = {
    total,
    done,
    percent: scheduledPercent,
    scheduledTotal,
    scheduledDone,
    scheduledPercent,
    unscheduledTotal,
  };

  if (total <= 0) {
    return emptyFolderStatus();
  }
  if (hasSubmitted) {
    return { status: "submitted", ...base };
  }
  if (hasReserved) {
    return { status: "reserved", ...base };
  }
  if (hasPastDue) {
    return { status: "past_due", ...base };
  }
  if (hasInProgress) {
    return { status: "in_progress", ...base };
  }
  if (done >= total) {
    return { status: "completed", ...base };
  }
  return { status: "not_started", ...base };
}
