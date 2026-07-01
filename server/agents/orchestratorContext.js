import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.join(__dirname, "../../content/agents");

/** @type {Record<string, string | null>} */
const cachedSystemByLocale = {};

/**
 * @param {'en' | 'es'} [locale]
 * @returns {'en' | 'es'}
 */
export function normalizeOrchestratorLocale(locale) {
  return locale === "es" ? "es" : "en";
}

/**
 * @param {'en' | 'es'} [locale]
 * @returns {string}
 */
export function loadOrchestratorSystemContext(locale = "en") {
  const lang = normalizeOrchestratorLocale(locale);
  if (cachedSystemByLocale[lang] !== undefined) {
    return cachedSystemByLocale[lang] || "";
  }
  const filePath = path.join(AGENTS_DIR, `orquestador-guardian.${lang}.md`);
  try {
    cachedSystemByLocale[lang] = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    cachedSystemByLocale[lang] = "";
  }
  return cachedSystemByLocale[lang] || "";
}

const ROUTING_BRIDGE = {
  en: `
ROUTING TASK — output JSON only (no markdown):
{
  "intent": "delegate_campaign_analysis" | "ignore_off_topic" | "error",
  "brandName": string | null,
  "targetDocId": string | null,
  "analystBrief": string,
  "delegateTo": "campaign-analyst" | null,
  "ignoredTopics": string[],
  "routingNote": string,
  "userFacingMessage": string,
  "errorCode": "no_brand" | "no_target_doc" | "invalid_target_doc" | null
}
Rules:
- You NEVER write analysis content — only analystBrief instructions for the Campaign Analyst sub-agent.
- analystBrief, routingNote, userFacingMessage MUST be in English.
- Filter off-topic noise into ignoredTopics (e.g. grapes when brand is Tesla).
- When canvas has valid campaign doc output + brand → intent "delegate_campaign_analysis", delegateTo "campaign-analyst".
- When primaryAgentInstruction is set in canvas context, use it as the user task (ignore other text outside the /agent cell).
- If the request is wholly off-topic → intent "ignore_off_topic".
- errorCode only when intent is "error".
`.trim(),
  es: `
TAREA DE ROUTING — responde solo JSON (sin markdown):
{
  "intent": "delegate_campaign_analysis" | "ignore_off_topic" | "error",
  "brandName": string | null,
  "targetDocId": string | null,
  "analystBrief": string,
  "delegateTo": "campaign-analyst" | null,
  "ignoredTopics": string[],
  "routingNote": string,
  "userFacingMessage": string,
  "errorCode": "no_brand" | "no_target_doc" | "invalid_target_doc" | null
}
Reglas:
- NUNCA escribas contenido de análisis — solo instrucciones analystBrief para el sub-agente Analista.
- analystBrief, routingNote, userFacingMessage DEBEN estar en español.
- Filtra ruido off-topic en ignoredTopics (ej. uvas cuando la marca es Tesla).
- Si el canvas tiene doc campaña válido en salida + marca → intent "delegate_campaign_analysis", delegateTo "campaign-analyst".
- Si primaryAgentInstruction está en el contexto, úsala como tarea del usuario (ignora texto fuera de la celda /agent).
- Si la petición es totalmente off-topic → intent "ignore_off_topic".
- errorCode solo cuando intent es "error".
`.trim(),
};

/**
 * @param {'en' | 'es'} locale
 * @param {object} canvasContext
 */
export function buildOrchestratorRouterPrompt(locale, canvasContext) {
  const lang = normalizeOrchestratorLocale(locale);
  const systemContext = loadOrchestratorSystemContext(lang);
  const bridge = ROUTING_BRIDGE[lang];
  const contextJson = JSON.stringify(canvasContext, null, 2);

  const taskHeader = lang === "es"
    ? "CONTEXTO DEL CANVAS (JSON):"
    : "CANVAS CONTEXT (JSON):";

  return {
    system: `${systemContext}\n\n---\n\n${bridge}`,
    user: `${taskHeader}\n${contextJson}\n\nDecide intent and analystBrief. JSON only.`,
  };
}

/** Clears in-memory cache (tests). */
export function clearOrchestratorContextCache() {
  for (const key of Object.keys(cachedSystemByLocale)) {
    delete cachedSystemByLocale[key];
  }
}
