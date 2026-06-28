import { completeJson } from "../llmJson.js";
import { buildOrchestratorRouterPrompt, normalizeOrchestratorLocale } from "./orchestratorContext.js";

const VALID_INTENTS = new Set([
  "delegate_campaign_analysis",
  "ignore_off_topic",
  "error",
  // legacy aliases
  "fill_campaign_doc",
  "research_only",
  "answer_queries",
]);

/**
 * @param {string} intent
 * @returns {string}
 */
function normalizeIntent(intent) {
  if (intent === "fill_campaign_doc" || intent === "research_only") {
    return "delegate_campaign_analysis";
  }
  return VALID_INTENTS.has(intent) ? intent : "delegate_campaign_analysis";
}

/**
 * @param {object} plan
 * @param {object} canvasContext
 * @param {'en' | 'es'} locale
 * @returns {object}
 */
function normalizeOrchestratorPlan(plan, canvasContext, locale) {
  const lang = normalizeOrchestratorLocale(locale);
  const brandName = typeof plan.brandName === "string" && plan.brandName.trim()
    ? plan.brandName.trim()
    : (canvasContext.brandName || null);
  const targetDocId = typeof plan.targetDocId === "string" && plan.targetDocId.trim()
    ? plan.targetDocId.trim()
    : (canvasContext.targetDocId || null);

  const intent = normalizeIntent(plan.intent);
  const analystBrief = typeof plan.analystBrief === "string" ? plan.analystBrief.trim() : "";
  const routingNote = typeof plan.routingNote === "string" ? plan.routingNote.trim() : "";
  const userFacingMessage = typeof plan.userFacingMessage === "string"
    ? plan.userFacingMessage.trim()
    : "";
  const ignoredTopics = Array.isArray(plan.ignoredTopics)
    ? plan.ignoredTopics.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
    : [];
  const errorCode = typeof plan.errorCode === "string" ? plan.errorCode : null;

  const delegateTo = typeof plan.delegateTo === "string" && plan.delegateTo.trim()
    ? plan.delegateTo.trim()
    : (intent === "delegate_campaign_analysis" ? "campaign-analyst" : null);

  let resolvedBrief = analystBrief;
  if (!resolvedBrief && brandName && intent === "delegate_campaign_analysis") {
    resolvedBrief = lang === "es"
      ? `Analizá campaña de ${brandName}. Educá sobre los 5 paneles del dashboard con datos del detection. Enfatizá qué hay de nuevo vs versión anterior si hay evidencia.`
      : `Analyze ${brandName} campaign signals. Educate on all 5 dashboard panels using detection data. Emphasize what's new vs previous version when evidence exists.`;
  }

  return {
    intent,
    brandName,
    targetDocId,
    analystBrief: resolvedBrief,
    delegateTo,
    ignoredTopics,
    routingNote,
    userFacingMessage,
    errorCode,
    source: "groq",
  };
}

/**
 * Deterministic fallback when Groq is unavailable.
 * @param {object} canvasContext
 * @param {'en' | 'es'} locale
 */
export function buildFallbackOrchestratorPlan(canvasContext, locale = "en") {
  const lang = normalizeOrchestratorLocale(locale);
  const { brandName, targetDocId, hasValidTargetDoc, userQuery } = canvasContext;

  if (!brandName) {
    return {
      intent: "error",
      brandName: null,
      targetDocId: null,
      analystBrief: "",
      delegateTo: null,
      ignoredTopics: [],
      routingNote: "",
      errorCode: "no_brand",
      userFacingMessage: lang === "es"
        ? "Conectá un objeto compañía al Orquestador o definí la marca en el corpus."
        : "Connect a company object to the Orchestrator or set a brand on your corpus.",
      source: "fallback",
    };
  }

  if (!targetDocId) {
    return {
      intent: "error",
      brandName,
      targetDocId: null,
      analystBrief: "",
      delegateTo: null,
      ignoredTopics: [],
      routingNote: "",
      errorCode: "no_target_doc",
      userFacingMessage: lang === "es"
        ? "Conectá un documento campaña a la salida del Orquestador."
        : "Connect a campaign document to the Orchestrator output port.",
      source: "fallback",
    };
  }

  if (!hasValidTargetDoc) {
    return {
      intent: "error",
      brandName,
      targetDocId,
      analystBrief: "",
      delegateTo: null,
      ignoredTopics: [],
      routingNote: "",
      errorCode: "invalid_target_doc",
      userFacingMessage: lang === "es"
        ? "El documento de salida debe ser campaña o content."
        : "The output document must be a campaign or content doc.",
      source: "fallback",
    };
  }

  const queryHint = typeof userQuery === "string" && userQuery.trim()
    ? userQuery.trim()
    : brandName;

  return {
    intent: "delegate_campaign_analysis",
    brandName,
    targetDocId,
    analystBrief: lang === "es"
      ? `Delegación al Analista: investigar ${brandName}. Contexto usuario: "${queryHint}". Escribir informe educativo en el doc campaña (5 paneles + analogía clima). Ignorar temas off-topic.`
      : `Delegate to Analyst: research ${brandName}. User context: "${queryHint}". Write educational report into campaign doc (5 panels + weather analogy). Ignore off-topic threads.`,
    delegateTo: "campaign-analyst",
    ignoredTopics: [],
    routingNote: lang === "es"
      ? "Fallback sin Groq: pipeline data + analista determinístico."
      : "Groq unavailable fallback: data pipeline + deterministic analyst.",
    userFacingMessage: lang === "es"
      ? `Analizando campaña de ${brandName} y escribiendo el documento conectado.`
      : `Analyzing ${brandName} campaign and writing the connected document.`,
    errorCode: null,
    source: "fallback",
  };
}

/**
 * @param {object} params
 * @param {'en' | 'es'} [params.locale]
 * @param {object} params.canvasContext
 */
export async function routeOrchestratorPlan({ locale = "en", canvasContext }) {
  const lang = normalizeOrchestratorLocale(locale);
  const fallback = buildFallbackOrchestratorPlan(canvasContext, lang);

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  const { system, user } = buildOrchestratorRouterPrompt(lang, canvasContext);
  const llm = await completeJson(user, { system });

  if (!llm?.data || typeof llm.data !== "object") {
    return { ...fallback, source: "fallback-llm-empty" };
  }

  const normalized = normalizeOrchestratorPlan(llm.data, canvasContext, lang);

  if (normalized.intent === "error" && normalized.errorCode) {
    if (!normalized.userFacingMessage) {
      const fb = buildFallbackOrchestratorPlan(
        { ...canvasContext, brandName: normalized.brandName, targetDocId: normalized.targetDocId },
        lang,
      );
      normalized.userFacingMessage = fb.userFacingMessage;
    }
    return normalized;
  }

  if (!normalized.analystBrief && normalized.intent === "delegate_campaign_analysis") {
    normalized.analystBrief = fallback.analystBrief;
  }

  if (!normalized.userFacingMessage) {
    normalized.userFacingMessage = fallback.userFacingMessage;
  }

  if (!normalized.brandName && canvasContext.brandName) {
    normalized.brandName = canvasContext.brandName;
  }
  if (!normalized.targetDocId && canvasContext.targetDocId) {
    normalized.targetDocId = canvasContext.targetDocId;
  }

  return normalized;
}
