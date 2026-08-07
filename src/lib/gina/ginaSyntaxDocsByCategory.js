/**
 * Syntax bank: list / highlight documents by category.
 * Phrases, typos, and near-matches → same intent (LIVE CORPUS category resolve elsewhere).
 *
 * Pattern: every new Gina intent should ship a ginaSyntax*.js + tests of variants.
 */

import { foldGinaText } from "./ginaTimeScope.js";

function fold(s) {
  return foldGinaText(s);
}

/** Fetch / deliver verbs */
const FETCH_VERBS = /\b(entreg\w*|dame|muestra\w*|trae\w*|lista\w*|listame|quiero(\s+ver)?|show|give|fetch|bring|ver)\b/;

/** Doc nouns (incl. short "docs") */
const DOC_NOUN = /\b(documentos?|docs?|documents?)\b/;

/** Chip command: "Filtrar y resaltar: Blogs" */
const FILTER_HIGHLIGHT_CMD = /\bfiltrar\s+y\s+resaltar\s*:|\bfilter\s+and\s+highlight\s*:/i;

/** Slash: /buscar --categoria "Blogs" --resaltar */
const SLASH_BUSCAR = /\/buscar\b/i;

/**
 * True when utterance asks to list/show docs scoped to a category-like name.
 * Does not resolve the live category — caller uses matchNamedCategoryInText.
 * @param {string} text
 */
export function wantsDocsByCategorySyntax(text) {
  const raw = String(text || "");
  const q = fold(text);
  if (!q) return false;

  // Do not steal department review / browse
  if (/\b(departamento|departamentos|revisar|review)\b/.test(q)) return false;
  if (/\bdocumentos?\s+(del|de|en)\s+departamento\b/.test(q)) return false;

  // Direct chip command
  if (FILTER_HIGHLIGHT_CMD.test(raw)) return true;

  // Slash command with category + resaltar
  if (SLASH_BUSCAR.test(raw)
    && /--categor(?:ia|y)\b/i.test(raw)
    && /--resaltar|--highlight/i.test(raw)) {
    return true;
  }

  // Explicit highlight / underline verbs
  if (/\b(resaltar|subrayar|highlight|subrayado)\b/.test(q)) return true;

  // Chip / layer legacy
  if (/\bcategor[ií]as?\s*:/.test(raw) || /\bcategories?\s*:/.test(raw)) {
    return true;
  }

  // "entregame todos los docs que sean de X" / "dame los documentos de Blogs"
  if (FETCH_VERBS.test(q) && DOC_NOUN.test(q)) {
    if (/\b(que\s+sean?\s+de|que\s+sea\s+de|de\s+la\s+categor[ií]a|de\s+las?\s+categor[ií]as?)\b/.test(q)) {
      return true;
    }
    // "docs de Blogs" / "documentos del plan" — not department / folder scoped
    if (/\b(documentos?|docs?|documents?)\s+(del|de|en)\s+/.test(q)
      && !/\b(departamento|folder|carpeta|caja)\b/.test(q)
      && !/\b(todos\s+los\s+departamentos)\b/.test(q)) {
      // Avoid pure corpus-wide "todos los documentos" with no trailing name
      if (/\b(todos|todas)\s+(los|las)\s+(documentos?|docs?)\s*$/.test(q)) return false;
      if (/\b(todos|todas)\s+(los|las)\s+(documentos?|docs?)\b/.test(q)
        && /\b(de|del|en)\s+\w+/.test(q)) {
        return true;
      }
      // "dame los docs de blogs" without todos
      if (/\b(documentos?|docs?|documents?)\s+(del|de)\s+\w+/.test(q)) return true;
    }
  }

  return false;
}

