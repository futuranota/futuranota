import { completeJson } from "../llmJson.js";
import {
  buildContentCreatorPrompt,
  normalizeContentCreatorLocale,
} from "./contentCreatorContext.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} raw
 * @returns {{ headline: string, body: string }}
 */
function normalizeWrittenContent(raw) {
  if (!raw || typeof raw !== "object") {
    return { headline: "", body: "" };
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  return {
    headline: asString(obj.headline),
    body: asString(obj.body),
  };
}

/**
 * @typedef {Object} ContentPlanItem
 * @property {string} text
 */

/**
 * @typedef {Object} ContentCreatorOutput
 * @property {string} listTitle
 * @property {ContentPlanItem[]} items
 * @property {{ headline: string, body: string }} writtenContent
 * @property {string} platformRecommendation
 * @property {string} nextStepsMessage
 * @property {string} [source]
 */

/**
 * @param {unknown} raw
 * @param {'en' | 'es'} lang
 * @returns {ContentCreatorOutput}
 */
export function normalizeContentCreatorPlan(raw, lang) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(obj.items)
    ? obj.items
      .map((item) => ({
        text: asString(item && typeof item === "object" ? item.text : item),
      }))
      .filter((item) => item.text)
    : [];

  return {
    listTitle: asString(obj.listTitle),
    items,
    writtenContent: normalizeWrittenContent(obj.writtenContent),
    platformRecommendation: asString(obj.platformRecommendation),
    nextStepsMessage: asString(obj.nextStepsMessage),
    source: asString(obj.source) || "groq",
  };
}

/**
 * @param {ContentCreatorOutput} plan
 * @returns {boolean}
 */
function outputHasContent(plan, mode = "document_plan") {
  if (plan.writtenContent?.body?.trim()) return true;
  if (mode === "macro_blog") {
    return (plan.items?.length ?? 0) > 0;
  }
  return Boolean(plan.listTitle && plan.items.length > 0);
}

/**
 * @param {'en' | 'es'} lang
 * @param {string} instruction
 * @param {object} [brandContext]
 * @param {ContentPlanItem[]} [items]
 * @returns {ContentCreatorOutput}
 */
function buildWrittenBodyFromItems(lang, instruction, brandContext, items) {
  const brand = asString(brandContext?.brand || brandContext?.name) || (lang === "es" ? "tu marca" : "your brand");
  const lines = items.map((item, i) => `${i + 1}. ${item.text}`);
  const headline = lang === "es"
    ? `Contenido · ${instruction.slice(0, 60)}`
    : `Content · ${instruction.slice(0, 60)}`;

  return {
    headline,
    body: [
      lang === "es"
        ? `Borrador para ${brand}:`
        : `Draft for ${brand}:`,
      "",
      ...lines,
    ].join("\n"),
  };
}

/**
 * @param {'en' | 'es'} lang
 * @param {string} instruction
 * @param {object} [brandContext]
 * @returns {ContentCreatorOutput}
 */
export function buildFallbackContentCreatorPlan(lang, instruction, brandContext = {}, mode = "document_plan", macroTitle = "") {
  const brand = asString(brandContext?.brand || brandContext?.name) || (lang === "es" ? "tu marca" : "your brand");
  const task = asString(instruction) || (lang === "es" ? "contenido" : "content");
  const title = asString(macroTitle) || task.slice(0, 80);

  if (mode === "macro_blog") {
    const compactTask = task.length <= 64;
    if (compactTask) {
      return {
        listTitle: lang === "es" ? `Todo: ${title}` : `Todo: ${title}`,
        items: [{ text: title }],
        writtenContent: { headline: "", body: "" },
        platformRecommendation: "",
        nextStepsMessage: "",
        source: "fallback",
      };
    }
    const body = lang === "es"
      ? `Este es un borrador inicial sobre "${title}" para ${brand}.\n\nExpandí este texto con tu voz y ejemplos concretos antes de publicar.`
      : `This is a starter draft about "${title}" for ${brand}.\n\nExpand with your voice and concrete examples before publishing.`;
    return {
      listTitle: "",
      items: [],
      writtenContent: { headline: title, body },
      platformRecommendation: "",
      nextStepsMessage: "",
      source: "fallback",
    };
  }

  const items = lang === "es"
    ? [
      { text: `${brand}: idea 1 para ${task}` },
      { text: `${brand}: idea 2 para ${task}` },
      { text: `${brand}: idea 3 para ${task}` },
    ]
    : [
      { text: `${brand}: idea 1 for ${task}` },
      { text: `${brand}: idea 2 for ${task}` },
      { text: `${brand}: idea 3 for ${task}` },
    ];

  const writtenContent = buildWrittenBodyFromItems(lang, task, brandContext, items);

  if (lang === "es") {
    return {
      listTitle: `Plan: ${task.slice(0, 80)}`,
      items,
      writtenContent,
      platformRecommendation: "Te recomiendo empezar por Instagram o blog según dónde esté tu audiencia más activa.",
      nextStepsMessage: "Siguiente paso: elegí un ítem del todo, creá un macronodo en este documento con ese título, conectalo al agente, poné schedule y tendrás el borrador antes de esa fecha. Cuando completes el artículo, tachá el ítem manualmente.",
      source: "fallback",
    };
  }

  return {
    listTitle: `Plan: ${task.slice(0, 80)}`,
    items,
    writtenContent,
    platformRecommendation: "I recommend starting with Instagram or your blog depending on where your audience is most active.",
    nextStepsMessage: "Next: pick one todo item, create a macro node in this document with that title, connect it to the agent, and set a schedule. When the article is done, check off the item manually.",
    source: "fallback",
  };
}

/**
 * @param {object} params
 * @param {'en' | 'es'} [params.locale]
 * @param {string} params.instruction
 * @param {object} [params.brandContext]
 * @param {string} [params.knowledgeContext]
 * @param {object[]} [params.wiredInputs]
 * @param {'document_plan'|'macro_blog'} [params.mode]
 * @param {string} [params.macroTitle]
 * @param {string|null} [params.scheduleAt]
 * @returns {Promise<ContentCreatorOutput>}
 */
export async function runContentCreator({
  locale = "en",
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
  mode = "document_plan",
  macroTitle = "",
  scheduleAt = null,
}) {
  const lang = normalizeContentCreatorLocale(locale);
  const task = asString(instruction);
  if (!task) {
    throw new Error("instruction is required");
  }

  const fallback = buildFallbackContentCreatorPlan(lang, task, brandContext, mode, macroTitle);

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  const { system, user } = buildContentCreatorPrompt(lang, {
    instruction: task,
    brandContext,
    knowledgeContext,
    wiredInputs,
    mode,
    macroTitle,
    scheduleAt,
  });

  const llm = await completeJson(user, { system });
  if (!llm?.data || typeof llm.data !== "object") {
    return { ...fallback, source: "fallback-llm-empty" };
  }

  const normalized = normalizeContentCreatorPlan(llm.data, lang);

  if (!normalized.writtenContent.body && normalized.items.length > 0) {
    normalized.writtenContent = buildWrittenBodyFromItems(
      lang,
      task,
      brandContext,
      normalized.items,
    );
  }

  if (!normalized.writtenContent.headline && macroTitle) {
    normalized.writtenContent.headline = macroTitle;
  }

  if (!outputHasContent(normalized, mode)) {
    return { ...fallback, source: "fallback-empty" };
  }

  if (!normalized.nextStepsMessage) {
    normalized.nextStepsMessage = fallback.nextStepsMessage;
  }

  return { ...normalized, source: llm.provider || "groq" };
}
