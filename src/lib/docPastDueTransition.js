/**
 * Auto-transition document work status: in_progress → past_due when the
 * document schedule (inside a folder reservation window) has elapsed.
 */

import { parseDate, startOfCalendarDay } from "../temporal.js";
import { calendarDateInputValue } from "./docDates.js";
import {
  DOC_WORK_STATUS,
  resolveDocWorkStatus,
  syncDocWorkStatusFields,
} from "./docWorkStatus.js";
import {
  isDateInputWithinFolderSchedule,
  isFolderScheduleReserved,
} from "./folderScheduleReservation.js";

/**
 * End of the document's scheduled day (finish preferred, else start).
 * @param {object | null | undefined} node
 * @returns {Date | null}
 */
export function resolveDocScheduleDeadline(node) {
  const finish = parseDate(node?.anchorFinishAt);
  if (finish) {
    const day = startOfCalendarDay(finish);
    if (!day) return null;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  }
  const start = parseDate(node?.anchorAt);
  if (!start) return null;
  const day = startOfCalendarDay(start);
  if (!day) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
}

/**
 * @param {object | null | undefined} node
 * @param {object | null | undefined} parentFolderDoc
 * @param {Date} [now]
 * @returns {boolean}
 */
export function shouldAutoPastDue(node, parentFolderDoc, now = new Date()) {
  if (!node?.id) return false;
  if (resolveDocWorkStatus(node) !== DOC_WORK_STATUS.IN_PROGRESS) return false;
  if (!isFolderScheduleReserved(parentFolderDoc)) return false;

  const deadline = resolveDocScheduleDeadline(node);
  if (!deadline) return false;

  const scheduleDay = calendarDateInputValue(startOfCalendarDay(deadline));
  if (!isDateInputWithinFolderSchedule(scheduleDay, parentFolderDoc)) return false;

  const todayStart = startOfCalendarDay(now);
  if (!todayStart) return false;
  // Past due once the scheduled calendar day is fully behind "today".
  return deadline.getTime() < todayStart.getTime();
}

/**
 * Scan nodes and apply past_due where eligible.
 * @param {{
 *   nodes: Record<string, object> | object[],
 *   docs: Record<string, object> | object[],
 *   updateNode: (id: string, patch: object) => void,
 *   now?: Date,
 * }} args
 * @returns {number} count of nodes updated
 */
export function applyPastDueTransitions({
  nodes,
  docs,
  updateNode,
  now = new Date(),
}) {
  if (!nodes || !docs || typeof updateNode !== "function") return 0;
  const nodeList = Array.isArray(nodes) ? nodes : Object.values(nodes);
  const docsById = Array.isArray(docs)
    ? Object.fromEntries(docs.filter(Boolean).map((d) => [d.id, d]))
    : docs;

  let updated = 0;
  for (const node of nodeList) {
    if (!node?.id || !node.parentDocId) continue;
    const parent = docsById?.[node.parentDocId] || null;
    if (!shouldAutoPastDue(node, parent, now)) continue;
    const patch = syncDocWorkStatusFields({ status: DOC_WORK_STATUS.PAST_DUE });
    updateNode(node.id, patch);
    updated += 1;
  }
  return updated;
}