function cleanHint(s) {
  return String(s || "")
    .replace(/\b(con\s+horarios?|con\s+status|con\s+estados?|por\s+favor|gina)\b/gi, " ")
    .replace(/[.?!,;·]+$/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function isDepartmentScopedHint(hint) {
  const h = fold(hint);
  if (!h) return true;
  if (/\bdepartamento\b/.test(h)) return true;
  if (/^(departamento|dept|depto)\b/.test(h)) return true;
  return false;
}

/**
 * Extract a raw category hint string from NL (best-effort).
 * @param {string} text
 * @returns {string}
 */
export function extractCategoryHintFromDocsSyntax(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const q = fold(raw);
  if (/\bdepartamento\b/.test(q) || /\brevisar\b/.test(q)) return "";

  // "Filtrar y resaltar: Blogs" / "Filter and highlight: Blogs"
  const cmd = raw.match(/\bfiltrar\s+y\s+resaltar\s*:\s*([^\n]+)/i)
    || raw.match(/\bfilter\s+and\s+highlight\s*:\s*([^\n]+)/i);
  if (cmd) {
    const first = cmd[1].split(/\s*(?:,|;| y | and | · |\s+con\s+)/i)[0];
    const hint = cleanHint(first);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  // /buscar --categoria "Blogs" --resaltar
  const slashCat = raw.match(/--categor(?:ia|y)\s*[=\s]\s*["']?([^"'\n]+?)["']?(?=\s+--|\s*$)/i)
    || raw.match(/--categor(?:ia|y)\s+["']?([^"'\s\n]+)/i);
  if (slashCat && /--resaltar|--highlight/i.test(raw)) {
    const hint = cleanHint(slashCat[1]);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  const resaltar = raw.match(
    /\b(?:resaltar|subrayar|highlight)\s+(?:la\s+)?(?:categor[ií]a\s+)?(.+?)(?:\s*$|\s+con\s+)/i,
  ) || raw.match(/\b(?:resaltar|subrayar|highlight)\s+(.+)$/i);
  if (resaltar) {
    const hint = cleanHint(resaltar[1]);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  const layered = raw.match(/categor[ií]as?\s*:\s*([^\n]+)/i)
    || raw.match(/categories?\s*:\s*([^\n]+)/i);
  if (layered) {
    // First category if multi
    const first = layered[1].split(/\s*(?:,|;| y | and )\s*/i)[0];
    const hint = cleanHint(first);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  const queSean = raw.match(
    /\b(?:documentos?|docs?|documents?)\s+(?:que\s+sean?\s+de|que\s+sea\s+de)\s+(.+)$/i,
  );
  if (queSean) {
    const hint = cleanHint(queSean[1]);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  const deLaCat = raw.match(
    /\b(?:documentos?|docs?|documents?)\s+de\s+la\s+categor[ií]a\s+(.+)$/i,
  );
  if (deLaCat) {
    const hint = cleanHint(deLaCat[1]);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  const docsDe = raw.match(
    /\b(?:todos|todas)\s+(?:los|las)\s+(?:documentos?|docs?|documents?)\s+(?:del|de|en)\s+(.+)$/i,
  );
  if (docsDe) {
    const hint = cleanHint(docsDe[1]);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  const shortDe = raw.match(
    /\b(?:documentos?|docs?|documents?)\s+(?:del|de)\s+(.+)$/i,
  );
  if (shortDe) {
    const hint = cleanHint(shortDe[1]);
    return isDepartmentScopedHint(hint) ? "" : hint;
  }

  return "";
}

/**
 * Chip text: direct command (no redundant "Entrégame…" phrase).
 * @param {string | string[]} categoryName
 * @param {{ locale?: string, showSchedule?: boolean, showStatus?: boolean }} [opts]
 */
export function buildResaltarCategoryChipText(categoryName, opts = {}) {
  const en = opts.locale === "en";
  const names = (Array.isArray(categoryName) ? categoryName : [categoryName])
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  if (!names.length) {
    const parts = [en ? "Full document list" : "Listado completo"];
    if (opts.showSchedule) parts.push(en ? "with schedule" : "con horarios");
    if (opts.showStatus) parts.push(en ? "with status" : "con status");
    return parts.join(" ");
  }
  const label = names.join(", ");
  let text = en ? `Filter and highlight: ${label}` : `Filtrar y resaltar: ${label}`;
  const layers = [];
  if (opts.showSchedule) layers.push(en ? "with schedule" : "con horarios");
  if (opts.showStatus) layers.push(en ? "with status" : "con status");
  if (layers.length) text += ` · ${layers.join(" · ")}`;
  return text;
}

/**
 * Build chat command from list-refine multi-select.
 * @param {{
 *   categories?: string[],
 *   showSchedule?: boolean,
 *   showStatus?: boolean,
 *   locale?: string,
 * }} opts
 */
export function buildListRefineCommand(opts = {}) {
  const cats = (Array.isArray(opts.categories) ? opts.categories : [])
    .map((c) => String(c || "").trim())
    .filter(Boolean);
  return buildResaltarCategoryChipText(cats, {
    locale: opts.locale,
    showSchedule: Boolean(opts.showSchedule),
    showStatus: Boolean(opts.showStatus),
  });
}

/**
 * Resolve whether multi-select is ready to send / dismiss.
 * @param {{
 *   categories?: string[],
 *   showSchedule?: boolean,
 *   showStatus?: boolean,
 *   omit?: boolean,
 *   locale?: string,
 * }} selection
 * @returns {{ action: "wait" | "dismiss" | "send", command?: string }}
 */
export function resolveListRefineSelection(selection = {}) {
  const categories = (Array.isArray(selection.categories) ? selection.categories : [])
    .map((c) => String(c || "").trim())
    .filter(Boolean);
  const showSchedule = Boolean(selection.showSchedule);
  const showStatus = Boolean(selection.showStatus);
  const omit = Boolean(selection.omit);
  const locale = selection.locale === "en" ? "en" : "es";

  if (omit && !categories.length && !showSchedule && !showStatus) {
    return { action: "dismiss" };
  }
  if (omit && categories.length) {
    return {
      action: "send",
      command: buildListRefineCommand({
        categories,
        showSchedule: false,
        showStatus: false,
        locale,
      }),
    };
  }
  if (categories.length && (showSchedule || showStatus)) {
    return {
      action: "send",
      command: buildListRefineCommand({
        categories,
        showSchedule,
        showStatus,
        locale,
      }),
    };
  }
  if (!categories.length && (showSchedule || showStatus)) {
    return {
      action: "send",
      command: buildListRefineCommand({
        categories: [],
        showSchedule,
        showStatus,
        locale,
      }),
    };
  }
  return { action: "wait" };
}
