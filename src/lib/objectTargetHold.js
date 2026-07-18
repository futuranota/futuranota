/**
 * Effective Dashboard/Timeline target resolver for the "Import Object" hold.
 * When a company is pinned, the Dashboard and Timeline stay on it regardless of
 * what the user browses in the sidebar. When nothing is pinned, they follow the
 * current browsing target.
 *
 * @param {string|null|undefined} heldObjectId pinned object (Import Object)
 * @param {string|null|undefined} browsingObjectId current sidebar target
 * @returns {string|null}
 */
export function resolveEffectiveDashboardObjectId(heldObjectId, browsingObjectId) {
  return heldObjectId || browsingObjectId || null;
}
