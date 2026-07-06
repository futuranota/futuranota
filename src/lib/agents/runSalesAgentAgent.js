import { resolveDocumentPlanAgentContext } from "./resolveDocumentPlanAgentContext.js";
import { runSalesAgent } from "./runPlanAgentClient.js";
import { translate } from "../../i18n/useI18n.js";

export async function runSalesAgentAgent({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  selectedObjectId = null,
  locale = "en",
}) {
  const context = resolveDocumentPlanAgentContext({
    agentCanvasNodeId,
    canvasNodes,
    connections,
    docsById,
    objectsById,
    nodeEntitiesById,
    selectedObjectId,
    locale,
  });

  const {
    lang,
    instruction,
    brandContext,
    knowledgeContext,
    wiredInputs,
    targetDocId,
    wireOutputDocCanvasNodeId,
  } = context;

  if (!targetDocId) {
    return {
      status: "error",
      code: "no_target_doc",
      message: translate("agents.errors.plan_no_content_doc", lang),
    };
  }

  if (!instruction) {
    return {
      status: "error",
      code: "no_instruction",
      message: translate("agents.errors.plan_no_instruction", lang),
    };
  }

  return runSalesAgent({
    instruction,
    brandContext,
    knowledgeContext,
    wiredInputs,
    targetDocId,
    wireOutputDocCanvasNodeId,
    locale: lang,
  });
}
