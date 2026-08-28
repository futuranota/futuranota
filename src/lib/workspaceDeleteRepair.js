import {
  isDocMarkedDeletedForSync,
  isNodeMarkedDeletedForSync,
} from "../stores/middleware/persistenceMiddleware.js";

/** Fired when a folder was removed locally but cloud purge/sync failed. */
export const WORKSPACE_FOLDER_DELETE_SYNC_FAILED = "futura-nota:folder-delete-sync-failed";

/**
 * Product rule: deleted folders must not appear in sidebar, picker, or hydrate lists.
 * @param {object|null|undefined} doc
 */
export function isWorkspaceFolderVisible(doc) {
  if (!doc?.id) return false;
  return !isDocMarkedDeletedForSync(doc.id);
}

/** @param {object|null|undefined} node */
export function isWorkspaceNodeVisible(node) {
  if (!node?.id) return false;
  return !isNodeMarkedDeletedForSync(node.id);
}

/**
 * @param {{ docId?: string, label?: string, error?: unknown }} detail
 */
export function emitWorkspaceFolderDeleteSyncFailed(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_FOLDER_DELETE_SYNC_FAILED, { detail }));
}
