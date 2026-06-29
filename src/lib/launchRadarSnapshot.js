import { generateId } from "./ids.js";
import { isoFromDateInput } from "./docDates.js";
import { parseIsoDate, toIsoDateString } from "./launchCadenceMath.js";
import { useDocsStore } from "../stores/docsStore.js";

/** Fixed data_properties entry name for persisted Launch Radar snapshot. */
export const LAUNCH_RADAR_PROPERTY_NAME = "launchRadar";

/** @typedef {'analyst-doc'|'radar-scan'} LaunchRadarSource */

/**
 * @typedef {Object} LaunchRadarSnapshot
 * @property {LaunchRadarSource} source
 * @property {string} updatedAt ISO datetime
 * @property {string} brandName
 * @property {boolean} campaignActive
 * @property {string|null} [detectionMode]
 * @property {string|null} [launchConfidence]
 * @property {string|null} [launchDate] YYYY-MM-DD
 * @property {string|null} [announcementDate] YYYY-MM-DD
 * @property {string|null} [lastLaunchDate] YYYY-MM-DD
 * @property {number|null} [averageIntervalMonths]
 * @property {number|null} [monthsRemaining]
 * @property {string|null} [estimatedLaunchDate] YYYY-MM-DD
 * @property {string|null} [cadenceStatus]
 * @property {string|null} [cadenceMessage]
 * @property {string|null} [overview]
 * @property {string|null} [category]
 */

/**
 * @param {unknown} value
 * @returns {LaunchRadarSnapshot|null}
 */
export function parseLaunchRadarSnapshot(value) {
  if (!value) return null;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return /** @type {LaunchRadarSnapshot} */ (value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    return /** @type {LaunchRadarSnapshot} */ (parsed);
  } catch {
    return null;
  }
}

/**
 * @param {import("../types/docs.js").Doc|object|null|undefined} doc
 * @returns {LaunchRadarSnapshot|null}
 */
export function readLaunchRadarFromDoc(doc) {
  if (!doc) return null;

  if (doc.launchRadarSnapshot) {
    return parseLaunchRadarSnapshot(doc.launchRadarSnapshot);
  }

  const props = Array.isArray(doc.dataProperties) ? doc.dataProperties : [];
  const entry = props.find((p) => p?.name === LAUNCH_RADAR_PROPERTY_NAME);
  if (!entry?.value) return null;
  return parseLaunchRadarSnapshot(entry.value);
}

/**
 * Derive minimal snapshot from doc metadata when no snapshot was saved yet.
 * @param {import("../types/docs.js").Doc|object} doc
 * @param {string} brandName
 */
