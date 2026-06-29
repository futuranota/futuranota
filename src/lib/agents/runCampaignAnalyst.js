import { fetchCampaignDetection } from "../fetchCampaignDetection.js";
import { fetchCampaignAnalystReport } from "../fetchCampaignAnalyst.js";
import { fetchOrchestratorRoute } from "../fetchOrchestratorRoute.js";
import { checkIntelCreditGate } from "../intelPlanGate.js";
import { debitIntelCredit } from "../debitIntelCredit.js";
import { translate } from "../../i18n/useI18n.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { DEFAULT_RANGE_DAYS } from "../campaignWindow.js";
import { TEMPLATE_KIND_CAMPAIGN } from "../templateDoc.js";
import { resolveAgentGraph, isOrchestratorTargetDoc } from "./resolveAgentGraph.js";
import { buildCanvasContextSummary } from "./buildCanvasContextSummary.js";
import { applyAnalystReportToDoc } from "./applyAnalystReportToDoc.js";
import { resolveLaunchRadarObjectId } from "./resolveLaunchRadarObjectId.js";
import { getAgentRunCost } from "./agentCreditCosts.js";
import { AGENT_CAMPAIGN_ANALYST } from "./registry.js";
import { isDeliverableAnalystReport, slimDetectionForAnalyst } from "./analystReportQuality.js";

/**
 * @typedef {Object} CampaignAnalystSuccess
 * @property {"success"} status
 * @property {string} docId
 * @property {string} brandName
 * @property {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @property {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} analystReport
 * @property {string} [userFacingMessage]
 */

/**
 * @typedef {Object} CampaignAnalystError
 * @property {"error"} status
 * @property {string} message
 * @property {"no_brand"|"no_target_doc"|"invalid_target_doc"|"gate"|"api"|"off_topic"} [code]
 */

/**
 * @param {string} errorCode
 * @param {'en' | 'es'} locale
 */
function analystErrorMessage(errorCode, locale) {
  const key = errorCode ? `agents.errors.${errorCode}` : "agents.errors.generic";
  const translated = translate(key, locale);
  return translated !== key ? translated : "";
}

/**
 * @param {string} brandName
 * @param {string} userQuery
 * @param {string[]} userMessages
 * @param {'en' | 'es'} lang
 */
function buildIntelUserQuery(brandName, userQuery, userMessages, lang) {
  const parts = [
    ...(userMessages || []),
    userQuery,
  ].map((s) => (s || "").trim()).filter(Boolean);

  const unique = [...new Set(parts)];
  if (unique.length) return unique.join(" · ").slice(0, 240);

  return lang === "es"
    ? `qué hay de nuevo en ${brandName}, próximos lanzamientos futuros (aún no ocurridos) y noticias recientes`
    : `what's new with ${brandName}, upcoming future launches (not yet happened) and recent news`;
}

/**
 * @param {string} brandName
 * @param {string} userQuery
 * @param {'en' | 'es'} lang
 */
function buildFallbackBrief(brandName, userQuery, lang) {
  return lang === "es"
    ? `Investigá ${brandName} en ventana de ${DEFAULT_RANGE_DAYS} días. Priorizá lanzamientos cuya fecha sea posterior a hoy. Contexto: "${userQuery}".`
    : `Research ${brandName} over ${DEFAULT_RANGE_DAYS} days. Prioritize launches dated after today. Context: "${userQuery}".`;
}

/**
 * Campaign Analyst node: intel-first research + write report into connected doc.
 * Hidden orchestrator runs before scan when available.
 * @param {object} params
 * @param {string} params.agentCanvasNodeId
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.connections
 * @param {Record<string, object>} params.docsById
 * @param {Record<string, object>} params.objectsById
 * @param {Record<string, object>} [params.nodeEntitiesById]
 * @param {string | null} [params.selectedObjectId]
 * @param {'en' | 'es'} [params.locale]
 * @param {string} [params.analystBrief]
 * @param {number} [params.rangeDays]
 * @returns {Promise<CampaignAnalystSuccess | CampaignAnalystError>}
 */
