import { fetchContentCreator } from "../fetchContentCreator.js";
import { checkIntelCreditGate } from "../intelPlanGate.js";
import { debitIntelCredit } from "../debitIntelCredit.js";
import { translate } from "../../i18n/useI18n.js";
import { getAgentRunCost } from "./agentCreditCosts.js";
import { AGENT_CONTENT_CREATOR } from "./registry.js";
import { applyContentCreatorOutputToDoc } from "./applyContentPlanToDoc.js";
import { applyBlogToMacroNode } from "./applyBlogToMacroNode.js";

/**
 * @param {object} params
 * @param {string} params.instruction
 * @param {object} [params.brandContext]
 * @param {string} [params.knowledgeContext]
 * @param {object[]} [params.wiredInputs]
 * @param {'document_plan'|'macro_blog'} [params.mode]
 * @param {string} [params.macroTitle]
 * @param {string|null} [params.scheduleAt]
 * @param {string|null} [params.targetDocId]
 * @param {string|null} [params.targetNodeEntityId]
 * @param {string|null} [params.wireOutputDocCanvasNodeId]
 * @param {'en'|'es'} [params.locale]
 */
export async function runContentCreator({
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
  mode = "document_plan",
  macroTitle = "",
  scheduleAt = null,
  targetDocId = null,
  targetNodeEntityId = null,
  wireOutputDocCanvasNodeId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";
  const task = (instruction || "").trim();
  const isMacroBlog = mode === "macro_blog";

  if (!task) {
    return {
      status: "error",
      code: "no_instruction",
      message: translate(
        isMacroBlog ? "agents.errors.no_macro_instruction" : "agents.errors.no_instruction",
        lang,
      ),
    };
  }

  if (isMacroBlog && !targetNodeEntityId) {
    return {
      status: "error",
      code: "no_macro_node",
      message: translate("agents.errors.no_macro_node", lang),
    };
  }

  if (!isMacroBlog && !targetDocId) {
    return {
      status: "error",
      code: "no_target_doc",
      message: translate("agents.errors.no_content_doc", lang),
    };
  }

  const { creditCost, routeLabel, endpoint } = getAgentRunCost(AGENT_CONTENT_CREATOR);
  const gate = await checkIntelCreditGate({ creditCost });
  if (!gate.ok) {
    return {
      status: "error",
      code: gate.code || "gate_tokens",
      message: gate.message || translate("agents.errors.gate_tokens", lang),
    };
  }

  let plan;
  try {
    plan = await fetchContentCreator({
      instruction: task,
      brandContext,
      knowledgeContext,
      wiredInputs,
      mode,
      macroTitle,
      scheduleAt,
      locale: lang,
    });
  } catch (err) {
    return {
      status: "error",
      code: "api",
      message: err instanceof Error ? err.message : translate("agents.errors.content_creator_api", lang),
    };
  }

  const debit = await debitIntelCredit({
    creditCost,
    routeLabel,
    endpoint,
    meta: {
      agent: AGENT_CONTENT_CREATOR,
      mode,
      instruction: task.slice(0, 120),
    },
  });
  if (!debit.ok) {
    return {
      status: "error",
      code: "gate_tokens",
      message: translate("agents.errors.gate_tokens", lang),
    };
  }

  if (!isMacroBlog && !String(plan.nextStepsMessage || "").trim()) {
    plan.nextStepsMessage = translate("agents.contentCreatorNextSteps", lang);
  }

  if (isMacroBlog) {
    if (!plan.writtenContent?.headline && macroTitle) {
      plan.writtenContent = {
        ...plan.writtenContent,
        headline: macroTitle,
      };
    }

    const applied = applyBlogToMacroNode(targetNodeEntityId, plan, macroTitle);
    if (!applied) {
      return {
        status: "error",
        code: "apply_failed",
        message: translate("agents.errors.content_creator_macro_apply", lang),
      };
    }

    const brandName = (brandContext?.brand || brandContext?.name || "").trim();
    const wroteTodo = (plan.items?.length ?? 0) > 0 && !String(plan.writtenContent?.body || "").trim();
    return {
      status: "success",
      mode: "macro_blog",
      docId: targetDocId,
      targetNodeEntityId,
      macroTitle,
      wireOutputDocCanvasNodeId,
      brandName,
      plan,
      userFacingMessage: wroteTodo
        ? translate("agents.contentCreatorMacroTodoSuccess", lang, { title: macroTitle || plan.items?.[0]?.text || "" })
        : translate("agents.contentCreatorBlogSuccess", lang, {
          title: macroTitle || (lang === "es" ? "blog" : "blog"),
        }),
    };
  }

  const applied = applyContentCreatorOutputToDoc(targetDocId, plan);
  if (!applied) {
    return {
      status: "error",
      code: "apply_failed",
      message: translate("agents.errors.content_creator_apply", lang),
    };
  }

  const brandName = (brandContext?.brand || brandContext?.name || "").trim();
  const nextSteps = (plan.nextStepsMessage || "").trim()
    || translate("agents.contentCreatorNextSteps", lang);

  return {
    status: "success",
    mode: "document_plan",
    docId: targetDocId,
    wireOutputDocCanvasNodeId,
    brandName,
    plan,
    userFacingMessage: [
      translate("agents.contentCreatorSuccess", lang, {
        brand: brandName || (lang === "es" ? "contenido" : "content"),
        count: String(plan.items?.length || 0),
      }),
      nextSteps,
    ].join(" "),
  };
}
