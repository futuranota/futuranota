/**
 * Cloud-account safety: a second browser with a partial local snapshot
 * must never orphan-delete richer remote rows (folders / companies / nodes).
 * Explicit user deletes still go through tombstone purge, not this guard.
 */

/**
 * @param {object} params
 * @param {number} params.localCount
 * @param {number} params.remoteCount
 * @param {boolean} [params.hasPendingDeletes]
 * @param {boolean} [params.remoteCountUnknown]
 * @returns {boolean} true → orphan-delete against local ids is allowed
 */
export function shouldAllowOrphanDelete({
  localCount,
  remoteCount,
  hasPendingDeletes = false,
  remoteCountUnknown = false,
}) {
  const local = Number(localCount) || 0;
  const remote = Number(remoteCount) || 0;

  // Tombstones mean the user (or another tab) intended deletes — orphan cleanup may run.
  if (hasPendingDeletes) return true;
  // Empty local is never a wipe of cloud (second browser / failed hydrate).
  if (local <= 0) return false;
  // Could not read remote counts — refuse, do not guess.
  if (remoteCountUnknown) return false;
  // Local is a subset of cloud — wiping orphans would destroy the account.
  if (remote > local) return false;
  return true;
}
