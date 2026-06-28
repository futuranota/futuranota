import { fetchCampaignDetection } from "../fetchCampaignDetection.js";
import { fetchOrchestratorRoute } from "../fetchOrchestratorRoute.js";
import { fetchCampaignAnalystReport } from "../fetchCampaignAnalyst.js";
import { checkIntelCreditGate } from "../intelPlanGate.js";
import { debitIntelCredit } from "../debitIntelCredit.js";
import { translate } from "../../i18n/useI18n.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { DEFAULT_RANGE_DAYS } from "../campaignWindow.js";
import { resolveAgentGraph, isOrchestratorTargetDoc } from "./resolveAgentGraph.js";
import { buildCanvasContextSummary } from "./buildCanvasContextSummary.js";
import { applyAnalystReportToDoc } from "./applyAnalystReportToDoc.js";
import { mapDetectionToCadence } from "./mapDetectionToCadence.js";
import { getAgentRunCost } from "./agentCreditCosts.js";
import { AGENT_ORCHESTRATOR } from "./registry.js";

/**
 * @typedef {Object} OrchestratorSuccess
 * @property {"success"} status
 * @property {string} docId
 * @property {string} brandName
 * @property {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @property {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} [analystReport]
 * @property {string} [userFacingMessage]
 * @property {import("../fetchOrchestratorRoute.js").OrchestratorPlan} [plan]
 */

/**
 * @typedef {Object} OrchestratorError
 * @property {"error"} status
 * @property {string} message
 * @property {"no_brand"|"no_target_doc"|"invalid_target_doc"|"gate"|"api"|"plan"|"off_topic"} [code]
 */

/**
 * @param {string} errorCode
 * @param {'en' | 'es'} locale
 * @param {string} [fallbackMessage]
 */
function orchestratorErrorMessage(errorCode, locale, fallbackMessage = "") {
  if (fallbackMessage) return fallbackMessage;
  const key = errorCode ? `agents.errors.${errorCode}` : "agents.errors.generic";
  const translated = translate(key, locale);
  return translated !== key ? translated : fallbackMessage;
}

/**
 * @param {object} params
 * @param {string} params.agentCanvasNodeId
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.connections
 * @param {Record<string, object>} params.docsById
 * @param {Record<string, object>} params.objectsById
 * @param {Record<string, object>} [params.nodeEntitiesById]
 * @param {string | null} [params.selectedObjectId]
 * @param {'en' | 'es'} [params.locale]
 * @param {number} [params.rangeDays]
 * @returns {Promise<OrchestratorSuccess | OrchestratorError>}
 */
