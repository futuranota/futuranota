import { createDocBlock } from "../docBlocks.js";
import { campaignSignalFieldsFromDetection } from "../campaignSignalFields.js";
import { isoFromDateInput } from "../docDates.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { buildStrategicReportBody } from "./buildStrategicReportBody.js";
import { mapDetectionToCadence } from "./mapDetectionToCadence.js";
import {
  buildLaunchRadarSnapshot,
  launchRadarSnapshotHasData,
  writeLaunchRadarToDoc,
} from "../launchRadarSnapshot.js";

const CATEGORY_LABELS = {
  en: {
    sports: "Sports",
    physical: "Physical products",
    physical_tech: "Physical + tech",
    innovation: "Innovation",
    other: "General",
  },
  es: {
    sports: "Deportes",
    physical: "Productos físicos",
    physical_tech: "Físico + tech",
    innovation: "Innovación",
    other: "General",
  },
};

/**
 * @param {string} raw
 * @param {'en' | 'es'} lang
 */
function formatCategoryLabel(raw, lang) {
  const key = (raw || "").trim().toLowerCase();
  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  return labels[key] || (raw?.trim() || "");
}

/**
 * @param {string | null | undefined} launchDate
 */
function toLaunchAtIso(launchDate) {
  if (!launchDate) return null;
  const trimmed = String(launchDate).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isoFromDateInput(trimmed);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} [report]
 * @param {string} brandName
 * @param {object} doc
 * @param {'en' | 'es'} lang
 */
export function campaignMetaFromDetection(detection, report, brandName, doc, lang = "en") {
  const fields = campaignSignalFieldsFromDetection(brandName, detection || {});
  const campaignActive = report?.campaignActive !== undefined
    ? Boolean(report.campaignActive)
    : Boolean(fields.campaignActive);

  const launchDate = fields.launchDate || detection?.launchDate || "";

  const categoryRaw = fields.category || detection?.category || "";
  const categoryLabel = formatCategoryLabel(categoryRaw, lang) || doc.category || brandName;

  return {
    campaignActive,
    launchAt: campaignActive && launchDate ? toLaunchAtIso(launchDate) : null,
    category: categoryLabel,
  };
}

/**
 * @param {string} docId
 * @param {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} report
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @returns {boolean}
 */
export function applyAnalystReportToDoc(docId, report, detection, brandName, locale = "en") {
  const store = useDocsStore.getState();
  const doc = store.getDoc(docId);
  if (!doc) return false;

  const lang = locale === "es" ? "es" : "en";
  const bodyText = buildStrategicReportBody(report, detection, brandName, lang);
  if (!bodyText.trim()) return false;

  const meta = campaignMetaFromDetection(detection, report, brandName, doc, lang);

  store.updateDoc(docId, {
    blocks: [createDocBlock("text", { text: bodyText })],
    campaignActive: meta.campaignActive,
    launchAt: meta.launchAt,
    category: meta.category,
    reportPresentation: {
      kind: "analyst-strategic-v2",
      animateOnOpen: true,
      animatedAt: null,
    },
  });

  const parentObjectId = doc.parentObjectId || null;
  const parentObject = parentObjectId
    ? useObjectsStore.getState().objects[parentObjectId]
    : null;
  const cadence = mapDetectionToCadence(detection, brandName, parentObject?.cadence || {});
  const snapshot = buildLaunchRadarSnapshot(cadence, detection, brandName, "analyst-doc");
  if (launchRadarSnapshotHasData(snapshot)) {
    writeLaunchRadarToDoc(docId, snapshot);
  }

  useUIStateStore.getState().clearDocEditorDraft(docId);

  return true;
}
