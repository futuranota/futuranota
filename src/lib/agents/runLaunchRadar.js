import { fetchCampaignDetection } from "../fetchCampaignDetection.js";
import { DEFAULT_RANGE_DAYS } from "../campaignWindow.js";
import { TOKEN_COSTS } from "../planConfig.js";
import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { mapDetectionToCadence } from "./mapDetectionToCadence.js";
import { resolveLaunchRadarObjectId } from "./resolveLaunchRadarObjectId.js";
import {
  buildLaunchRadarSnapshot,
  findLatestAnalystDocForCorpus,
  resolveLaunchRadarSnapshotForCorpus,
  snapshotToDetection,
  writeLaunchRadarToDoc,
} from "../launchRadarSnapshot.js";

/**
 * @typedef {Object} LaunchRadarApplyResult
 * @property {boolean} ok
 * @property {object|null} cadence
 * @property {import("../launchRadarSnapshot.js").LaunchRadarSnapshot|null} snapshot
 * @property {string|null} docId
 * @property {string|null} message
 */

/**
 * @param {object} params
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} params.detection
 * @param {string} params.brandName
 * @param {string|null} params.corpusId
 * @param {string|null} [params.docId]
 * @param {'analyst-doc'|'radar-scan'} params.source
 * @returns {LaunchRadarApplyResult}
 */
export function applyLaunchRadarResult({
  detection,
  brandName,
  corpusId,
  docId = null,
  source,
}) {
  const objectId = resolveLaunchRadarObjectId(
    useObjectsStore.getState().objects,
    brandName,
    corpusId,
  );

  if (!objectId) {
    return {
      ok: false,
      cadence: null,
      snapshot: null,
      docId: null,
      message: "No corpus object found for Launch Radar.",
    };
  }

  const object = useObjectsStore.getState().objects[objectId];
  const cadence = mapDetectionToCadence(detection, brandName, object?.cadence || {});
  useObjectsStore.getState().updateObject(objectId, { cadence });

  const snapshot = buildLaunchRadarSnapshot(cadence, detection, brandName, source);
  const targetDocId = docId
    || findLatestAnalystDocForCorpus(useDocsStore.getState().docs, corpusId)?.doc?.id
    || null;

  if (targetDocId) {
    writeLaunchRadarToDoc(targetDocId, snapshot);
  }

  useUIStateStore.getState().setSelectedObjectId(objectId);
  useUIStateStore.getState().setFilterObjectId(objectId);

  return {
    ok: true,
    cadence,
    snapshot,
    docId: targetDocId,
    message: null,
  };
}

/**
 * Sync Launch Radar from latest Campaign Analyst doc (0 tokens).
 * @param {object} params
 * @param {string} params.corpusId
 * @param {string} params.brandName
 * @param {'en'|'es'} [params.locale]
 */
export function syncLaunchRadarFromAnalystDoc({ corpusId, brandName, locale = "es" }) {
  const docs = useDocsStore.getState().docs;
  const found = findLatestAnalystDocForCorpus(docs, corpusId);

  if (!found) {
    return {
      ok: false,
      cadence: null,
      snapshot: null,
      docId: null,
      message: locale === "es"
        ? "No hay informe del Campaign Analyst en este corpus. Corré el analista primero."
        : "No Campaign Analyst report in this corpus. Run the analyst first.",
    };
  }

  const snapshot = found.snapshot
    || resolveLaunchRadarSnapshotForCorpus(docs, corpusId, brandName);

  if (!snapshot) {
    return {
      ok: false,
      cadence: null,
      snapshot: null,
      docId: found.doc.id,
      message: locale === "es"
        ? "El informe no tiene fechas de Launch Radar. Probá escanear cadencia."
        : "The report has no Launch Radar dates. Try scanning cadence.",
    };
  }

  const detection = snapshotToDetection(snapshot);
  return applyLaunchRadarResult({
    detection,
    brandName,
    corpusId,
    docId: found.doc.id,
    source: "analyst-doc",
  });
}