export async function runOrchestrator({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  selectedObjectId = null,
  locale = "en",
  rangeDays = DEFAULT_RANGE_DAYS,
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

  const canvasContext = buildCanvasContextSummary({
    agentCanvasNodeId,
    graph,
    docsById,
    objectsById,
    nodeEntitiesById,
  });

  let plan;
  try {
    plan = await fetchOrchestratorRoute({ locale: lang, canvasContext });
  } catch {
    plan = null;
  }

  if (!plan) {
    if (!graph.brandName) {
      return {
        status: "error",
        code: "no_brand",
        message: orchestratorErrorMessage("no_brand", lang),
      };
    }
    if (!graph.targetDocId) {
      return {
        status: "error",
        code: "no_target_doc",
        message: orchestratorErrorMessage("no_target_doc", lang),
      };
    }
    if (!isOrchestratorTargetDoc(graph.targetDoc)) {
      return {
        status: "error",
        code: "invalid_target_doc",
        message: orchestratorErrorMessage("invalid_target_doc", lang),
      };
    }
  }

  if (plan?.intent === "error") {
    const code = plan.errorCode || "plan";
    return {
      status: "error",
      code: code === "no_brand" || code === "no_target_doc" || code === "invalid_target_doc"
        ? code
        : "plan",
      message: plan.userFacingMessage
        || orchestratorErrorMessage(code, lang),
    };
  }

  if (plan?.intent === "ignore_off_topic") {
    return {
      status: "error",
      code: "off_topic",
      message: plan.userFacingMessage
        || orchestratorErrorMessage("off_topic", lang),
    };
  }

  const brandName = plan?.brandName || graph.brandName;
  const targetDocId = plan?.targetDocId || graph.targetDocId;
  const targetDoc = targetDocId ? docsById[targetDocId] : graph.targetDoc;

  if (!brandName) {
    return {
      status: "error",
      code: "no_brand",
      message: plan?.userFacingMessage || orchestratorErrorMessage("no_brand", lang),
    };
  }

  if (!targetDocId) {
    return {
      status: "error",
      code: "no_target_doc",
      message: plan?.userFacingMessage || orchestratorErrorMessage("no_target_doc", lang),
    };
  }

  if (!isOrchestratorTargetDoc(targetDoc)) {
    return {
      status: "error",
      code: "invalid_target_doc",
      message: plan?.userFacingMessage || orchestratorErrorMessage("invalid_target_doc", lang),
    };
  }

  const agentRunCost = getAgentRunCost(AGENT_ORCHESTRATOR);

  const planGate = await checkIntelCreditGate({ tokenCost: agentRunCost.tokenCost * agentRunCost.creditCost });
  if (!planGate.ok) {
    return {
      status: "error",
      code: "gate",
      message: orchestratorErrorMessage(planGate.code, lang),
    };
  }

  try {
    const detection = await fetchCampaignDetection({
      brandName,
      rangeDays,
      mode: "deep",
      userQuery: graph.userQuery.trim(),
      analystBrief: plan?.analystBrief || "",
      locale: lang,
    });

    const hasReport = Boolean(
      detection.deepReport?.trim()
      || detection.overview?.trim()
      || (detection.citations?.length > 0),
    );

    if (detection.error && detection.noData && !hasReport) {
      return {
        status: "error",
        code: "api",
        message: detection.error || detection.overview || orchestratorErrorMessage("api", lang),
      };
    }

    const analystBrief = plan?.analystBrief || (lang === "es"
      ? `Analizá ${brandName} y escribí el informe educativo en el doc campaña.`
      : `Analyze ${brandName} and write the educational report into the campaign doc.`);

    let analystReport;
    try {
      analystReport = await fetchCampaignAnalystReport({
        locale: lang,
        brandName,
        analystBrief,
        primaryQuestion: graph.userQuery.trim(),
        detection,
        ignoredTopics: plan?.ignoredTopics || [],
      });
    } catch (err) {
      return {
        status: "error",
        code: "api",
        message: err instanceof Error ? err.message : orchestratorErrorMessage("api", lang),
      };
    }

    if (!analystReport) {
      return {
        status: "error",
        code: "api",
        message: orchestratorErrorMessage("api", lang),
      };
    }

    const wroteDoc = applyAnalystReportToDoc(
      targetDocId,
      analystReport,
      detection,
      brandName,
      lang,
    );

    if (!wroteDoc) {
      return {
        status: "error",
        code: "api",
        message: orchestratorErrorMessage("api", lang),
      };
    }

    const targetObjectId = targetDoc?.parentObjectId || graph.targetObjectId;
    if (detection && targetObjectId) {
      const object = useObjectsStore.getState().objects[targetObjectId];
      const cadence = mapDetectionToCadence(detection, brandName, object?.cadence || {});
      useObjectsStore.getState().updateObject(targetObjectId, { cadence });
    }

    const debit = await debitIntelCredit({
      creditCost: agentRunCost.creditCost,
      tokenCost: agentRunCost.tokenCost,
      routeLabel: agentRunCost.routeLabel,
      endpoint: agentRunCost.endpoint,
      meta: { brandName, docId: targetDocId },
    });
    if (!debit.ok) {
      return {
        status: "error",
        code: "gate",
        message: orchestratorErrorMessage("gate_tokens", lang),
      };
    }

    return {
      status: "success",
      docId: targetDocId,
      brandName,
      detection,
      analystReport,
      userFacingMessage: plan?.userFacingMessage || "",
      plan: plan || undefined,
    };
  } catch (err) {
    return {
      status: "error",
      code: "api",
      message: err instanceof Error ? err.message : orchestratorErrorMessage("api", lang),
    };
  }
}
