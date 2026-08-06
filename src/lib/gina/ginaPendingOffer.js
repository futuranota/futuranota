/**
 * Session-scoped pending Gina offer (e.g. list_folder) so "sí" re-runs tools.
 * Cleared after consume or explicit clear.
 */

/** @type {{ type: string, folderId?: string, ts?: number } | null} */
let pendingOffer = null;

/**
 * @param {{ type: string, folderId?: string } | null} offer
 */
export function setPendingGinaOffer(offer) {
  pendingOffer = offer
    ? { ...offer, ts: Date.now() }
    : null;
}

export function getPendingGinaOffer() {
  return pendingOffer;
}

export function clearPendingGinaOffer() {
  pendingOffer = null;
}

/**
 * Read and clear in one step.
 * @returns {{ type: string, folderId?: string, ts?: number } | null}
 */
export function consumePendingGinaOffer() {
  const cur = pendingOffer;
  pendingOffer = null;
  return cur;
}