/**
 * Build scan instructions from brand + optional Campaign Analyst doc (input context only).
 * @param {string} brandName
 * @param {import("../types/docs.js").Doc|null|undefined} analystDoc
 * @param {'en'|'es'} locale
 */
export function buildLaunchRadarInstructions(brandName, analystDoc, locale = "es") {
  const lang = locale === "es" ? "es" : "en";
  const base = lang === "es"
    ? `Analizá fechas de lanzamiento para ${brandName}: campaña activa (countdown) o cadencia histórica (intervalo promedio). Priorizá fechas futuras verificables.`
    : `Analyze launch dates for ${brandName}: active campaign countdown or historical cadence (average interval). Prioritize verifiable future dates.`;

  if (!analystDoc) return base;

  const text = (analystDoc.blocks || [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1200);

  if (!text) return base;

  const prefix = lang === "es"
    ? "Contexto del informe Campaign Analyst (usar como señales, no repetir texto):\n\n"
    : "Campaign Analyst report context (use as signals, do not repeat verbatim):\n\n";

  return `${base}\n\n${prefix}${text}`;
}

/**
 * Manual Launch Radar run — API call with instructions (~1k tokens). No auto-load.
 * @param {object} params
 * @param {string} params.brandName
 * @param {string|null} params.corpusId
 * @param {number} [params.rangeDays]
 * @param {'en'|'es'} [params.locale]
 */
export async function runLaunchRadarAnalysis({
  brandName,
  corpusId,
  rangeDays = DEFAULT_RANGE_DAYS,
  locale = "es",
}) {
  const lang = locale === "es" ? "es" : "en";
  const tokenCost = TOKEN_COSTS.cadenceLive;
  const planStore = usePlanStore.getState();

  if (!planStore.canSpendTokens(tokenCost)) {
    useUpgradeModalStore.getState().show("tokens");
    return {
      ok: false,
      cadence: null,
      snapshot: null,
      docId: null,
      message: lang === "es" ? "Tokens insuficientes." : "Insufficient tokens.",
      code: "gate_tokens",
    };
  }

  const found = corpusId
    ? findLatestAnalystDocForCorpus(useDocsStore.getState().docs, corpusId)
    : null;
  const userQuery = buildLaunchRadarInstructions(brandName, found?.doc, lang);

  let detection;
  try {
    detection = await fetchCampaignDetection({
      brandName,
      rangeDays,
      mode: "radar",
      userQuery,
      locale: lang,
    });
  } catch (err) {
    return {
      ok: false,
      cadence: null,
      snapshot: null,
      docId: null,
      message: err instanceof Error ? err.message : "Launch Radar failed",
    };
  }

  const spent = await planStore.spendTokens(tokenCost);
  if (!spent) {
    useUpgradeModalStore.getState().show("tokens");
    return {
      ok: false,
      cadence: null,
      snapshot: null,
      docId: null,
      message: lang === "es" ? "No se pudieron debitar tokens." : "Could not debit tokens.",
      code: "gate_tokens",
    };
  }

  return applyLaunchRadarResult({
    detection,
    brandName,
    corpusId,
    docId: found?.doc?.id || null,
    source: "radar-scan",
  });
}

/**
 * Hydrate Launch Radar from persisted doc snapshot (0 tokens, no write).
 * @param {string} corpusId
 * @param {string} brandName
 */
export function hydrateLaunchRadarFromCorpusDoc(corpusId, brandName) {
  const docs = useDocsStore.getState().docs;
  const snapshot = resolveLaunchRadarSnapshotForCorpus(docs, corpusId, brandName);
  if (!snapshot) return null;

  const detection = snapshotToDetection(snapshot);
  const objectId = resolveLaunchRadarObjectId(
    useObjectsStore.getState().objects,
    brandName,
    corpusId,
  );
  if (!objectId) return null;

  const object = useObjectsStore.getState().objects[objectId];
  const cadence = mapDetectionToCadence(detection, brandName, object?.cadence || {});
  return { cadence, snapshot, detection };
}
