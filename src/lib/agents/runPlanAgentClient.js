import { fetchDeepResearcher, fetchSalesAgent } from "../fetchPlanAgents.js";
import { checkIntelCreditGate } from "../intelPlanGate.js";
import { debitIntelCredit } from "../debitIntelCredit.js";
import { translate } from "../../i18n/useI18n.js";
import { getAgentRunCost } from "./agentCreditCosts.js";
import { AGENT_DEEP_RESEARCHER, AGENT_SALES_AGENT } from "./registry.js";
import { applyAgentPlanOutputToDoc } from "./applyAgentPlanOutputToDoc.js";

/**
 * @param {'sales-agent' | 'deep-researcher'} agentId
 * @param {object} params
 */
async function runPlanAgentClient(agentId, {
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
  targetDocId = null,
  wireOutputDocCanvasNodeId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";
  const task = (instruction || "").trim();
  const isSales = agentId === AGENT_SALES_AGENT;
  const agentConst = isSales ? AGENT_SALES_AGENT : AGENT_DEEP_RESEARCHER;
  const reportKind = isSales ? "sales-plan-v1" : "research-map-v1";

  if (!task) {
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

  const { creditCost, routeLabel, endpoint } = getAgentRunCost(agentConst);
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
    const fetcher = isSales ? fetchSalesAgent : fetchDeepResearcher;
    plan = await fetcher({
      instruction: task,
      brandContext,
      knowledgeContext,
      wiredInputs,
      locale: lang,
    });
  } catch (err) {
    const code = err?.code === "agent_forbidden" ? "agent_forbidden" : "api";
    const message = err?.code === "agent_forbidden"
      ? translate("agents.errors.agent_forbidden", lang)
      : (err instanceof Error ? err.message : translate(
        isSales ? "agents.errors.sales_agent_api" : "agents.errors.deep_researcher_api",
        lang,
      ));
    return { status: "error", code, message };
  }

  const debit = await debitIntelCredit({
    creditCost,
    routeLabel,
    endpoint,
    meta: {
      agent: agentConst,
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

  const defaultNextSteps = isSales
    ? translate("agents.salesAgentNextSteps", lang)
    : translate("agents.deepResearcherNextSteps", lang);

  if (!String(plan.nextStepsMessage || "").trim()) {
    plan.nextStepsMessage = defaultNextSteps;
  }

  const extraTextParts = isSales
    ? [plan.goalStrategy ? `${lang === "es" ? "Estrategia de meta" : "Goal strategy"}\n\n${plan.goalStrategy}` : ""]
    : [
      plan.studyScope ? `${lang === "es" ? "Alcance" : "Scope"}\n\n${plan.studyScope}` : "",
      Array.isArray(plan.openQuestions) && plan.openQuestions.length
        ? `${lang === "es" ? "Preguntas abiertas" : "Open questions"}\n\n${plan.openQuestions.map((q) => `• ${q}`).join("\n")}`
        : "",
    ].filter(Boolean);

  const applied = applyAgentPlanOutputToDoc(targetDocId, plan, reportKind, extraTextParts);
  if (!applied) {
    return {
      status: "error",
      code: "apply_failed",
      message: translate(
        isSales ? "agents.errors.sales_agent_apply" : "agents.errors.deep_researcher_apply",
        lang,
      ),
    };
  }

  const brandName = (brandContext?.brand || brandContext?.name || "").trim();
  const successKey = isSales ? "agents.salesAgentSuccess" : "agents.deepResearcherSuccess";
  const nextSteps = (plan.nextStepsMessage || "").trim() || defaultNextSteps;

  return {
    status: "success",
    mode: "document_plan",
    docId: targetDocId,
    wireOutputDocCanvasNodeId,
    brandName,
    plan,
    userFacingMessage: [
      translate(successKey, lang, {
        brand: brandName || (lang === "es" ? "tu plan" : "your plan"),
        count: String(plan.items?.length || 0),
      }),
      nextSteps,
    ].join(" "),
  };
}

export function runSalesAgent(params) {
  return runPlanAgentClient(AGENT_SALES_AGENT, params);
}

export function runDeepResearcher(params) {
  return runPlanAgentClient(AGENT_DEEP_RESEARCHER, params);
}
