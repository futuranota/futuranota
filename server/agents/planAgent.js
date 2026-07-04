import { completeJson } from "../llmJson.js";
import { buildPlanAgentPrompt, normalizePlanAgentLocale } from "./planAgentContext.js";

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} raw
 * @param {'sales-agent' | 'deep-researcher'} agentSlug
 * @param {'en' | 'es'} lang
 */
export function normalizePlanAgentOutput(raw, agentSlug, lang) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(obj.items)
    ? obj.items
      .map((item) => ({
        text: asString(item && typeof item === "object" ? item.text : item),
      }))
      .filter((item) => item.text)
    : [];

  const written = obj.writtenContent && typeof obj.writtenContent === "object"
    ? obj.writtenContent
    : {};

  const base = {
    listTitle: asString(obj.listTitle),
    items,
    writtenContent: {
      headline: asString(written.headline),
      body: asString(written.body),
    },
    nextStepsMessage: asString(obj.nextStepsMessage),
    source: asString(obj.source) || "groq",
  };

  if (agentSlug === "sales-agent") {
    return {
      ...base,
      goalStrategy: asString(obj.goalStrategy),
    };
  }

  const openQuestions = Array.isArray(obj.openQuestions)
    ? obj.openQuestions.map((q) => asString(q)).filter(Boolean)
    : [];

  return {
    ...base,
    studyScope: asString(obj.studyScope),
    openQuestions,
  };
}

function outputHasContent(plan, agentSlug) {
  if (plan.writtenContent?.body?.trim()) return true;
  if (plan.listTitle && plan.items.length > 0) return true;
  if (agentSlug === "sales-agent" && plan.goalStrategy) return true;
  if (agentSlug === "deep-researcher" && plan.studyScope) return true;
  return false;
}

function buildFallbackBody(lang, brand, task, items) {
  const lines = items.map((item, i) => `${i + 1}. ${item.text}`);
  return [
    lang === "es" ? `Plan para ${brand}:` : `Plan for ${brand}:`,
    "",
    ...lines,
  ].join("\n");
}

export function buildFallbackPlanAgentOutput(agentSlug, lang, instruction, brandContext = {}) {
  const brand = asString(brandContext?.brand || brandContext?.name)
    || (lang === "es" ? "tu marca" : "your brand");
  const task = asString(instruction) || (lang === "es" ? "tu objetivo" : "your goal");

  const items = lang === "es"
    ? [
      { text: `Paso 1 — Definir contexto para: ${task}` },
      { text: `Paso 2 — Acciones concretas para ${brand}` },
      { text: `Paso 3 — Medir resultados y ajustar` },
    ]
    : [
      { text: `Step 1 — Define context for: ${task}` },
      { text: `Step 2 — Concrete actions for ${brand}` },
      { text: `Step 3 — Measure results and adjust` },
    ];

  const writtenContent = {
    headline: lang === "es" ? `Plan · ${task.slice(0, 60)}` : `Plan · ${task.slice(0, 60)}`,
    body: buildFallbackBody(lang, brand, task, items),
  };

  if (agentSlug === "sales-agent") {
    return {
      listTitle: lang === "es" ? `Funnel de ventas · ${task.slice(0, 60)}` : `Sales funnel · ${task.slice(0, 60)}`,
      items,
      writtenContent,
      goalStrategy: lang === "es"
        ? "Definí tu meta de revenue y cuántos leads necesitás por semana. Medí respuestas, calls y cierres."
        : "Define your revenue goal and how many leads you need per week. Track replies, calls, and closes.",
      nextStepsMessage: lang === "es"
        ? "Elegí la etapa 1, creá un macronodo con ese título en este documento y profundizá scripts y checklist ahí."
        : "Pick stage 1, create a macro node with that title in this document, and deepen scripts and checklists there.",
      source: "fallback",
    };
  }

  return {
    listTitle: lang === "es" ? `Mapa de estudio · ${task.slice(0, 60)}` : `Study map · ${task.slice(0, 60)}`,
    items,
    writtenContent,
    studyScope: lang === "es"
      ? `Alcance: entender ${task} sin tomar decisiones de producto todavía.`
      : `Scope: understand ${task} without product decisions yet.`,
    openQuestions: lang === "es"
      ? ["¿Qué conceptos base necesito dominar primero?", "¿Qué evidencia falta validar?"]
      : ["What core concepts do I need first?", "What evidence is still unvalidated?"],
    nextStepsMessage: lang === "es"
      ? "Elegí la fase 1, creá un macronodo con ese título y profundizá esa fase."
      : "Pick phase 1, create a macro node with that title, and go deep on that phase.",
    source: "fallback",
  };
}

/**
 * @param {'sales-agent' | 'deep-researcher'} agentSlug
 */
export async function runPlanAgent({
  agentSlug,
  locale = "en",
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
}) {
  const lang = normalizePlanAgentLocale(locale);
  const task = asString(instruction);
  if (!task) {
    throw new Error("instruction is required");
  }

  const fallback = buildFallbackPlanAgentOutput(agentSlug, lang, task, brandContext);

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  const { system, user } = buildPlanAgentPrompt(agentSlug, lang, {
    instruction: task,
    brandContext,
    knowledgeContext,
    wiredInputs,
  });

  const llm = await completeJson(user, { system });
  if (!llm?.data || typeof llm.data !== "object") {
    return { ...fallback, source: "fallback-llm-empty" };
  }

  const normalized = normalizePlanAgentOutput(llm.data, agentSlug, lang);

  if (!normalized.writtenContent.body && normalized.items.length > 0) {
    normalized.writtenContent = {
      headline: normalized.writtenContent.headline || fallback.writtenContent.headline,
      body: buildFallbackBody(lang, brandContext?.brand || "brand", task, normalized.items),
    };
  }

  if (!outputHasContent(normalized, agentSlug)) {
    return { ...fallback, source: "fallback-empty" };
  }

  if (!normalized.nextStepsMessage) {
    normalized.nextStepsMessage = fallback.nextStepsMessage;
  }

  return { ...normalized, source: llm.provider || "groq" };
}

export async function runSalesAgent(params) {
  return runPlanAgent({ ...params, agentSlug: "sales-agent" });
}

export async function runDeepResearcher(params) {
  return runPlanAgent({ ...params, agentSlug: "deep-researcher" });
}
