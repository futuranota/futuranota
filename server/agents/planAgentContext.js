import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.join(__dirname, "../../content/agents");

/**
 * @param {string} agentSlug e.g. "sales-agent"
 * @param {'en' | 'es'} locale
 */
function loadAgentSystemContext(agentSlug, locale = "en") {
  const lang = locale === "es" ? "es" : "en";
  const filePath = path.join(AGENTS_DIR, `${agentSlug}.${lang}.md`);
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

/**
 * @param {'en' | 'es'} locale
 */
export function normalizePlanAgentLocale(locale) {
  return locale === "es" ? "es" : "en";
}

const SALES_OUTPUT_BRIDGE = {
  en: `
OUTPUT — valid JSON only. All text in English.

{
  "listTitle": string,
  "items": [{ "text": string }],
  "writtenContent": { "headline": string, "body": string },
  "goalStrategy": string,
  "nextStepsMessage": string
}

Rules:
- items[]: funnel stages with actions + metrics per stage.
- writtenContent.body: full funnel narrative (paragraphs separated by blank lines).
- goalStrategy: goal adviser — north-star metric, milestones, red flags, discovery questions.
- nextStepsMessage: pick one stage → macro node in this doc → schedule execution.
`.trim(),
  es: `
SALIDA — solo JSON válido. Texto en español.

{
  "listTitle": string,
  "items": [{ "text": string }],
  "writtenContent": { "headline": string, "body": string },
  "goalStrategy": string,
  "nextStepsMessage": string
}

Reglas:
- items[]: etapas del funnel con acciones + métricas.
- writtenContent.body: narrativa del funnel (párrafos con línea en blanco).
- goalStrategy: adviser de meta — métrica norte, hitos, señales rojas, preguntas de descubrimiento.
- nextStepsMessage: elegir una etapa → macronodo en este doc → schedule.
`.trim(),
};

const RESEARCHER_OUTPUT_BRIDGE = {
  en: `
OUTPUT — valid JSON only. All text in English.

{
  "listTitle": string,
  "items": [{ "text": string }],
  "writtenContent": { "headline": string, "body": string },
  "studyScope": string,
  "openQuestions": [string],
  "nextStepsMessage": string
}

Rules:
- items[]: study phases with concepts + questions (no conclusions).
- writtenContent.body: learning path overview without deciding for the user.
- studyScope: 2–3 sentence boundary statement.
- openQuestions: 3–6 questions user should answer after studying.
- nextStepsMessage: pick one phase → macro node in this doc.
`.trim(),
  es: `
SALIDA — solo JSON válido. Texto en español.

{
  "listTitle": string,
  "items": [{ "text": string }],
  "writtenContent": { "headline": string, "body": string },
  "studyScope": string,
  "openQuestions": [string],
  "nextStepsMessage": string
}

Reglas:
- items[]: fases de estudio con conceptos + preguntas (sin conclusiones).
- writtenContent.body: panorama del camino de aprendizaje sin decidir por el usuario.
- studyScope: alcance en 2–3 oraciones.
- openQuestions: 3–6 preguntas que debe poder responder tras estudiar.
- nextStepsMessage: elegir una fase → macronodo en este doc.
`.trim(),
};

/**
 * @param {'sales-agent' | 'deep-researcher'} agentSlug
 * @param {'en' | 'es'} locale
 * @param {object} params
 */
export function buildPlanAgentPrompt(agentSlug, locale, {
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
}) {
  const lang = normalizePlanAgentLocale(locale);
  const brand = String(brandContext?.brand || brandContext?.name || "the brand").trim() || "the brand";
  const systemContext = loadAgentSystemContext(agentSlug, lang).replace(/{brand}/g, brand);
  const bridge = agentSlug === "sales-agent"
    ? SALES_OUTPUT_BRIDGE[lang]
    : RESEARCHER_OUTPUT_BRIDGE[lang];

  const payload = {
    locale: lang,
    instruction: String(instruction || "").trim(),
    brandContext: {
      name: String(brandContext?.name || "").trim(),
      brand,
      description: String(brandContext?.description || "").trim().slice(0, 1200),
    },
    knowledgeContext: String(knowledgeContext || "").trim().slice(0, 8000),
    hasKnowledge: Boolean(String(knowledgeContext || "").trim()),
    wiredInputs: Array.isArray(wiredInputs) ? wiredInputs.slice(0, 12) : [],
  };

  const instructionLine = lang === "es"
    ? "Generá el plan según la instrucción y el contexto cableado.\nResponde SOLO JSON según OUTPUT_BRIDGE."
    : "Generate the plan per instruction and wired context.\nRespond with JSON only per OUTPUT_BRIDGE.";

  const header = lang === "es" ? "CONTEXTO (JSON):" : "CONTEXT (JSON):";

  return {
    system: `${systemContext}\n\n---\n\n${bridge}`,
    user: `${instructionLine}\n\n${header}\n${JSON.stringify(payload, null, 2)}`,
  };
}
