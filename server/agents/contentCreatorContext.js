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
export function normalizeContentCreatorLocale(locale) {
  return locale === "es" ? "es" : "en";
}

/**
 * @param {'en' | 'es'} [locale]
 * @returns {string}
 */
export function loadContentCreatorSystemContext(locale = "en") {
  const lang = normalizeContentCreatorLocale(locale);
  if (cachedSystemByLocale[lang] !== undefined) {
    return cachedSystemByLocale[lang] || "";
  }
  const filePath = path.join(AGENTS_DIR, `content-creator.${lang}.md`);
  try {
    cachedSystemByLocale[lang] = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    cachedSystemByLocale[lang] = "";
  }
  return cachedSystemByLocale[lang] || "";
}

const OUTPUT_BRIDGE = {
  en: `
OUTPUT — valid JSON only (no markdown wrapper). All text fields in English.

{
  "listTitle": string,
  "items": [{ "text": string }],
  "writtenContent": { "headline": string, "body": string },
  "platformRecommendation": string,
  "nextStepsMessage": string
}

Rules:
- writtenContent.body: the actual deliverable content (titles, hooks, draft copy, blog sections) ready to publish or use — NOT meta tasks.
- For N titles/hooks: put each title in items[] AND repeat them in writtenContent.body (numbered or bullet list).
- For a blog/article request: writtenContent.body is the full draft (multiple paragraphs separated by blank lines).
- listTitle + items: optional checklist when multiple deliverables; each item.text is one deliverable label.
- platformRecommendation: channel + tone when vague; else "".
- nextStepsMessage: pick one todo item → macro node in this doc → connect agent → schedule → check off when done.

MACRO_BLOG MODE (when payload.mode is "macro_blog"):
- macroTitle is the blog title/topic — use it as writtenContent.headline.
- instruction is the /agent cell on the wired macro node (e.g. "write me a blog").
- scheduleAt is the publish deadline context if present.
- Write the FULL blog draft in writtenContent.body (multiple paragraphs). items[] can be [].
- platformRecommendation and nextStepsMessage can be "".
`.trim(),
  es: `
SALIDA — solo JSON válido (sin markdown). Texto en español.

{
  "listTitle": string,
  "items": [{ "text": string }],
  "writtenContent": { "headline": string, "body": string },
  "platformRecommendation": string,
  "nextStepsMessage": string
}

Reglas:
- writtenContent.body: el contenido real del entregable (títulos, hooks, borrador, secciones de blog) listo para usar — NO tareas meta.
- Para N títulos/hooks: cada título en items[] Y repetilos en writtenContent.body (numerados o viñetas).
- Para blog/artículo: writtenContent.body es el borrador completo (párrafos separados por línea en blanco).
- listTitle + items: checklist opcional; cada item.text es un entregable.
- platformRecommendation: canal + tono si es vago; si no, "".
- nextStepsMessage: elegir ítem del todo → macronodo en este doc → conectar agente → schedule → tachar al terminar.

MODO MACRO_BLOG (cuando payload.mode es "macro_blog"):
- macroTitle es el título/tema del blog — usalo como writtenContent.headline.
- instruction es la celda /agent del macronodo cableado (ej. "escribime un blog").
- scheduleAt es contexto de fecha límite si existe.
- Escribí el borrador COMPLETO del blog en writtenContent.body (varios párrafos). items[] puede ser [].
- platformRecommendation y nextStepsMessage pueden ser "".
`.trim(),
};

/**
 * @param {'en' | 'es'} locale
 * @param {object} params
 * @param {string} params.instruction
 * @param {object} [params.brandContext]
 * @param {string} [params.knowledgeContext]
 * @param {object[]} [params.wiredInputs]
 * @param {'document_plan'|'macro_blog'} [params.mode]
 * @param {string} [params.macroTitle]
 * @param {string|null} [params.scheduleAt]
 */
export function buildContentCreatorPrompt(locale, {
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
  mode = "document_plan",
  macroTitle = "",
  scheduleAt = null,
}) {
  const lang = normalizeContentCreatorLocale(locale);
  const brand = String(brandContext?.brand || brandContext?.name || "the brand").trim() || "the brand";
  const systemContext = loadContentCreatorSystemContext(lang).replace(/{brand}/g, brand);
  const bridge = OUTPUT_BRIDGE[lang];

  const payload = {
    locale: lang,
    mode: mode === "macro_blog" ? "macro_blog" : "document_plan",
    instruction: String(instruction || "").trim(),
    macroTitle: String(macroTitle || "").trim(),
    scheduleAt: scheduleAt ? String(scheduleAt).slice(0, 10) : null,
    brandContext: {
      name: String(brandContext?.name || "").trim(),
      brand,
      description: String(brandContext?.description || "").trim().slice(0, 1200),
    },
    knowledgeContext: String(knowledgeContext || "").trim().slice(0, 8000),
    hasKnowledge: Boolean(String(knowledgeContext || "").trim()),
    wiredInputs: Array.isArray(wiredInputs) ? wiredInputs.slice(0, 12) : [],
  };

  const instructionLine = mode === "macro_blog"
    ? (lang === "es"
      ? `Escribí el blog completo para el macronodo. Título: "${macroTitle || "sin título"}".\nResponde SOLO JSON. writtenContent.body es obligatorio (borrador completo).`
      : `Write the full blog for the macro node. Title: "${macroTitle || "untitled"}".\nRespond with JSON only. writtenContent.body is required (full draft).`)
    : (lang === "es"
      ? "Generá el contenido según la instrucción y el contexto cableado en canvas.\nResponde SOLO JSON según OUTPUT_BRIDGE. writtenContent.body es obligatorio."
      : "Generate content per the instruction and wired canvas context.\nRespond with JSON only per OUTPUT_BRIDGE. writtenContent.body is required.");

  const header = lang === "es" ? "CONTEXTO (JSON):" : "CONTEXT (JSON):";

  return {
    system: `${systemContext}\n\n---\n\n${bridge}`,
    user: `${instructionLine}\n\n${header}\n${JSON.stringify(payload, null, 2)}`,
  };
}

/** Clears in-memory cache (tests). */
export function clearContentCreatorContextCache() {
  for (const key of Object.keys(cachedSystemByLocale)) {
    delete cachedSystemByLocale[key];
  }
}
