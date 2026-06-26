import { createDocBlock } from "./docBlocks.js";
import { campaignSignalFieldsFromDetection } from "./campaignSignalFields.js";
import { DOC_KIND_CONTENT } from "./templateDoc.js";

/**
 * @param {import("./fetchCampaignDetection.js").CampaignCitation[]} citations
 */
function buildInformeFromCitations(citations) {
  return citations
    .map((c, idx) => {
      const label = c.title || c.domain || c.source || `Fuente ${idx + 1}`;
      const body = (c.body || "").trim();
      return `${idx + 1}. ${label}\n${c.url}${body ? `\n${body}` : ""}`;
    })
    .join("\n\n");
}

/**
 * @param {import("./fetchCampaignDetection.js").CampaignDetectionResponse} result
 * @param {string} brandName
 * @param {string|null} parentObjectId
 */
export function buildCampaignDocFromDetection(result, brandName, parentObjectId = null) {
  const fields = campaignSignalFieldsFromDetection(brandName, result);
  const name = fields.brandName || brandName.trim();
  const title = name ? `Campaña · ${name}` : "Campaña";
  const citations = Array.isArray(result.citations) ? result.citations : [];

  const blocks = [];

  const overview = (fields.overview || result.overview || "").trim();
  if (overview) {
    blocks.push(createDocBlock("h1", { title: "Resumen" }));
    blocks.push(createDocBlock("text", { text: overview }));
  }

  let deepReport = (result.deepReport || "").trim();
  if (!deepReport && citations.length > 0) {
    deepReport = buildInformeFromCitations(citations);
  }

  if (deepReport) {
    blocks.push(createDocBlock("h1", { title: "Informe" }));
    blocks.push(createDocBlock("text", { text: deepReport }));
  }

  const signals = Array.isArray(result.launchSignals) ? result.launchSignals : [];
  if (signals.length > 0) {
    blocks.push(createDocBlock("h1", { title: "Señales de lanzamiento" }));
    const signalLines = signals.map((sig, idx) => {
      const datePart = sig.dateHint ? ` (${sig.dateHint})` : "";
      const quote = sig.quote ? `: "${sig.quote}"` : "";
      return `${idx + 1}. ${sig.phrase || "Señal"}${datePart}${quote}\n${sig.url || ""}`;
    });
    blocks.push(createDocBlock("text", { text: signalLines.join("\n\n") }));
  }

  if (citations.length > 0) {
    blocks.push(createDocBlock("h1", { title: "Fuentes" }));
    blocks.push(createDocBlock("text", { text: buildInformeFromCitations(citations) }));
  }

  if (blocks.length === 0 && overview) {
    blocks.push(createDocBlock("text", { text: overview }));
  }

  const launchAt = fields.launchDate || null;

  return {
    title,
    parentObjectId,
    blocks,
    campaignMeta: {
      docKind: DOC_KIND_CONTENT,
      launchAt,
      campaignActive: Boolean(fields.campaignActive),
      category: fields.category || name,
    },
  };
}
