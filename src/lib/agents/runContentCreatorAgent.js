import { resolveContentCreatorContext } from "./resolveContentCreatorContext.js";
import { runContentCreator } from "./runContentCreator.js";
import { translate } from "../../i18n/useI18n.js";

/**
 * Canvas agent entry — Content Creator specialist.
 * @param {object} params
 */
export async function runContentCreatorAgent({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  selectedObjectId = null,
  preferredMacroEntityId = null,
  locale = "en",
}) {
  const context = resolveContentCreatorContext({
    agentCanvasNodeId,
    canvasNodes,
    connections,
    docsById,
    objectsById,
    nodeEntitiesById,
    selectedObjectId,
    preferredMacroEntityId,
    locale,
  });

  const {
    lang,
    mode,
    instruction,
    macroTitle,
    scheduleAt,
    brandContext,
    knowledgeContext,
    wiredInputs,
    targetDocId,
    targetNodeEntityId,
    wireOutputDocCanvasNodeId,
  } = context;

  if (!instruction) {
    return {
      status: "error",
      code: mode === "macro_blog" ? "no_macro_instruction" : "no_instruction",
      message: translate(
        mode === "macro_blog" ? "agents.errors.no_macro_instruction" : "agents.errors.no_instruction",
        lang,
      ),
    };
  }

  if (mode === "macro_blog" && !targetNodeEntityId) {
    return {
      status: "error",
      code: "no_macro_node",
      message: translate("agents.errors.no_macro_node", lang),
    };
  }

  if (mode !== "macro_blog" && !targetDocId) {
    return {
      status: "error",
      code: "no_target_doc",
      message: translate("agents.errors.no_content_doc", lang),
    };
  }

  return runContentCreator({
    instruction,
    brandContext,
    knowledgeContext,
    wiredInputs,
    mode,
    macroTitle,
    scheduleAt,
    targetDocId,
    targetNodeEntityId,
    wireOutputDocCanvasNodeId,
    locale: lang,
  });
}
