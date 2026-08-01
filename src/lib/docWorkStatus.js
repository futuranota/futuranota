/**
 * Folder-document work status (links / ex-macronodos).
 * Keep `completed` boolean derived for timeline / folder pie.
 */

import { getNodeWritingBodyPlainText } from "./nodeWritingExcerpt.js";

export const DOC_WORK_STATUS = {
  RESERVED: "reserved",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  PAST_DUE: "past_due",
  COMPLETED: "completed",
};

const VALID = new Set(Object.values(DOC_WORK_STATUS));

/**
 * @typedef {"reserved" | "in_progress" | "submitted" | "past_due" | "completed"} DocWorkStatus
 */

/**
 * @param {unknown} value
 * @returns {DocWorkStatus | null}
 */
export function normalizeDocWorkStatus(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  // Legacy: in_review was replaced by submitted (assistant delivery signal).
  if (s === "in_review") return DOC_WORK_STATUS.SUBMITTED;
  if (VALID.has(s)) return /** @type {DocWorkStatus} */ (s);
  return null;
}

/**
 * Hydrate / migrate: prefer explicit status; else completed:true → completed.
 * @param {{ status?: unknown, completed?: unknown } | null | undefined} node
 * @returns {DocWorkStatus | null}
 */
export function resolveDocWorkStatus(node) {
  const fromStatus = normalizeDocWorkStatus(node?.status);
  if (fromStatus) return fromStatus;
  if (node?.completed) return DOC_WORK_STATUS.COMPLETED;
  return null;
}

/**
 * @param {DocWorkStatus | null | undefined} status
 */
export function isDocWorkCompleted(status) {
  return normalizeDocWorkStatus(status) === DOC_WORK_STATUS.COMPLETED;
}

/**
 * Patch fields to keep status and completed in sync.
 * @param {{ status?: unknown, completed?: unknown }} updates
 * @returns {{ status: DocWorkStatus | null, completed: boolean }}
 */
export function syncDocWorkStatusFields(updates = {}) {
  const hasStatus = Object.prototype.hasOwnProperty.call(updates, "status");
  const hasCompleted = Object.prototype.hasOwnProperty.call(updates, "completed");

  if (hasStatus) {
    const status = normalizeDocWorkStatus(updates.status);
    return { status, completed: isDocWorkCompleted(status) };
  }

  if (hasCompleted) {
    const completed = Boolean(updates.completed);
    return {
      status: completed ? DOC_WORK_STATUS.COMPLETED : null,
      completed,
    };
  }

  return {
    status: normalizeDocWorkStatus(updates.status),
    completed: Boolean(updates.completed),
  };
}

/**
 * @param {unknown} content
 */
export function hasMeaningfulNodeContent(content) {
  return Boolean(getNodeWritingBodyPlainText(content)?.trim());
}

/**
 * Auto in_progress only when status is empty and the parent folder has a reservation.
 * Do not override reserved / past_due / etc.
 * @param {DocWorkStatus | null | undefined} currentStatus
 * @param {boolean} hasMeaningfulContent
 * @param {{ folderScheduleReserved?: boolean }} [options]
 * @returns {"in_progress" | null} next status to apply, or null if no change
 */
export function nextStatusOnMeaningfulWrite(
  currentStatus,
  hasMeaningfulContent,
  options = {},
) {
  if (!hasMeaningfulContent) return null;
  if (options.folderScheduleReserved === false) return null;
  const status = normalizeDocWorkStatus(currentStatus);
  if (status) return null;
  return DOC_WORK_STATUS.IN_PROGRESS;
}

/**
 * Without a folder schedule reservation, only `reserved` (or null) is allowed.
 * Clears stale work statuses; keeps reserved + schedule.
 * @param {{ status?: unknown, completed?: unknown } | null | undefined} node
 * @param {boolean} folderScheduleReserved
 * @returns {{ status: DocWorkStatus | null, completed: boolean } | null}
 *   Patch to apply, or null when no change needed.
 */
export function sanitizeDocStatusForFolderSchedule(node, folderScheduleReserved) {
  if (folderScheduleReserved) return null;
  const status = resolveDocWorkStatus(node);
  if (!status || status === DOC_WORK_STATUS.RESERVED) return null;
  return { status: null, completed: false };
}

/**
 * Whether a status chip should render for a document under a folder.
 * Reserved always shows; other work statuses when the doc date is inside the folder frame.
 * @param {DocWorkStatus | null | undefined} status
 * @param {boolean} docDateInFolderFrame
 */
export function shouldShowDocStatusChip(status, docDateInFolderFrame) {
  const s = normalizeDocWorkStatus(status);
  if (!s) return false;
  if (s === DOC_WORK_STATUS.RESERVED) return true;
  return Boolean(docDateInFolderFrame);
}

/**
 * @param {DocWorkStatus | null | undefined} status
 * @param {(key: string) => string} t
 */
export function docWorkStatusLabel(status, t) {
  const s = normalizeDocWorkStatus(status);
  if (s === DOC_WORK_STATUS.RESERVED) return t("sidebar.docStatusReserved");
  if (s === DOC_WORK_STATUS.IN_PROGRESS) return t("sidebar.docStatusInProgress");
  if (s === DOC_WORK_STATUS.SUBMITTED) return t("sidebar.docStatusSubmitted");
  if (s === DOC_WORK_STATUS.PAST_DUE) return t("sidebar.docStatusPastDue");
  if (s === DOC_WORK_STATUS.COMPLETED) return t("sidebar.docCompleted");
  return "";
}
