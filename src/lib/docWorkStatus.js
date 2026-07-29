/**
 * Folder-document work status (links / ex-macronodes).
 * Keep `completed` boolean derived for timeline / folder pie.
 */

import { getNodeWritingBodyPlainText } from "./nodeWritingExcerpt.js";

export const DOC_WORK_STATUS = {
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  COMPLETED: "completed",
};

const VALID = new Set(Object.values(DOC_WORK_STATUS));

/**
 * @param {unknown} value
 * @returns {"in_progress" | "in_review" | "completed" | null}
 */
export function normalizeDocWorkStatus(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  if (VALID.has(s)) return /** @type {"in_progress" | "in_review" | "completed"} */ (s);
  return null;
}

/**
 * Hydrate / migrate: prefer explicit status; else completed:true → completed.
 * @param {{ status?: unknown, completed?: unknown } | null | undefined} node
 * @returns {"in_progress" | "in_review" | "completed" | null}
 */
export function resolveDocWorkStatus(node) {
  const fromStatus = normalizeDocWorkStatus(node?.status);
  if (fromStatus) return fromStatus;
  if (node?.completed) return DOC_WORK_STATUS.COMPLETED;
  return null;
}

/**
 * @param {"in_progress" | "in_review" | "completed" | null | undefined} status
 */
export function isDocWorkCompleted(status) {
  return normalizeDocWorkStatus(status) === DOC_WORK_STATUS.COMPLETED;
}

/**
 * Patch fields to keep status and completed in sync.
 * @param {{ status?: unknown, completed?: unknown }} updates
 * @returns {{ status: "in_progress" | "in_review" | "completed" | null, completed: boolean }}
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
 * Auto in_progress only when status is empty (do not override completed / in_review).
 * @param {"in_progress" | "in_review" | "completed" | null | undefined} currentStatus
 * @param {boolean} hasMeaningfulContent
 * @returns {"in_progress" | null} next status to apply, or null if no change
 */
export function nextStatusOnMeaningfulWrite(currentStatus, hasMeaningfulContent) {
  if (!hasMeaningfulContent) return null;
  const status = normalizeDocWorkStatus(currentStatus);
  if (status) return null;
  return DOC_WORK_STATUS.IN_PROGRESS;
}

/**
 * @param {"in_progress" | "in_review" | "completed" | null | undefined} status
 * @param {(key: string) => string} t
 */
export function docWorkStatusLabel(status, t) {
  const s = normalizeDocWorkStatus(status);
  if (s === DOC_WORK_STATUS.IN_PROGRESS) return t("sidebar.docStatusInProgress");
  if (s === DOC_WORK_STATUS.IN_REVIEW) return t("sidebar.docStatusInReview");
  if (s === DOC_WORK_STATUS.COMPLETED) return t("sidebar.docCompleted");
  return "";
}