export async function runCampaignAnalyst({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  selectedObjectId = null,
  locale = "en",
  analystBrief = "",
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

  const { brandName, targetDocId: graphTargetDocId, targetDoc: graphTargetDoc } = graph;

  if (!brandName) {
    return { status: "error", code: "no_brand", message: analystErrorMessage("no_brand", lang) };
  }

  const objectInput = (graph.inputs || []).find(
    (n) => n && (n.canvasKind === "object" || n.dataType === "object"),
  );
  const parentObjectId = graph.targetObjectId
    || objectInput?.objectId
    || selectedObjectId
    || resolveLaunchRadarObjectId(objectsById, brandName, null);

  let targetDocId = graphTargetDocId;
  let targetDoc = graphTargetDoc;
  let wireOutputDocCanvasNodeId = null;

  if (targetDocId && !isOrchestratorTargetDoc(targetDoc)) {
    targetDocId = null;
    targetDoc = null;
  }

  if (!targetDocId) {
    const outputDocNode = (graph.outputs || []).find(
      (n) => n && (n.canvasKind === "document" || n.dataType === "document"),
    );
    if (outputDocNode?.id) {
      wireOutputDocCanvasNodeId = outputDocNode.id;
    }

    targetDocId = useDocsStore.getState().addDoc(
      lang === "es" ? `Campaña · ${brandName}` : `Campaign · ${brandName}`,
      parentObjectId,
      [],
      ["campaign", "intel"],
      "",
      null,
      null,
      { docKind: "template", templateKind: TEMPLATE_KIND_CAMPAIGN },
    );
    targetDoc = useDocsStore.getState().getDoc(targetDocId);
  }

  const agentRunCost = getAgentRunCost(AGENT_CAMPAIGN_ANALYST);

  const planGate = await checkIntelCreditGate({
    creditCost: agentRunCost.creditCost,
    tokenCost: agentRunCost.tokenCost,
  });
  if (!planGate.ok) {
    return {
      status: "error",
      code: "gate",
      message: analystErrorMessage(planGate.code, lang),
    };
  }

  const canvasContext = buildCanvasContextSummary({
    agentCanvasNodeId,
    graph,
    docsById,
    objectsById,
    nodeEntitiesById,
  });

  let plan = null;
  const hasDirectContext = Boolean(
    brandName
    && targetDocId
    && (graph.userQuery?.trim() || canvasContext.userMessages?.length),
  );

  if (!hasDirectContext) {
    try {
      plan = await fetchOrchestratorRoute({ locale: lang, canvasContext });
    } catch {
      plan = null;
    }
  } else {
    plan = {
      intent: "delegate_campaign_analysis",
      analystBrief: "",
      ignoredTopics: [],
    };
  }

  if (plan?.intent === "ignore_off_topic") {
    return {
      status: "error",
      code: "off_topic",
      message: plan.userFacingMessage || analystErrorMessage("off_topic", lang),
    };
  }

  const intelUserQuery = buildIntelUserQuery(
    brandName,
    graph.userQuery,
    canvasContext.userMessages,
    lang,
  );

  const brief = (plan?.analystBrief || analystBrief).trim()
    || buildFallbackBrief(brandName, intelUserQuery, lang);

  try {
    const detection = await fetchCampaignDetection({
      brandName,
      rangeDays,
      mode: "deep",
      userQuery: intelUserQuery,
      analystBrief: brief,
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
        message: detection.error || detection.overview || analystErrorMessage("api", lang),
      };
    }

    const analystReportRaw = await fetchCampaignAnalystReport({
      locale: lang,
      brandName,
      analystBrief: brief,
      primaryQuestion: intelUserQuery,
      detection: slimDetectionForAnalyst(detection),
      ignoredTopics: plan?.ignoredTopics || [],
    });

    const analystReport = { ...analystReportRaw };
    delete analystReport.marketingGuide;

    if (!isDeliverableAnalystReport(analystReport, detection)) {
      return {
        status: "error",
        code: "api",
        message: lang === "es"
          ? "No se pudo generar un informe con datos suficientes. No se descontaron créditos."
          : "Could not generate a report with enough data. No credits were charged.",
      };
    }

    targetDoc = useDocsStore.getState().getDoc(targetDocId) || targetDoc;
    if (!targetDoc) {
      return { status: "error", code: "api", message: analystErrorMessage("api", lang) };
    }

    const wroteDoc = applyAnalystReportToDoc(
      targetDocId,
      analystReport,
      detection,
      brandName,
      lang,
    );

    if (!wroteDoc) {
      return { status: "error", code: "api", message: analystErrorMessage("api", lang) };
    }

    const targetObjectId = resolveLaunchRadarObjectId(
      useObjectsStore.getState().objects,
      brandName,
      targetDoc?.parentObjectId || graph.targetObjectId,
    );
    if (targetObjectId) {
      useUIStateStore.getState().setSelectedObjectId(targetObjectId);
      useUIStateStore.getState().setFilterObjectId(targetObjectId);
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
        message: analystErrorMessage("gate_tokens", lang),
      };
    }

    const preview = (analystReport?.openingBrief || analystReport?.whatsNew || "").slice(0, 80);

    const launchRadarHint = lang === "es"
      ? " · Abrí Launch Radar en Intel para cargar los datos"
      : " · Open Launch Radar in Intel to load the data";

    return {
      status: "success",
      docId: targetDocId,
      brandName,
      detection,
      analystReport,
      wireOutputDocCanvasNodeId,
      userFacingMessage: lang === "es"
        ? `Informe del analista · ${brandName}${launchRadarHint}${preview ? ` · ${preview}${((analystReport?.openingBrief || analystReport?.whatsNew)?.length || 0) > 80 ? "…" : ""}` : ""}`
        : `Analyst report · ${brandName}${launchRadarHint}${preview ? ` · ${preview}${((analystReport?.openingBrief || analystReport?.whatsNew)?.length || 0) > 80 ? "…" : ""}` : ""}`,
    };
  } catch (err) {
    return {
      status: "error",
      code: "api",
      message: err instanceof Error ? err.message : analystErrorMessage("api", lang),
    };
  }
}
