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
 * @param {Record<string, object> | Array<object> | null | undefined} nodes
 * @param {string | null | undefined} folderDocId
 * @returns {{
 *   status: "not_started" | "reserved" | "in_progress" | "submitted" | "past_due" | "completed",
 *   total: number,
 *   done: number,
 *   percent: number,
 * }}
 */

import {
  DOC_WORK_STATUS,
  resolveDocWorkStatus,
} from "./docWorkStatus.js";

export function resolveFolderStatus(nodes, folderDocId) {
  const id = typeof folderDocId === "string" ? folderDocId.trim() : "";
  if (!id || !nodes) {
    return { status: "not_started", total: 0, done: 0, percent: 0 };
  }

  const list = Array.isArray(nodes) ? nodes : Object.values(nodes);
  let total = 0;
  let done = 0;
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
  }

  const percent = total > 0
    ? Math.min(100, Math.round((done / total) * 100))
    : 0;

  if (total <= 0) {
    return { status: "not_started", total: 0, done: 0, percent: 0 };
  }
  if (hasSubmitted) {
    return { status: "submitted", total, done, percent };
  }
  if (hasReserved) {
    return { status: "reserved", total, done, percent };
  }
  if (hasPastDue) {
    return { status: "past_due", total, done, percent };
  }
  if (hasInProgress) {
    return { status: "in_progress", total, done, percent };
  }
  if (done >= total) {
    return { status: "completed", total, done, percent: 100 };
  }
  return { status: "not_started", total, done, percent };
}
