/**
 * Resolve persisted Social Hype snapshot for a corpus scope.
 */

/**
 * @param {import("../types/docs.js").Doc|object|null|undefined} doc
 */
export function readHypeSnapshotFromDoc(doc) {
  if (!doc) return null;

  const props = Array.isArray(doc.dataProperties) ? doc.dataProperties : [];
  const entry = props.find((p) => p?.key === "hypeSnapshot" || p?.name === "hypeSnapshot");
  if (!entry?.value) return null;

  try {
    const parsed = typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
    return parsed?.socialHype ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {import("../types/docs.js").Doc} doc
 * @param {Set<string>} scopeSet
 * @param {string} brandName
 * @param {Record<string, { brand?: string, name?: string }>} [objectsById]
 */
function hypeDocMatchesScope(doc, scopeSet, brandName, objectsById = {}) {
  if (scopeSet.size && scopeSet.has(doc?.parentObjectId)) return true;

  const brandLower = (brandName || "").trim().toLowerCase();
  if (brandLower && doc?.parentObjectId && objectsById[doc.parentObjectId]) {
    const parent = objectsById[doc.parentObjectId];
    const parentBrand = (parent?.brand || parent?.name || "").trim().toLowerCase();
    if (parentBrand && parentBrand === brandLower) return true;
  }

  if (!brandLower) return false;

  const snapshot = readHypeSnapshotFromDoc(doc);
  const snapBrand = (snapshot?.brandName || "").trim().toLowerCase();
  return Boolean(snapBrand && snapBrand === brandLower);
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docsById
 * @param {{ corpusId?: string|null, scopeIds?: string[], brandName?: string, objectsById?: Record<string, object> }} [options]
 */
export function findLatestHypeDocForScope(docsById, options = {}) {
  const { corpusId = null, scopeIds = [], brandName = "", objectsById = {} } = options;
  const scopeSet = new Set([corpusId, ...(scopeIds || [])].filter(Boolean));

  const candidates = Object.values(docsById || {})
    .filter((doc) => doc?.reportPresentation?.kind === "social-hype-v1"
      || (Array.isArray(doc?.tags) && doc.tags.includes("social-hype")))
    .filter((doc) => {
      if (!scopeSet.size && !brandName) return true;
      return hypeDocMatchesScope(doc, scopeSet, brandName, objectsById);
    })
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });

  for (const doc of candidates) {
    const snapshot = readHypeSnapshotFromDoc(doc);
    if (snapshot) return { doc, snapshot };
  }

  return null;
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 * @param {Record<string, import("../types/docs.js").Doc>} docsById
 * @param {string} brandName
 * @param {string[]} [scopeIds]
 */
export function resolveHypeSnapshotForCorpus(
  objectsById,
  corpusObjectId,
  docsById,
  brandName,
  scopeIds = [],
) {
  const object = corpusObjectId ? objectsById[corpusObjectId] : null;
  const objectSnapshot = object?.cadence?.hypeSnapshot || null;
  if (objectSnapshot?.socialHype) {
    return {
      snapshot: objectSnapshot,
      sections: object?.cadence?.hypeAnalystSections || null,
      snapshotAt: object?.cadence?.hypeSnapshotAt || objectSnapshot.collectedAt || null,
    };
  }

  const found = findLatestHypeDocForScope(docsById, {
    corpusId: corpusObjectId,
    scopeIds,
    brandName,
    objectsById,
  });

  if (found?.snapshot) {
    const objectSections = corpusObjectId
      ? objectsById[corpusObjectId]?.cadence?.hypeAnalystSections
      : null;
    return {
      snapshot: found.snapshot,
      sections: objectSections || null,
      snapshotAt: found.snapshot.collectedAt || found.doc.updatedAt || null,
    };
  }

  if (corpusObjectId) {
    const fallback = findLatestHypeDocForScope(docsById, {
      corpusId: corpusObjectId,
      scopeIds: [corpusObjectId, ...scopeIds],
      brandName: "",
      objectsById,
    });
    if (fallback?.snapshot) {
      const objectSections = corpusObjectId
        ? objectsById[corpusObjectId]?.cadence?.hypeAnalystSections
        : null;
      return {
        snapshot: fallback.snapshot,
        sections: objectSections || null,
        snapshotAt: fallback.snapshot.collectedAt || fallback.doc.updatedAt || null,
      };
    }
  }

  return null;
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export function corpusHasHypeReportReady(objectsById, corpusObjectId) {
  if (!corpusObjectId) return false;
  const object = objectsById[corpusObjectId];
  return Boolean(object?.cadence?.hypeAgentReadyAt || object?.cadence?.hypeReportReadyAt);
}

/**
 * @param {object|null|undefined} snapshot
 */
export function hypeSnapshotHasData(snapshot) {
  return Boolean(snapshot?.socialHype);
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export { readMarketHypePanelSaved, writeMarketHypePanelSaved } from "./panelAgentLoop.js";
