import { createDocBlock } from "./docBlocks.js";
import { campaignSignalFieldsFromDetection } from "../campaignSignalFields.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { campaignMetaFromDetection } from "./applyAnalystReportToDoc.js";

/**
 * Plain-text body from detection (no H1 blocks).
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 */
function buildDetectionBodyText(detection, brandName) {
  const fields = campaignSignalFieldsFromDetection(brandName, detection || {});
  const parts = [];

  const status = fields.campaignActive
    ? `Campaign active — ${fields.brandName || brandName}${fields.launchDate ? ` · launch ${fields.launchDate}` : ""}`
    : `Campaign inactive — ${fields.brandName || brandName}`;
  parts.push(status);

  const overview = (fields.overview || detection?.deepReport || "").trim();
  if (overview) parts.push(overview);

  const citations = Array.isArray(detection?.citations) ? detection.citations : [];
  if (citations.length > 0) {
    const lines = citations.slice(0, 8).map((c, idx) => {
      const title = c.title || c.domain || `Source ${idx + 1}`;
      return `${idx + 1}. ${title}\n${c.url}`;
    });
    parts.push(`Sources\n\n${lines.join("\n\n")}`);
  }

  return parts.join("\n\n");
}

/**
 * Writes campaign detection into an existing document (preserves title).
 * @param {string} docId
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @returns {boolean}
 */
export function applyDetectionToDoc(docId, detection, brandName, locale = "en") {
  const store = useDocsStore.getState();
  const doc = store.getDoc(docId);
  if (!doc) return false;

  const lang = locale === "es" ? "es" : "en";
  const bodyText = buildDetectionBodyText(detection, brandName);
  const meta = campaignMetaFromDetection(detection, null, brandName, doc, lang);

  store.updateDoc(docId, {
    blocks: bodyText.trim()
      ? [createDocBlock("text", { text: bodyText })]
      : doc.blocks,
    campaignActive: meta.campaignActive,
    launchAt: meta.launchAt,
    category: meta.category,
  });

  return true;
}
