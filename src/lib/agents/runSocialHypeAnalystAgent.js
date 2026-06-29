import { resolveAgentGraph } from "./resolveAgentGraph.js";
import { runSocialHypeAnalyst } from "./runSocialHypeAnalyst.js";
import { translate } from "../../i18n/useI18n.js";

/**
 * Canvas agent entry — Social Hype Distribution Analyst.
 * @param {object} params
 */
export async function runSocialHypeAnalystAgent({
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

  const { brandName, targetDocId } = graph;

  if (!brandName) {
    return {
      status: "error",
      code: "no_brand",
      message: translate("agents.errors.no_brand", lang),
    };
  }

  const objectInput = (graph.inputs || []).find(
    (n) => n && (n.canvasKind === "object" || n.dataType === "object"),
  );

  const parentObjectId = graph.targetObjectId
    || objectInput?.objectId
    || selectedObjectId
    || null;

  return runSocialHypeAnalyst({
    brandName,
    keyword: brandName,
    parentObjectId,
    targetDocId,
    locale: lang,
  });
}
