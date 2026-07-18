import { normalizeDoc } from "./normalizeDoc.js";

/**
 * Idempotent, non-destructive migration for Campaign workspace fields.
 * Existing campaignActive docs keep their IDs, body, blocks, nodeIds, icon,
 * and company ownership. Missing Activate At is backfilled from Target Launch.
 *
 * @param {Record<string, object>} docsById
 * @returns {{ docs: Record<string, object>, changed: boolean, migratedIds: string[] }}
 */
export function migrateCampaignWorkspaceDocs(docsById = {}) {
  /** @type {Record<string, object>} */
  const next = {};
  /** @type {string[]} */
  const migratedIds = [];
  let changed = false;

  for (const [id, raw] of Object.entries(docsById || {})) {
    const doc = normalizeDoc(raw);
    if (!doc) {
      next[id] = raw;
      continue;
    }

    if (!doc.campaignActive) {
      next[id] = doc;
      continue;
    }

    let patched = doc;
    let localChanged = false;

    if (!doc.campaignActivateAt && doc.launchAt) {
      patched = { ...patched, campaignActivateAt: doc.launchAt };
      localChanged = true;
    }

    if (doc.campaignCompleted == null) {
      patched = { ...patched, campaignCompleted: false };
      localChanged = true;
    }

    // Campaign Launch must not act as a Schedule reservation. We leave any
    // legacy schedule_* values on the object (non-destructive) but Timeline /
    // reservation resolvers ignore them for campaignActive docs.
    if (localChanged) {
      changed = true;
      migratedIds.push(id);
      next[id] = normalizeDoc(patched);
    } else {
      next[id] = doc;
    }
  }

  return { docs: next, changed, migratedIds };
}