export function deriveLaunchRadarFromDocMeta(doc, brandName) {
  if (!doc) return null;

  const launchAt = doc.launchAt || null;
  let launchDate = null;
  if (launchAt) {
    const d = new Date(launchAt);
    if (!Number.isNaN(d.getTime())) {
      launchDate = toIsoDateString(d);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  if (launchDate && launchDate <= todayIso) {
    return null;
  }

  const campaignActive = Boolean(doc.campaignActive && launchDate);
  if (!campaignActive && !launchDate) return null;

  return {
    source: "analyst-doc",
    updatedAt: doc.updatedAt || new Date().toISOString(),
    brandName: brandName.trim(),
    campaignActive,
    detectionMode: campaignActive ? "confirmed_campaign" : null,
    launchConfidence: campaignActive ? "verified" : null,
    launchDate: campaignActive ? launchDate : null,
    announcementDate: null,
    lastLaunchDate: null,
    averageIntervalMonths: null,
    monthsRemaining: null,
    estimatedLaunchDate: null,
    cadenceStatus: null,
    cadenceMessage: null,
    overview: null,
    category: doc.category || null,
  };
}

/**
 * @param {LaunchRadarSnapshot|null|undefined} snapshot
 */
export function launchRadarSnapshotHasData(snapshot) {
  if (!snapshot) return false;
  if (snapshot.launchDate) return true;
  return Boolean(
    snapshot.lastLaunchDate
    && snapshot.averageIntervalMonths != null,
  );
}

/**
 * @param {LaunchRadarSnapshot} snapshot
 * @param {import("../types/docs.js").DataProperty[]} [existingProps]
 */
function upsertLaunchRadarProperty(snapshot, existingProps = []) {
  const serialized = JSON.stringify(snapshot);
  const props = [...(existingProps || [])];
  const idx = props.findIndex((p) => p?.name === LAUNCH_RADAR_PROPERTY_NAME);

  if (idx >= 0) {
    props[idx] = { ...props[idx], type: "text", value: serialized };
  } else {
    props.push({
      id: generateId("PROP"),
      name: LAUNCH_RADAR_PROPERTY_NAME,
      type: "text",
      value: serialized,
    });
  }

  return props;
}

/**
 * @param {object} cadence from mapDetectionToCadence
 * @param {import("./fetchCampaignDetection.js").CampaignDetectionResponse|null} [detection]
 * @param {string} brandName
 * @param {LaunchRadarSource} source
 * @returns {LaunchRadarSnapshot}
 */
export function buildLaunchRadarSnapshot(cadence, detection, brandName, source) {
  const todayIso = new Date().toISOString();
  const launchDate = cadence?.launchDate
    || detection?.launchDate
    || null;
  const campaignActive = Boolean(
    detection?.campaignActive
    || cadence?.detectionMode === "confirmed_campaign"
    || (launchDate && parseIsoDate(launchDate)),
  );

  return {
    source,
    updatedAt: todayIso,
    brandName: brandName.trim(),
    campaignActive: Boolean(campaignActive && launchDate),
    detectionMode: cadence?.detectionMode || detection?.detectionMode || null,
    launchConfidence: cadence?.launchConfidence || null,
    launchDate: launchDate || null,
    announcementDate: cadence?.announcementDate || detection?.announcementDate || null,
    lastLaunchDate: cadence?.lastLaunchDate || detection?.lastLaunchDate || null,
    averageIntervalMonths: cadence?.averageIntervalMonths ?? detection?.averageIntervalMonths ?? null,
    monthsRemaining: cadence?.monthsRemaining ?? detection?.monthsRemaining ?? null,
    estimatedLaunchDate: cadence?.estimatedLaunchDate || detection?.estimatedLaunchDate || null,
    cadenceStatus: cadence?.cadenceStatus || detection?.cadenceStatus || null,
    cadenceMessage: cadence?.cadenceMessage || detection?.cadenceMessage || null,
    overview: (cadence?.overview || detection?.overview || "").trim() || null,
    category: cadence?.category || detection?.category || null,
  };
}

/**
 * @param {LaunchRadarSnapshot} snapshot
 * @returns {import("./fetchCampaignDetection.js").CampaignDetectionResponse}
 */
export function snapshotToDetection(snapshot) {
  if (!snapshot) {
    return {
      campaignActive: false,
      launchDate: null,
      overview: "",
    };
  }

  return {
    brandName: snapshot.brandName,
    campaignActive: snapshot.campaignActive,
    launchDate: snapshot.launchDate,
    announcementDate: snapshot.announcementDate,
    lastLaunchDate: snapshot.lastLaunchDate,
    averageIntervalMonths: snapshot.averageIntervalMonths,
    monthsRemaining: snapshot.monthsRemaining,
    estimatedLaunchDate: snapshot.estimatedLaunchDate,
    detectionMode: snapshot.detectionMode,
    cadenceStatus: snapshot.cadenceStatus,
    cadenceMessage: snapshot.cadenceMessage,
    overview: snapshot.overview || "",
    category: snapshot.category,
  };
}

/**
 * @param {string} docId
 * @param {LaunchRadarSnapshot} snapshot
 */
export function writeLaunchRadarToDoc(docId, snapshot) {
  const store = useDocsStore.getState();
  const doc = store.getDoc(docId);
  if (!doc) return false;

  const dataProperties = upsertLaunchRadarProperty(snapshot, doc.dataProperties);

  store.updateDoc(docId, {
    launchRadarSnapshot: snapshot,
    dataProperties,
    campaignActive: snapshot.campaignActive,
    launchAt: snapshot.launchDate ? isoFromDateInput(snapshot.launchDate) : null,
    category: snapshot.category || doc.category,
  });

  return true;
}

/**
 * @param {import("../types/docs.js").Doc} doc
 * @param {Set<string>} scopeSet
 * @param {string} brandName
 * @param {Record<string, { brand?: string, name?: string }>} [objectsById]
 */
function analystDocMatchesScope(doc, scopeSet, brandName, objectsById = {}) {
  if (scopeSet.size && scopeSet.has(doc?.parentObjectId)) return true;

  const brandLower = (brandName || "").trim().toLowerCase();
  if (brandLower && doc?.parentObjectId && objectsById[doc.parentObjectId]) {
    const parent = objectsById[doc.parentObjectId];
    const parentBrand = (parent?.brand || parent?.name || "").trim().toLowerCase();
    if (parentBrand && parentBrand === brandLower) return true;
  }

  if (!brandLower) return false;

  const snapshot = readLaunchRadarFromDoc(doc)
    || deriveLaunchRadarFromDocMeta(doc, brandName);
  if (!snapshot) return false;

  const snapBrand = (snapshot.brandName || "").trim().toLowerCase();
  return Boolean(snapBrand && snapBrand === brandLower);
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docsById
 * @param {{ corpusId?: string|null, scopeIds?: string[], brandName?: string, objectsById?: Record<string, object> }} [options]
 * @returns {{ doc: import("../types/docs.js").Doc, snapshot: LaunchRadarSnapshot|null }|null}
 */
export function findLatestAnalystDocForScope(docsById, options = {}) {
  const { corpusId = null, scopeIds = [], brandName = "", objectsById = {} } = options;
  const scopeSet = new Set([corpusId, ...(scopeIds || [])].filter(Boolean));
  const brandLower = (brandName || "").trim().toLowerCase();

  const candidates = Object.values(docsById || {})
    .filter((doc) => doc?.reportPresentation?.kind === "analyst-strategic-v2")
    .filter((doc) => {
      if (!scopeSet.size && !brandLower) return true;
      return analystDocMatchesScope(doc, scopeSet, brandName, objectsById);
    })
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });

  for (const doc of candidates) {
    const snapshot = readLaunchRadarFromDoc(doc);
    if (snapshot) return { doc, snapshot };
  }

  const latest = candidates[0];
  if (!latest) return null;

  return { doc: latest, snapshot: null };
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docsById
 * @param {string} corpusId
 * @returns {{ doc: import("../types/docs.js").Doc, snapshot: LaunchRadarSnapshot|null }|null}
 */
export function findLatestAnalystDocForCorpus(docsById, corpusId) {
  if (!corpusId) return null;
  return findLatestAnalystDocForScope(docsById, { corpusId, scopeIds: [corpusId] });
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docsById
 * @param {string} corpusId
 * @param {string} brandName
 * @param {string[]} [scopeIds]
 * @param {Record<string, object>} [objectsById]
 * @returns {LaunchRadarSnapshot|null}
 */
export function resolveLaunchRadarSnapshotForCorpus(
  docsById,
  corpusId,
  brandName,
  scopeIds = [],
  objectsById = {},
) {
  const found = findLatestAnalystDocForScope(docsById, {
    corpusId,
    scopeIds,
    brandName,
    objectsById,
  });
  if (!found) return null;

  if (found.snapshot) return found.snapshot;
  return deriveLaunchRadarFromDocMeta(found.doc, brandName);
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export function corpusHasLaunchRadarReportReady(objectsById, corpusObjectId) {
  if (!corpusObjectId) return false;
  const object = objectsById[corpusObjectId];
  return Boolean(
    object?.cadence?.launchRadarAgentReadyAt
    || object?.cadence?.launchRadarReportReadyAt,
  );
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docsById
 * @param {Record<string, object>} [objectsById]
 */
export function workspaceHasCampaignAnalystReport(docsById, objectsById = {}) {
  if (Object.values(objectsById).some((obj) => corpusHasLaunchRadarReportReady(objectsById, obj?.id))) {
    return true;
  }
  return Boolean(findLatestAnalystDocForScope(docsById, { objectsById })?.doc);
}
