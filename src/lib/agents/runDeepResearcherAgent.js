import { resolveDocumentPlanAgentContext } from "./resolveDocumentPlanAgentContext.js";
import { runDeepResearcher } from "./runPlanAgentClient.js";
import { translate } from "../../i18n/useI18n.js";

export async function runDeepResearcherAgent({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  selectedObjectId = null,
  locale = "en",
}) {
  const context = resolveDocumentPlanAgentContext({
    agentCanvasNodeId,
    canvasNodes,
    connections,
    docsById,
    objectsById,
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

  if (!instruction) {
    return {
      status: "error",
      code: "no_instruction",
      message: translate("agents.errors.no_instruction", lang),
    };
  }

  if (!targetDocId) {
    return {
      status: "error",
      code: "no_target_doc",
      message: translate("agents.errors.no_content_doc", lang),
    };
  }

  return runDeepResearcher({
    instruction,
    brandContext,
    knowledgeContext,
    wiredInputs,
    targetDocId,
    wireOutputDocCanvasNodeId,
    locale: lang,
  });
}
