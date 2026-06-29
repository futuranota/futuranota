import { resolveAgentGraph } from "./resolveAgentGraph.js";
import { runMarketingGuide } from "./runMarketingGuide.js";
import { buildMarketContextBundle } from "./marketContextBundle.js";
import { translate } from "../../i18n/useI18n.js";

/**
 * Marketing Guide — works with or without Campaign Analyst report.
 * Only requires brand (company object on canvas or corpus).
 * @param {object} params
 */
export async function runMarketingGuideAgent({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  selectedObjectId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";

  const graph = resolveAgentGraph({
    agentCanvasNodeId,
    canvasNodes,
    connections,
    docsById,
    objectsById,
    selectedObjectId,
    locale: lang,
  });

  const { brandName, targetDoc, targetDocId } = graph;

  if (!brandName) {
    return {
      status: "error",
      code: "no_brand",
      message: translate("agents.errors.no_brand", lang),
    };
  }

  const inputDoc = targetDoc;
  const bodyText = inputDoc
    ? (inputDoc.blocks?.[0]?.text || inputDoc.body || inputDoc.content || "").trim()
    : "";

  const detection = {
    campaignActive: Boolean(inputDoc?.campaignActive),
    launchDate: inputDoc?.launchAt ? String(inputDoc.launchAt).slice(0, 10) : "",
    announcementDate: "",
    overview: bodyText.slice(0, 400),
  };

  const analystReport = bodyText.length >= 80
    ? {
      openingBrief: bodyText.slice(0, 1600),
      whatsNew: "",
      whatsComing: "",
      strategicRecommendation: "",
      marketContext: "",
      customerMarkets: "",
    }
    : {};

  const marketContextBundle = buildMarketContextBundle(analystReport, detection, brandName);

  const objectInput = (graph.inputs || []).find(
    (n) => n && (n.canvasKind === "object" || n.dataType === "object"),
  );

  const parentObjectId = inputDoc?.parentObjectId
    || graph.targetObjectId
    || objectInput?.objectId
    || selectedObjectId
    || null;

  void targetDocId;

  return runMarketingGuide({
    brandName,
    detection,
    analystReport,
    marketContextBundle,
    parentObjectId,
    locale: lang,
  });
}
