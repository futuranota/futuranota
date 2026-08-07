/**
 * Map user utterances to Gina tool families (1–2 tools).
 * Live corpus only — time scope + name ambiguity.
 */

import { parseGinaTimeScope, foldGinaText } from "./ginaTimeScope.js";
import { buildGinaDailyReport } from "./ginaDailyReport.js";
import { getPendingDailyReport, markDailyReportOpened } from "./ginaDailyReportStore.js";
import {
  isFindDocumentIntent,
  parseFindHints,
  searchDocumentsByHints,
} from "./ginaFindDocument.js";
import {
  filterDocumentsByDepartmentAndCategory,
  findFolderIdByName,
  get_documents_by_date_range,
  get_documents_by_status,
  get_document_detail,
  get_folder_children_summary,
  get_gina_scope,
  get_incomplete_documents,
  get_past_due_documents,
  get_schedule_conflicts,
  get_today_scope,
  get_week_scope,
  get_all_company_documents,
  get_all_company_folders,
  get_workspace_inventory,
  resolveNameAmbiguity,
  matchDepartmentInText,
  extractScopedName,
  expandDepartmentNameTokens,
  getDepartmentCorpusStats,
  matchLiveCategoryInText,
  matchNamedCategoryInText,
  expandCategoryNameTokens,
  matchLiveFolderInText,
  matchLiveFoldersByNeedle,
} from "./ginaTools.js";
import {
  clearPendingGinaOffer,
  consumePendingGinaOffer,
  getPendingGinaOffer,
  setPendingGinaOffer,
} from "./ginaPendingOffer.js";
import {
  nearMatchToken,
  textHasNearPhrase,
  textHasNearToken,
} from "./ginaFuzzyMatch.js";
import {
  extractCategoryHintFromDocsSyntax,
  wantsDocsByCategorySyntax,
} from "./ginaSyntaxDocsByCategory.js";
import {
  parseGinaScheduleScope,
  wantsGinaScheduleScopeList,
  filterDocsByScheduleScope,
} from "./ginaSyntaxScheduleScope.js";

function fold(s) {
  return foldGinaText(s);
}

/** Count-intent vocabulary (fuzzy matched). */
const COUNT_DEPT_COUNT_TOKENS = [
  "cuantos",
  "cuantas",
  "cuanto",
  "total",
  "general",
];
const COUNT_DEPT_COUNT_PHRASES = ["how many", "en general"];
/** Department entity vocabulary (fuzzy matched). */
const COUNT_DEPT_ENTITY_TOKENS = [
  "departamento",
  "departamentos",
  "depto",
  "deptos",
  "department",
  "departments",
];

/** Folder entity vocabulary (fuzzy matched). */
const COUNT_FOLDER_ENTITY_TOKENS = [
  "folder",
  "folders",
  "carpeta",
  "carpetas",
  "caja",
  "cajas",
];

/** Category entity vocabulary (fuzzy matched). */
const COUNT_CATEGORY_ENTITY_TOKENS = [
  "categoria",
  "categorias",
  "category",
  "categories",
];

/** Document entity vocabulary (fuzzy matched). */
const COUNT_DOCUMENT_ENTITY_TOKENS = [
  "documento",
  "documentos",
  "document",
  "documents",
  "doc",
  "docs",
  "archivo",
  "archivos",
];

/**
 * "¿Cuántos departamentos… / en general / total?"
 * @param {string} text
 */
export function wantsCountDepartments(text) {
  const q = fold(text);
  if (!q) return false;
  if (!textHasNearToken(q, COUNT_DEPT_ENTITY_TOKENS)) return false;
  // Prefer more specific entity counts
  if (textHasNearToken(q, COUNT_FOLDER_ENTITY_TOKENS)) return false;
  if (textHasNearToken(q, COUNT_CATEGORY_ENTITY_TOKENS)) return false;
  if (textHasNearToken(q, COUNT_DOCUMENT_ENTITY_TOKENS)) return false;
  if (textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS)) return true;
  if (textHasNearPhrase(q, COUNT_DEPT_COUNT_PHRASES)) return true;
  if (/\bhow\s+many\b/.test(q)) return true;
  if (/\ben\s+general\b/.test(q)) return true;
  return false;
}

/**
 * "¿Cuántos folders… / en {Depto} / en general?"
 * @param {string} text
 */
export function wantsCountFolders(text) {
  const q = fold(text);
  if (!q) return false;
  if (!textHasNearToken(q, COUNT_FOLDER_ENTITY_TOKENS)) return false;
  if (textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS)) return true;
  if (textHasNearPhrase(q, COUNT_DEPT_COUNT_PHRASES)) return true;
  if (/\bhow\s+many\b/.test(q)) return true;
  if (/\ben\s+general\b/.test(q)) return true;
  return false;
}

/**
 * "¿Cuántas categorías… / en {Depto} / en general?"
 * @param {string} text
 */
export function wantsCountCategories(text) {
  const q = fold(text);
  if (!q) return false;
  // Folders win if both entities present
  if (textHasNearToken(q, COUNT_FOLDER_ENTITY_TOKENS)) return false;
  if (!textHasNearToken(q, COUNT_CATEGORY_ENTITY_TOKENS)) return false;
  if (textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS)) return true;
  if (textHasNearPhrase(q, COUNT_DEPT_COUNT_PHRASES)) return true;
  if (/\bhow\s+many\b/.test(q)) return true;
  if (/\ben\s+general\b/.test(q)) return true;
  return false;
}

/**
 * "¿Cuántos documentos… / docs / en {Depto} / en general / en todos los departamentos?"
 * Generic count — no named category/folder required.
 * @param {string} text
 */
export function wantsCountDocuments(text) {
  const q = fold(text);
  if (!q) return false;
  // Prefer more specific entity counts
  if (textHasNearToken(q, COUNT_FOLDER_ENTITY_TOKENS)) return false;
  if (textHasNearToken(q, COUNT_CATEGORY_ENTITY_TOKENS)) return false;
  if (!textHasNearToken(q, COUNT_DOCUMENT_ENTITY_TOKENS)) return false;
  // "cuántos documentos en todos los departamentos" is still a document count
  const docsAcrossDepts = /\b(todos\s+los\s+departamentos|en\s+total|en\s+general)\b/.test(q);
  if (textHasNearToken(q, COUNT_DEPT_ENTITY_TOKENS) && !docsAcrossDepts) return false;
  if (textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS)) return true;
  if (textHasNearPhrase(q, COUNT_DEPT_COUNT_PHRASES)) return true;
  if (/\bhow\s+many\b/.test(q)) return true;
  if (/\ben\s+general\b/.test(q)) return true;
  if (docsAcrossDepts) return true;
  return false;
}

/**
 * Corpus-wide full document list (not a named folder).
 * Uses workspace_query FETCH contract (entregame / tráeme / dame / …).
 * @param {string} text
 */
export function wantsCorpusDocsListAll(text) {
  const q = fold(text);
  if (!q) return false;
  // Explicit full-list phrasing (corpus)
  if (/\blistado\s+completo\b/.test(q)) return true;
  if (/\bfull\s+(document\s+)?list\b/.test(q)) return true;
  if (/\b(el\s+)?listado\s+de\s+todos\s+(los\s+)?documentos?\b/.test(q)) return true;
  if (/\b(all\s+(the\s+)?documents?|every\s+document)\b/.test(q)
    && !/\b(of|in|from)\s+[a-z0-9áéíóúüñ]{3,}/.test(q)) {
    return true;
  }
  // "dame/entregame/tráeme todos los documentos" — only if NOT scoped to a folder/name via del/de/en X
  if (/\b(todos|todas)\s+(los|las)\s+(documentos?|docs?)\b/.test(q)) {
    // "documentos del plan de negocio" / "documentos de Marketing" → not corpus-wide
    if (/\bdocumentos?\s+(del|de|en)\s+(?!todos\b|todas\b|general\b|total\b)/.test(q)) {
      return false;
    }
    if (/\b(entreg\w*|dame|muestra\w*|trae\w*|quiero|ver|lista\w*|listame|show|give|fetch|bring)\b/.test(q)) {
      return true;
    }
  }
  return false;
}

/**
 * Browse / filter documents by department (menu or named dept).
 * @param {string} text
 */
export function wantsDocsByDepartmentBrowse(text) {
  const q = fold(text);
  if (!q) return false;
  if (/\b(por|por\s+los|ver\s+por|mostrar\s+por|busc\w*\s+por)\s+departamentos?\b/.test(q)) return true;
  if (/\b(by|per)\s+departments?\b/.test(q)) return true;
  if (/\bdocumentos?\s+(del|de|en)\s+departamento\b/.test(q)) return true;
  if (/\bdepartamento\s*:\s*\w+/.test(q)) return true;
  if (/\bdocuments?\s+(in|from|of)\s+(the\s+)?department\b/.test(q)) return true;
  if (/\bdepartment\s*:\s*\w+/.test(q)) return true;
  return false;
}

/**
 * Browse / filter documents by category (menu or named cat).
 * @param {string} text
 */
export function wantsDocsByCategoryBrowse(text) {
  const q = fold(text);
  if (!q) return false;
  if (/\b(por|por\s+las|ver\s+por|mostrar\s+por|busc\w*\s+por)\s+categor[ií]as?\b/.test(q)) return true;
  if (/\b(by|per)\s+categor(y|ies)\b/.test(q)) return true;
  if (/\bdocumentos?\s+(de|del|en)\s+(la\s+)?categor[ií]a\b/.test(q)) return true;
  if (/\bcategor[ií]a\s*:\s*\w+/.test(q)) return true;
  if (/\bdocuments?\s+(in|from|of)\s+(the\s+)?categor(y|ies)\b/.test(q)) return true;
  if (/\bcategory\s*:\s*\w+/.test(q)) return true;
  return false;
}

/**
 * Sort scheduled docs (by anchorAt) first, then flexible (no schedule).
 * @param {object[]} docs
 */
export function sortDocsScheduledThenFlexible(docs) {
  return [...(Array.isArray(docs) ? docs : [])].sort((a, b) => {
    const aAt = a?.anchorAt ? new Date(a.anchorAt).getTime() : NaN;
    const bAt = b?.anchorAt ? new Date(b.anchorAt).getTime() : NaN;
    const aOk = Number.isFinite(aAt);
    const bOk = Number.isFinite(bAt);
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    if (aOk && bOk && aAt !== bAt) return aAt - bAt;
    return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    });
  });
}

/**
 * Parse optional list-view layers from utterance / chip text.
 * @param {string} text
 * @returns {{
 *   showSchedule: boolean,
 *   showStatus: boolean,
 *   categories: string[],
 *   highlightCategories: string[],
 *   scheduleScope: "all" | "week" | "today" | null,
 * }}
 */
export function parseDocsListView(text) {
  const q = fold(text);
  const scheduleScope = parseGinaScheduleScope(text);
  const showSchedule = Boolean(scheduleScope)
    || /\b(con\s+horarios?|por\s+horario|agrega(?:me)?\s+los\s+horarios?|muestramelo\s+por\s+horario|show\s+(the\s+)?schedule|with\s+times?|add\s+(the\s+)?times?)\b/.test(q);
  const showStatus = /\b(con\s+status|con\s+estados?|agrega(?:me)?\s+(el\s+)?status|muestramelo\s+por\s+status|with\s+status|add\s+(the\s+)?status)\b/.test(q);
  const wantsHighlight = /\b(resaltar|subrayar|highlight|subrayado)\b/.test(q)
    || /\bfiltrar\s+y\s+resaltar\s*:/.test(q)
    || /\bfilter\s+and\s+highlight\s*:/.test(q)
    || (/\/buscar\b/.test(String(text || "")) && /--resaltar|--highlight/i.test(String(text || "")));

  /** @type {string[]} */
  const categories = [];
  const pushCat = (raw) => {
    const name = String(raw || "").trim().replace(/[.?!,;]+$/g, "").trim();
    if (!name || name.length < 2) return;
    // Strip leftover layer words from category tokens
    const cleaned = name
      .replace(/\b(con\s+horarios?|con\s+status|con\s+estados?|listado\s+completo|full\s+document\s+list)\b/gi, "")
      .replace(/^["']+|["']+$/g, "")
      .trim();
    if (!cleaned || cleaned.length < 2) return;
    if (categories.some((c) => fold(c) === fold(cleaned))) return;
    categories.push(cleaned);
  };

  const multi = String(text || "").match(/categor[ií]as?\s*:\s*([^\n]+)/i)
    || String(text || "").match(/categories?\s*:\s*([^\n]+)/i);
  if (multi) {
    const blob = multi[1]
      .replace(/\b(con\s+horarios?|con\s+status|con\s+estados?)\b/gi, " ")
      .trim();
    for (const part of blob.split(/\s*(?:,|;| y | and )\s*/i)) {
      pushCat(part);
    }
  }

  // Direct command: "Filtrar y resaltar: Blogs · con horarios"
  const filterCmd = String(text || "").match(/\bfiltrar\s+y\s+resaltar\s*:\s*([^\n]+)/i)
    || String(text || "").match(/\bfilter\s+and\s+highlight\s*:\s*([^\n]+)/i);
  if (filterCmd) {
    const blob = filterCmd[1]
      .replace(/\s*·\s*/g, ",")
      .replace(/\b(con\s+horarios?|con\s+status|con\s+estados?|with\s+schedule|with\s+status)\b/gi, " ")
      .trim();
    for (const part of blob.split(/\s*(?:,|;| y | and )\s*/i)) {
      pushCat(part);
    }
  }

  // /buscar --categoria "Blogs" --resaltar
  const slashCat = String(text || "").match(/--categor(?:ia|y)\s*[=\s]\s*["']?([^"'\n]+?)["']?(?=\s+--|\s*$)/i)
    || String(text || "").match(/--categor(?:ia|y)\s+["']?([^"'\s\n]+)/i);
  if (slashCat && /--resaltar|--highlight/i.test(String(text || ""))) {
    pushCat(slashCat[1]);
  }

  const single = String(text || "").match(/filtrado\s+por\s+categor[ií]a\s+([^\n,]+)/i)
    || String(text || "").match(/filtered\s+by\s+categor(?:y|ies)\s+([^\n,]+)/i);
  if (single) pushCat(single[1]);

  // "Resaltar Campaigns Results" / "highlight Blogs" / "subrayar la categoría X"
  // Skip bare "resaltar" when already parsed via "Filtrar y resaltar:"
  const hlNamed = !filterCmd && (
    String(text || "").match(
      /\b(?:resaltar|subrayar|highlight)\s+(?:la\s+)?(?:categor[ií]a\s+)?(.+?)(?:\s*$|\s+con\s+|\s+y\s+tambi[eé]n\b)/i,
    )
    || String(text || "").match(/\b(?:resaltar|subrayar|highlight)\s+(.+)$/i)
  );
  if (hlNamed) {
    const blob = hlNamed[1]
      .replace(/\b(con\s+horarios?|con\s+status|listado\s+completo)\b/gi, " ")
      .replace(/\bentr[eé]game\b[\s\S]*$/i, " ")
      .replace(/\bgive\s+me\b[\s\S]*$/i, " ")
      .trim();
    // Allow "A, B" after resaltar
    for (const part of blob.split(/\s*(?:,|;| y | and )\s*/i)) {
      pushCat(part);
    }
  }

  // NL: "docs que sean de Blogs" / "documentos de la categoría X"
  if (!categories.length) {
    const hint = extractCategoryHintFromDocsSyntax(text);
    if (hint) pushCat(hint);
  }

  // Highlight overlay for Resaltar / Filtrar y resaltar / categorías: / slash --resaltar
  const highlightCategories = (wantsHighlight || Boolean(multi) || Boolean(hlNamed) || Boolean(filterCmd))
    ? categories.slice()
    : [];

  return { showSchedule, showStatus, categories, highlightCategories, scheduleScope };
}

/**
 * Group documents by department (name once).
 * @param {object[]} docs
 * @returns {{ department: string, documentCount: number, categories: string[], documents: object[] }[]}
 */
export function groupDocsByDepartment(docs) {
  /** @type {Map<string, object[]>} */
  const map = new Map();
  for (const d of (Array.isArray(docs) ? docs : [])) {
    const dept = String(d.departmentName || d.department || "").trim() || "Sin departamento";
    if (!map.has(dept)) map.set(dept, []);
    map.get(dept).push(d);
  }
  return [...map.entries()]
    .map(([department, documents]) => {
      const catSet = new Set();
      for (const doc of documents) {
        const c = String(doc.category || "").trim();
        if (c) catSet.add(c);
      }
      return {
        department,
        documentCount: documents.length,
        categories: [...catSet],
        documents,
      };
    })
    .sort((a, b) => a.department.localeCompare(b.department, undefined, { sensitivity: "base" }));
}

/**
 * Build declarative chip text for a docs list view.
 * @param {{ showSchedule?: boolean, showStatus?: boolean, categories?: string[] }} view
 * @param {{ locale?: string }} [opts]
 */
export function buildDocsListViewChipText(view = {}, opts = {}) {
  const en = opts.locale === "en";
  const parts = [en ? "Full document list" : "Listado completo"];
  if (view.showSchedule) parts.push(en ? "with schedule" : "con horarios");
  if (view.showStatus) parts.push(en ? "with status" : "con status");
  const cats = Array.isArray(view.categories) ? view.categories.filter(Boolean) : [];
  if (cats.length === 1) {
    parts.push(en ? `categories: ${cats[0]}` : `categorías: ${cats[0]}`);
  } else if (cats.length > 1) {
    parts.push(en ? `categories: ${cats.join(", ")}` : `categorías: ${cats.join(", ")}`);
  }
  return parts.join(" ");
}

/**
 * Count docs of a named category without saying "categoría" (e.g. cuantos blogs).
 * @param {string} text
 */
export function wantsNamedCategoryCountDocs(text) {
  const q = fold(text);
  if (!q) return false;
  if (textHasNearToken(q, COUNT_CATEGORY_ENTITY_TOKENS)) return false; // handled by count_categories
  if (textHasNearToken(q, COUNT_FOLDER_ENTITY_TOKENS) && !/\b(seccion|sección|caja|cajon|cajón)\b/.test(q)) {
    // "cuántos folders" stays folder count
    if (textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS) || /\bhow\s+many\b/.test(q)) return false;
  }
  const hasCount = textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS)
    || textHasNearPhrase(q, COUNT_DEPT_COUNT_PHRASES)
    || /\bhow\s+many\b/.test(q);
  if (!hasCount) return false;
  return true; // category hit checked by caller via matchNamedCategoryInText
}

/**
 * List folders/sections of a named category (cuales son redes sociales / por sección).
 * @param {string} text
 */
export function wantsNamedCategoryListFolders(text) {
  const q = fold(text);
  if (!q) return false;
  const hasExplicitList = (
    /\b(cuales?\s+son|cuáles?\s+son|que\s+folders?|qué\s+folders?|que\s+cajas?|qué\s+cajas?|que\s+secciones|qué\s+secciones)\b/.test(q)
    || /\bpor\s+secci[oó]n(\s+primero)?\b/.test(q)
    || /\b(show\s+sections?|sections?\s+of)\b/.test(q)
    || /\b(secci[oó]n|secciones|t[ií]tulo\s+de\s+caja|caj[oó]n)\b/.test(q)
  );
  const hasCreatedList = /\b(tenemos|hay)\s+cread/.test(q);
  if (!hasExplicitList && !hasCreatedList) return false;
  // "cuántos blogs tenemos creados" → count_docs, not list_folders
  const hasCount = textHasNearToken(q, COUNT_DEPT_COUNT_TOKENS)
    || textHasNearPhrase(q, COUNT_DEPT_COUNT_PHRASES)
    || /\bhow\s+many\b/.test(q);
  if (hasCount && !hasExplicitList) return false;
  return true;
}

/**
 * List all documents in a named category (listado completo).
 * @param {string} text
 */
export function wantsNamedCategoryListDocs(text) {
  const q = fold(text);
  if (!q) return false;
  if (/\blistado\s+completo\b/.test(q)) return true;
  if (/\bfull\s+list\b/.test(q)) return true;
  if (/\b(todos|todas)\s+(los|las)\s+documentos?\b/.test(q) && !wantsFolderDocsList(q)) {
    return true;
  }
  return false;
}

/**
 * @param {object} ctx
 * @param {object} inventory
 * @param {string[]} toolsCalled
 * @param {{
 *   mode: "count_docs" | "list_folders" | "list_docs",
 *   category: string,
 *   departmentName?: string | null,
 * }} opts
 */
function buildCategoryScopeFamily(ctx, inventory, toolsCalled, opts) {
  if (!toolsCalled.includes("get_workspace_inventory")) {
    toolsCalled.push("get_workspace_inventory");
  }
  const category = String(opts.category || "").trim();
  const deptName = opts.departmentName ? String(opts.departmentName).trim() : null;
  const corpusName = String(
    ctx.corpusName || ctx.objectName || ctx.companyName || "",
  ).trim() || null;

  const allFolders = Array.isArray(inventory.folders) ? inventory.folders : [];
  const folders = allFolders.filter((f) => {
    const cat = fold(f.category);
    const want = fold(category);
    if (!cat || !want) return false;
    const aliases = expandCategoryNameTokens(category);
    const catOk = cat === want
      || cat.includes(want)
      || want.includes(cat)
      || aliases.some((a) => cat === a || nearMatchToken(cat, a));
    if (!catOk) return false;
    if (!deptName) return true;
    const fd = fold(f.departmentName);
    const wantDept = fold(deptName);
    if (fd === wantDept) return true;
    return expandDepartmentNameTokens(deptName).includes(fd)
      || expandDepartmentNameTokens(f.departmentName).includes(wantDept);
  }).map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category || category,
    departmentName: f.departmentName || deptName,
    documentCount: f.childDocuments ?? 0,
    hasSchedule: Boolean(f.hasSchedule),
  }));

  toolsCalled.push("filter_documents_by_department_and_category");
  const documents = filterDocumentsByDepartmentAndCategory(
    ctx,
    deptName || "",
    category,
    "",
  ).map((d) => ({
    id: d.id,
    title: d.title || d.name || "—",
    status: d.status || null,
    departmentName: d.departmentName || deptName,
    category: d.category || category,
    folder: d.parentFolderName || null,
    anchorAt: d.anchorAt || null,
    anchorFinishAt: d.anchorFinishAt || null,
  }));

  return {
    family: "category_scope",
    toolsCalled,
    toolContext: {
      inventory,
      corpusName,
      mode: opts.mode,
      department: deptName,
      category,
      folderCount: folders.length,
      documentCount: documents.length,
      folders,
      documents,
      empty: opts.mode === "list_folders"
        ? folders.length === 0
        : documents.length === 0,
      hint: `Named category scope (${opts.mode}) for ${category}`,
    },
    workspaceInventory: inventory,
    pendingGinaOffer: null,
  };
}

/**
 * Build deterministic document count / browse / list for corpus, department, or category.
 * @param {object} ctx
 * @param {object} inventory
 * @param {string[]} toolsCalled
 * @param {{
 *   mode?: "count" | "list_all" | "pick_department" | "pick_category" | "list_by_department" | "list_by_category",
 *   departmentName?: string | null,
 *   categoryName?: string | null,
 *   view?: { showSchedule?: boolean, showStatus?: boolean, categories?: string[] },
 *   text?: string,
 * }} [opts]
 */
function buildCountDocumentsFamily(ctx, inventory, toolsCalled, opts = {}) {
  if (!toolsCalled.includes("get_workspace_inventory")) {
    toolsCalled.push("get_workspace_inventory");
  }
  if (!toolsCalled.includes("get_all_company_documents")) {
    toolsCalled.push("get_all_company_documents");
  }
  const mode = opts.mode || "count";
  const corpusName = String(
    ctx.corpusName || ctx.objectName || ctx.companyName || "",
  ).trim() || null;
  const deptName = opts.departmentName
    ? String(opts.departmentName).trim()
    : null;
  const categoryName = opts.categoryName
    ? String(opts.categoryName).trim()
    : null;
  const parsedView = parseDocsListView(opts.text || "");
  const viewCategories = Array.isArray(opts.view?.categories) && opts.view.categories.length
    ? opts.view.categories
    : parsedView.categories;
  if (categoryName && !viewCategories.some((c) => fold(c) === fold(categoryName))) {
    viewCategories.push(categoryName);
  }
  const view = {
    showSchedule: Boolean(opts.view?.showSchedule ?? parsedView.showSchedule),
    showStatus: Boolean(opts.view?.showStatus ?? parsedView.showStatus),
    categories: viewCategories,
    highlightCategories: Array.isArray(opts.view?.highlightCategories) && opts.view.highlightCategories.length
      ? opts.view.highlightCategories
      : (parsedView.highlightCategories?.length
        ? parsedView.highlightCategories
        : []),
    scheduleScope: opts.view?.scheduleScope || parsedView.scheduleScope || null,
  };
  const allDocs = get_all_company_documents(ctx);

  const mapDoc = (d) => ({
    id: d.id,
    title: d.title || d.name || "—",
    status: d.status || null,
    departmentName: d.departmentName || null,
    category: d.category || null,
    folder: d.parentFolderName || null,
    anchorAt: d.anchorAt || null,
    anchorFinishAt: d.anchorFinishAt || null,
  });

  const matchDept = (d, wantRaw) => {
    const fd = fold(d.departmentName);
    const want = fold(wantRaw);
    if (!want) return true;
    if (fd === want) return true;
    return expandDepartmentNameTokens(wantRaw).includes(fd)
      || expandDepartmentNameTokens(d.departmentName).includes(want);
  };

  const matchCat = (d, wantRaw) => {
    const fc = fold(d.category);
    const want = fold(wantRaw);
    if (!want) return true;
    if (!fc) return false;
    if (fc === want || fc.includes(want) || want.includes(fc)) return true;
    const aliases = expandCategoryNameTokens(wantRaw);
    return aliases.some((a) => fc === a || nearMatchToken(fc, a));
  };

  if (mode === "pick_department") {
    const depts = (Array.isArray(inventory.departments) ? inventory.departments : []).map((d) => ({
      id: d.id || d.name,
      name: d.name,
      folderCount: d.folderCount ?? 0,
      documentCount: d.documentCount ?? 0,
    }));
    return {
      family: "count_documents",
      toolsCalled,
      toolContext: {
        inventory,
        corpusName,
        mode,
        department: null,
        category: null,
        count: depts.length,
        departments: depts,
        documents: [],
        empty: depts.length === 0,
        hint: "Pick a live department to list its documents",
      },
      workspaceInventory: inventory,
      pendingGinaOffer: null,
    };
  }

  if (mode === "pick_category") {
    /** @type {Map<string, { name: string, departmentName: string | null, folderCount: number, documentCount: number }>} */
    const byKey = new Map();
    for (const d of (inventory.departments || [])) {
      for (const cat of (d.categories || [])) {
        const name = String(cat || "").trim();
        if (!name) continue;
        const key = fold(name);
        const prev = byKey.get(key) || {
          name,
          departmentName: d.name || null,
          folderCount: 0,
          documentCount: 0,
        };
        prev.documentCount += Number(d.documentCount) || 0;
        byKey.set(key, prev);
      }
    }
    for (const f of (inventory.folders || [])) {
      const name = String(f.category || "").trim();
      if (!name) continue;
      const key = fold(name);
      const prev = byKey.get(key) || {
        name,
        departmentName: f.departmentName || null,
        folderCount: 0,
        documentCount: 0,
      };
      prev.folderCount += 1;
      prev.documentCount += Number(f.childDocuments) || 0;
      byKey.set(key, prev);
    }
    const categories = [...byKey.values()].map((row) => {
      const docs = allDocs.filter((d) => matchCat(d, row.name));
      return {
        ...row,
        documentCount: docs.length,
        folderCount: row.folderCount,
      };
    }).filter((c) => c.name);

    return {
      family: "count_documents",
      toolsCalled,
      toolContext: {
        inventory,
        corpusName,
        mode,
        department: null,
        category: null,
        count: categories.length,
        categories,
        documents: [],
        empty: categories.length === 0,
        hint: "Pick a live category to list matching documents",
      },
      workspaceInventory: inventory,
      pendingGinaOffer: null,
    };
  }

  let scoped = allDocs;
  if (mode === "list_by_department" || (mode === "count" && deptName)) {
    if (deptName) scoped = allDocs.filter((d) => matchDept(d, deptName));
  }
  if (mode === "list_by_category" && categoryName && !view.highlightCategories.length) {
    scoped = allDocs.filter((d) => matchCat(d, categoryName));
  }
  if (mode === "list_all") {
    scoped = allDocs;
  }

  const highlightCats = Array.isArray(view.highlightCategories)
    ? view.highlightCategories.filter(Boolean)
    : [];
  const isHighlightList = (
    mode === "list_all"
    || mode === "list_by_department"
    || mode === "list_by_category"
  ) && highlightCats.length > 0;

  let filtered = scoped;
  // Resaltar / docs-by-category: deliver ONLY the filtered sheet (no full-corpus duplicate).
  if (isHighlightList) {
    filtered = scoped.filter((d) => highlightCats.some((c) => matchCat(d, c)));
  } else if (view.categories.length) {
    filtered = scoped.filter((d) => view.categories.some((c) => matchCat(d, c)));
  }

  // +horarios / con horarios: timed docs only — exclude flexible (no anchorAt)
  if (view.showSchedule) {
    filtered = filtered.filter((d) => Boolean(d?.anchorAt));
  }
  if (view.showSchedule && view.scheduleScope) {
    const now = ctx.now instanceof Date ? ctx.now : new Date();
    filtered = filterDocsByScheduleScope(filtered, view.scheduleScope, now);
  }

  const sortFn = view.showSchedule
    ? sortDocsScheduledThenFlexible
    : (docs) => [...docs].sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" }));
  const documents = sortFn(filtered.map(mapDoc));
  const isList = mode === "list_all"
    || mode === "list_by_department"
    || mode === "list_by_category";

  /** @type {string[]} */
  const availableCategories = [];
  const seenCat = new Set();
  for (const d of allDocs) {
    const c = String(d.category || "").trim();
    if (!c) continue;
    const key = fold(c);
    if (seenCat.has(key)) continue;
    seenCat.add(key);
    availableCategories.push(c);
  }
  availableCategories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const groups = isList ? groupDocsByDepartment(documents) : [];

  return {
    family: "count_documents",
    toolsCalled,
    toolContext: {
      inventory,
      corpusName,
      mode,
      department: mode === "list_by_category" ? null : deptName,
      category: categoryName,
      count: documents.length,
      documents,
      filteredDocuments: [],
      groups,
      view,
      availableCategories,
      departments: [],
      categories: [],
      empty: documents.length === 0,
      emptyFiltered: false,
      deferredCategoryHighlight: isHighlightList,
      highlightDelayMs: isHighlightList ? 2000 : 0,
      emptyReason: documents.length === 0 ? "no_documents" : null,
      listAll: isList,
      hint: isList
        ? (isHighlightList
          ? `Filtered document list with deferred category highlight (${mode})`
          : `Live document list (${mode})`)
        : (deptName
          ? `Live document count for department ${deptName}`
          : "Live document count for the active corpus"),
    },
    workspaceInventory: inventory,
    pendingGinaOffer: null,
  };
}

/**
 * Build deterministic folder-count reply for a corpus or department.
 * @param {object} ctx
 * @param {object} inventory
 * @param {string[]} toolsCalled
 * @param {{ departmentName?: string | null, fromFocus?: boolean }} [opts]
 */
function buildCountFoldersFamily(ctx, inventory, toolsCalled, opts = {}) {
  if (!toolsCalled.includes("get_workspace_inventory")) {
    toolsCalled.push("get_workspace_inventory");
  }
  const corpusName = String(
    ctx.corpusName || ctx.objectName || ctx.companyName || "",
  ).trim() || null;
  const deptName = opts.departmentName
    ? String(opts.departmentName).trim()
    : null;
  const allFolders = Array.isArray(inventory.folders) ? inventory.folders : [];
  const folders = (deptName
    ? allFolders.filter((f) => {
      const fd = fold(f.departmentName);
      const want = fold(deptName);
      if (fd === want) return true;
      return expandDepartmentNameTokens(deptName).includes(fd)
        || expandDepartmentNameTokens(f.departmentName).includes(want);
    })
    : allFolders
  ).map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category || null,
    departmentName: f.departmentName || null,
    documentCount: f.childDocuments ?? 0,
    hasSchedule: Boolean(f.hasSchedule),
  }));

  return {
    family: "count_folders",
    toolsCalled,
    toolContext: {
      inventory,
      corpusName,
      department: deptName,
      count: folders.length,
      folders,
      empty: folders.length === 0,
      emptyReason: folders.length === 0 ? "no_folders" : null,
      fromFocus: Boolean(opts.fromFocus),
      hint: deptName
        ? `Live folder count for department ${deptName}`
        : "Live folder count for the active corpus",
    },
    workspaceInventory: inventory,
    pendingGinaOffer: null,
  };
}

/**
 * Build deterministic category-count reply for a corpus or department.
 * Categories come from live dept subcategories + folder.category labels.
 * @param {object} ctx
 * @param {object} inventory
 * @param {string[]} toolsCalled
 * @param {{ departmentName?: string | null }} [opts]
 */
function buildCountCategoriesFamily(ctx, inventory, toolsCalled, opts = {}) {
  if (!toolsCalled.includes("get_workspace_inventory")) {
    toolsCalled.push("get_workspace_inventory");
  }
  const corpusName = String(
    ctx.corpusName || ctx.objectName || ctx.companyName || "",
  ).trim() || null;
  const deptName = opts.departmentName
    ? String(opts.departmentName).trim()
    : null;
  const depts = Array.isArray(inventory.departments) ? inventory.departments : [];
  const folders = Array.isArray(inventory.folders) ? inventory.folders : [];

  const scopedDepts = deptName
    ? depts.filter((d) => {
      const dn = fold(d.name);
      const want = fold(deptName);
      if (dn === want) return true;
      return expandDepartmentNameTokens(deptName).includes(dn)
        || expandDepartmentNameTokens(d.name).includes(want);
    })
    : depts;

  const scopedFolders = deptName
    ? folders.filter((f) => {
      const fd = fold(f.departmentName);
      const want = fold(deptName);
      if (fd === want) return true;
      return expandDepartmentNameTokens(deptName).includes(fd)
        || expandDepartmentNameTokens(f.departmentName).includes(want);
    })
    : folders;

  /** @type {Map<string, { name: string, departmentName: string | null, folderCount: number, documentCount: number }>} */
  const byKey = new Map();

  const upsert = (rawName, departmentName) => {
    const name = String(rawName || "").trim();
    if (!name) return;
    const key = `${fold(departmentName || "")}::${fold(name)}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name,
        departmentName: departmentName || null,
        folderCount: 0,
        documentCount: 0,
      });
    }
  };

  for (const d of scopedDepts) {
    for (const cat of (d.categories || [])) {
      upsert(cat, d.name);
    }
  }
  for (const f of scopedFolders) {
    if (f.category) upsert(f.category, f.departmentName || deptName);
  }

  for (const f of scopedFolders) {
    const cat = String(f.category || "").trim();
    if (!cat) continue;
    const key = `${fold(f.departmentName || deptName || "")}::${fold(cat)}`;
    const row = byKey.get(key);
    if (!row) continue;
    row.folderCount += 1;
    row.documentCount += Number(f.childDocuments) || 0;
  }

  // Corpus-wide without dept: also merge categories that share the same name across depts?
  // Keep per-department identity when no dept filter so bullets stay honest.
  let categories = Array.from(byKey.values());
  if (!deptName) {
    // Collapse same category name across depts for a cleaner total count
    /** @type {Map<string, { name: string, departmentName: string | null, folderCount: number, documentCount: number }>} */
    const byName = new Map();
    for (const row of categories) {
      const k = fold(row.name);
      const prev = byName.get(k);
      if (!prev) {
        byName.set(k, { ...row, departmentName: null });
      } else {
        prev.folderCount += row.folderCount;
        prev.documentCount += row.documentCount;
      }
    }
    categories = Array.from(byName.values());
  }

  categories.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return {
    family: "count_categories",
    toolsCalled,
    toolContext: {
      inventory,
      corpusName,
      department: deptName,
      count: categories.length,
      categories,
      empty: categories.length === 0,
      emptyReason: categories.length === 0 ? "no_categories" : null,
      hint: deptName
        ? `Live category count for department ${deptName}`
        : "Live category count for the active corpus",
    },
    workspaceInventory: inventory,
    pendingGinaOffer: null,
  };
}

/**
 * Recent chat suggests the last assistant offer was a folder docs list
 * (so "sí" may re-run list_folder). Otherwise pending is stale.
 * @param {object} ctx
 */
export function recentWasFolderDocsOffer(ctx = {}) {
  const recent = Array.isArray(ctx.recentText) ? ctx.recentText : [];
  // No history (immediate "sí" after folder list in same turn stack) → allow pending.
  if (!recent.length) return true;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const t = fold(recent[i]);
    if (!t) continue;
    if (/^(si|sí|ok|okay|vale|claro|perfecto|de acuerdo|yes|yep|yeah|dale|va)([!?.\s]*)$/.test(t)) {
      continue;
    }
    if (
      /\b(espera.*(buscar|momento)|aqui tienes los?\s+\d+\s+documento|documentos?\s+(del|de|en)\b|folder\s+\w+|caja\s+\w+)\b/.test(t)
      || /\b(dame|muestra|entreg)\w*.*\bdocumentos?\b/.test(t)
    ) {
      return true;
    }
    // Explicit other topics → do not revive list_folder
    if (
      /\b(cuant\w*\s+depart|departament|inventario|workspace|corpus|horarios?\s+de\s+hoy|en\s+general)\b/.test(t)
    ) {
      return false;
    }
    // First substantive recent turn was not a folder offer
    return false;
  }
  return false;
}

/**
 * "Dame todos los documentos del {folder}" — list children of a live folder (no dept required).
 * Does NOT steal "revisar documentos de {departamento}" (that stays department review).
 * @param {string} q folded or raw
 */
export function wantsFolderDocsList(q) {
  const body = fold(q).replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body) return false;
  // Corpus-wide list — handled by count_documents list_all, not folder lookup
  if (wantsCorpusDocsListAll(body)) return false;
  if (wantsDocsByDepartmentBrowse(body) || wantsDocsByCategoryBrowse(body)) return false;
  // Strong deliver/list verbs + documentos + del/de/en
  if (/\b(dame|muestra|muestrame|entreg\w*|lista\w*|listame|show|give)\b/.test(body)
    && /\bdocumentos?\b/.test(body)
    && /\b(del|de|en)\b/.test(body)) {
    return true;
  }
  if (/\b(todos|todas)\s+(los|las)\s+documentos?\s+(del|de|en)\b/.test(body)) return true;
  return false;
}

/**
 * Build deterministic folder children reply.
 */
function buildFolderDocsFamily(ctx, inventory, toolsCalled, folderHit, opts = {}) {
  const summary = get_folder_children_summary(ctx, folderHit.id);
  toolsCalled.push("get_folder_children_summary");
  if (summary?.error) {
    clearPendingGinaOffer();
    return {
      family: "folder_summary",
      toolsCalled,
      toolContext: {
        empty: true,
        listAll: true,
        folderName: folderHit.name,
        departmentName: folderHit.departmentName || null,
        category: folderHit.category || null,
        documents: [],
        aggregated: { total: 0, completed: 0, inProgress: 0, notStarted: 0, pastDue: 0 },
        pendingOffer: null,
      },
      workspaceInventory: inventory,
      pendingGinaOffer: null,
    };
  }
  const offer = { type: "list_folder", folderId: folderHit.id };
  if (!opts.skipPendingOffer) setPendingGinaOffer(offer);
  return {
    family: "folder_summary",
    toolsCalled,
    toolContext: {
      ...summary,
      listAll: true,
      empty: (summary.aggregated?.total || summary.documents?.length || 0) === 0,
      pendingOffer: offer,
    },
    workspaceInventory: inventory,
    pendingGinaOffer: offer,
  };
}

/**
 * User wants to review / list documents of a department (not only "today" focus).
 * @param {string} q folded
 */
export function wantsDepartmentDocsReview(q) {
  const body = fold(q).replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body) return false;
  if (/^todos$|^todas$|^all$/.test(body)) return true;
  if (/^(entreg\w*|dame|muestra\w*|lista\w*|show)\s+todos\b/.test(body)) return true;
  if (/\b(revisar|revisemos|ver|mira|mostrar|muestra|muestrame|listar|lista|listame|entreg|dame)\w*.*\bdocument/.test(body)) {
    return true;
  }
  if (/\bdocumentos?\s+(de|del|en|para)\b/.test(body)) return true;
  if (/\b(todos|todas)\s+(los|las)\s+documentos?\b/.test(body)) return true;
  if (/\bentreg\w*.*\btodos\b/.test(body)) return true;
  if (/\b(quiero\s+revisar|vamos\s+a\s+revisar|revisemos)\b/.test(body) && /\bdocument/.test(body)) {
    return true;
  }
  if (/\b(show|list|give)\s+(me\s+)?(all\s+)?(the\s+)?documents?\b/.test(body)) return true;
  if (/\breview\s+(the\s+)?documents?\b/.test(body)) return true;
  return false;
}

/**
 * Short follow-ups that stay in tools when a department is already in context.
 * @param {string} q
 */
export function isDeptScopedFollowUp(q) {
  const body = fold(q).replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body) return false;
  if (wantsDepartmentDocsReview(body)) return true;
  if (/\b(horarios?|agenda|schedule)\b/.test(body)) return true;
  if (/\b(categor\w*|folders?|status)\b/.test(body)) return true;
  if (/\bexpand(ir|e)?\b/.test(body)) return true;
  return false;
}

/**
 * Recent turns mentioned today / hoy (prefer today-scoped tools).
 * @param {object} ctx
 */
function recentWasTodayScope(ctx) {
  if (ctx.priorTodayScope) return true;
  const recent = Array.isArray(ctx.recentText) ? ctx.recentText : [];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const t = fold(recent[i]);
    if (/\bhoy\b|\btoday\b|enfocarme\s+hoy|focus\s+today/.test(t)) return true;
  }
  return false;
}

/**
 * Entire utterance is basically a live department name (or alias).
 * @param {object} ctx
 * @param {string} text
 */
export function isBareDepartmentUtterance(ctx, text) {
  const body = fold(text).replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body || body.split(/\s+/).length > 3) return false;
  const hit = matchDepartmentInText(ctx, body);
  if (!hit) return false;
  const tokens = expandDepartmentNameTokens(hit.name);
  return tokens.includes(body) || fold(hit.name) === body;
}

/**
 * Resolve department from current text, bare name, or recent turns.
 * @param {object} ctx
 * @param {string} text
 */
function resolveDepartmentForReview(ctx, text) {
  let hit = matchDepartmentInText(ctx, text);
  if (hit) return hit;
  if (isBareDepartmentUtterance(ctx, text)) {
    return matchDepartmentInText(ctx, fold(text).replace(/^gina\b[\s,:!-]*/, "").trim());
  }
  const recent = Array.isArray(ctx.recentText) ? ctx.recentText : [];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    hit = matchDepartmentInText(ctx, recent[i]);
    if (hit) return hit;
  }
  if (ctx.priorDepartment) {
    hit = matchDepartmentInText(ctx, String(ctx.priorDepartment));
    if (hit) return hit;
  }
  return null;
}

/**
 * Deterministic department corpus reply (empty → cero datos; else list all docs).
 * Optional live category/folder filters (human selector mirror).
 */
function buildDepartmentDocsFamily(ctx, inventory, toolsCalled, deptHit, extra = {}) {
  const stats = getDepartmentCorpusStats(ctx, deptHit.name)
    || getDepartmentCorpusStats(ctx, deptHit.id);
  toolsCalled.push("get_department_corpus_stats");
  const category = extra.category
    || matchLiveCategoryInText(ctx, extra.text || "", deptHit.name)
    || null;
  const folderHit = extra.folder
    ? { name: extra.folder, id: extra.folderId || null }
    : matchLiveFolderInText(ctx, extra.text || "", deptHit.name);
  const emptyCorpus = Boolean(
    stats?.empty
    || (stats && stats.folderCount === 0 && stats.documentCount === 0),
  );
  if (emptyCorpus && !category && !folderHit) {
    return {
      family: "department",
      toolsCalled,
      toolContext: {
        department: deptHit.name,
        documents: [],
        empty: true,
        listAll: true,
        folderCount: stats?.folderCount || 0,
        documentCount: 0,
        categoryCount: stats?.categoryCount || 0,
        categories: stats?.categories || [],
        filters: {
          department: deptHit.name,
          category: null,
          folder: null,
        },
      },
      workspaceInventory: inventory,
    };
  }
  const docs = filterDocumentsByDepartmentAndCategory(
    ctx,
    deptHit.name,
    category || "",
    folderHit?.name || "",
  );
  toolsCalled.push("filter_department");
  return {
    family: "department",
    toolsCalled,
    toolContext: {
      department: deptHit.name,
      documents: docs,
      empty: docs.length === 0,
      listAll: true,
      folderCount: stats?.folderCount || 0,
      documentCount: docs.length,
      categoryCount: stats?.categoryCount || 0,
      categories: stats?.categories || [],
      filters: {
        department: deptHit.name,
        category: category || null,
        folder: folderHit?.name || null,
        folderId: folderHit?.id || null,
      },
    },
    workspaceInventory: inventory,
  };
}

/**
 * Longest whole-token title match inside query. Ignores 1–2 char names
 * (avoids folder "N" matching inside "enfocarme").
 * @param {string} foldedQuery
 * @param {{ id: string, name?: string | null }[]} items
 * @returns {string | null}
 */
function pickBestTitleMatch(foldedQuery, items) {
  const q = fold(foldedQuery);
  if (!q) return null;
  let best = null;
  let bestLen = 0;
  for (const item of items) {
    const name = fold(item?.name || "");
    if (!name || name.length < 3) continue;
    if (!q.includes(name)) continue;
    // Prefer whole-token / bounded match when possible
    const bounded = new RegExp(
      `(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}([^\\p{L}\\p{N}]|$)`,
      "u",
    );
    const ok = bounded.test(q) || q.includes(` ${name}`) || q.endsWith(name) || q.startsWith(name);
    if (!ok && name.length < 6) continue;
    if (name.length > bestLen) {
      best = item.id;
      bestLen = name.length;
    }
  }
  return best;
}

/** Explicit work intents — bare "hoy" alone is NOT enough ("hoy no" / charla). */
const GINA_WORK_CUE_RE = /\b((que|qué)\s+(tengo|hay|tenemos)|(dime|muestra|muestrame|entreg|lista|revis)\w*.*\b(hoy|manana|mañana)|para\s+hoy|vencid\w*|atrasad\w*|conflicto\w*|incomplet\w*|sin completar|abre|abrir|\bopen\b|enfoca|enfoque|enfocarme|expandir|expand|departamento\w*|folder\w*|documento\w*|categor\w*|\bstatus\b|progreso|avance|balance|cierre|estatus|estado|\bscope\b|panorama|dentro\s+de\s+\d+\s+d|hasta\s+(manana|mañana)|esta\s+semana|blogs?|schedule|horario\w*|agenda|reporte|resumen|pendiente|marcar|posponer|aprende|significa|past\s*due|incomplete|conflict|what\s+(do\s+i\s+)?have|show\s+me\s+today|focus\s+today|how('?s|\s+is|\s+was)?\s+(my\s+)?day|daily\s+report)\b/;

/**
 * Daily report / day summary intent (folded text; accents already stripped).
 * @param {string} text
 */
export function isGinaDailyReportUtterance(text) {
  const q = fold(text);
  if (!q) return false;
  const body = q.replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body) return false;

  // Any mention of "reporte" (Gina dame el reporte, reporte general, …)
  if (/\breporte\b/.test(body)) return true;

  // Bare triggers / buttons
  if (/^(reporte|resumen|balance|mi\s+dia)$/.test(body)) return true;

  // Noun + time frame
  if (/\b(reporte|resumen|balance|cierre|estatus|estado|avance|progreso)\b/.test(body)
    && /\b(general|del\s+dia|de\s+hoy|de\s+la\s+jornada|de\s+actividades|de\s+mis\s+proyectos)\b/.test(body)) {
    return true;
  }

  // Conversational
  if (/\bcomo\s+(vamos|va\s+el\s+dia|va\s+hoy|estuvo\s+el\s+dia|esta\s+mi\s+dia|esta\s+el\s+dia)\b/.test(body)) {
    return true;
  }
  if (/\bque\s+(hicimos|hemos\s+hecho|logramos|quedo\s+pendiente|documentos\s+modifique)\b.*\bhoy\b/.test(body)) {
    return true;
  }
  if (/\bcual\s+es\s+el\s+reporte\b/.test(body)) return true;
  if (/\bcuanto\s+avanzamos\s+hoy\b/.test(body)) return true;
  if (/\bcuantas\s+tareas\s+complete(\s+hoy)?\b/.test(body)) return true;

  // Agenda / day view
  if (/\bagenda\s+de\s+hoy\b/.test(body)) return true;
  if (/\bcomo\s+estuvo\s+mi\s+agenda\b/.test(body)) return true;
  if (/\bver\s+mi\s+dia\b/.test(body) || /\bmi\s+dia\s+hoy\b/.test(body)) return true;

  // Delivery commands
  if (/\b(dame|muestra|muestrame|entregame|genera|generar)\b/.test(body)
    && /\b(reporte|resumen|balance)\b/.test(body)) {
    return true;
  }

  // Pending nudge recovery phrases
  if (/\b(que|qué)\s+querias\s+(decirme|decir)\b/.test(body)) return true;
  if (/\b(que|qué)\s+tenias\s+pendiente\b/.test(body)) return true;
  if (/\bpendiente\s+(del\s+)?reporte\b/.test(body)) return true;

  // English
  if (/\bdaily\s+report\b/.test(body)) return true;
  if (/\bhow('?s|\s+is|\s+was)\s+(my\s+)?day\b/.test(body)) return true;
  if (/\bwhat\s+did\s+we\s+(do|achieve)\s+today\b/.test(body)) return true;
  if (/\b(show|give|generate)\b.*\b(daily\s+)?(report|summary)\b/.test(body)) return true;
  if (/\btoday('?s)?\s+(report|summary|progress)\b/.test(body)) return true;

  return false;
}

/**
 * Clear goodbye / later / rest — wins even if the text mentions "hoy".
 * @param {string} body folded
 */
function isGinaGoodbyeBody(body) {
  if (!body) return false;
  if (/\b(buenas\s+noches|hasta\s+luego|hasta\s+pronto|nos\s+vemos|que\s+descanses|descansa|voy\s+a\s+(dormir|descansar)|me\s+voy|he\s+dicho\s+hasta\s+luego)\b/.test(body)) {
    return true;
  }
  if (/\bhoy\s+no\b/.test(body) && /\b(rato|luego|despues|gracias|hasta)\b/.test(body)) {
    return true;
  }
  if (/^(gracias\s+)?(buenas\s+noches|adios|chao|bye)([!?.\s]*)$/.test(body)) {
    return true;
  }
  return false;
}

/**
 * Gibberish / non-intent utterances must not fall through to default_overview.
 * @param {string} text
 */
export function isGinaUnclearUtterance(text) {
  const raw = String(text || "").trim();
  if (!raw) return true;

  const letters = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

  if (letters.length === 0) return true;
  if (letters.length <= 1) return true;
  // xxx, aaa, 1111…
  if (/^(.)\1+$/iu.test(letters)) return true;
  // Short keyboard mash without vowels (and no digits)
  const lower = letters.toLowerCase();
  if (letters.length <= 6 && !/[aeiou]/.test(lower) && !/\d/.test(lower)) return true;
  // Longer mash: mostly consonants, no spaces (avoid flagging "si"/"no"/"ok")
  if (
    letters.length >= 5
    && letters.length <= 12
    && !/\s/.test(raw.trim())
    && !/[aeiou]{2}/.test(lower)
    && (lower.match(/[aeiou]/g) || []).length <= 1
    && !/\d/.test(lower)
  ) {
    return true;
  }
  return false;
}

/**
 * User declines help / ends the turn — no scope tools, no visualization.
 * @param {string} text
 */
export function isGinaDismissUtterance(text) {
  const q = fold(text);
  if (!q) return false;

  const body = q.replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body) return false;

  // Goodbye / rest first — overrides bare "hoy" noise
  if (isGinaGoodbyeBody(body)) return true;

  if (GINA_WORK_CUE_RE.test(q)) return false;

  if (
    /^(no(\s+en)?\s+nada(\s+gracias)?|nada(\s*,?\s*gracias)?|no\s*,?\s*gracias|no\s+por\s+ahora|ahora\s+no|luego|despues|mas\s+tarde|nothing(\s+thanks)?|no\s+thanks|not\s+now|i'?m\s+good|im\s+good|all\s+good|adios|chao|bye|ok\s+bye|okay\s+bye|bueno\s+chao|nos\s+vemos|hasta\s+luego|hasta\s+pronto)([!?.\s]*)$/.test(body)
  ) {
    return true;
  }

  // Soft decline / goodbye phrases (short)
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length <= 10) {
    if (/\b(no|nada)\b/.test(body) && /\b(gracias|thanks|nada)\b/.test(body) && !GINA_WORK_CUE_RE.test(body)) {
      return true;
    }
    if (/\b(chao|adios|bye)\b/.test(body) && !GINA_WORK_CUE_RE.test(body)) {
      return true;
    }
    if (/\b(ok|okay|vale)\b/.test(body) && /\b(nada|bye|chao)\b/.test(body)) {
      return true;
    }
  }

  return false;
}

/**
 * Tokens that can follow "cómo estás" without being a folder/dept name.
 * @param {string} after folded remainder after cómo estás / qué tal
 */
function isGinaHowAreYouFiller(after) {
  const a = fold(after).replace(/[!?.]+$/g, "").trim();
  if (!a) return true;
  if (/^(hoy|tu dia|el dia|usted|vos|tu|de animo)$/.test(a)) return true;
  const toks = a.split(/\s+/).filter(Boolean);
  if (toks.length > 5) return false;
  const soft = /^(tu|usted|vos|te|ti|primeramente|primero|ahora|hoy|de|verdad|realmente|por|favor|estas|esta|bien|mal|que|tal|y|o|muy|super)$/;
  return toks.every((t) => soft.test(t));
}

/**
 * Short yes/ok — continue previous assistant offer (not a greeting).
 * @param {string} text
 */
export function isGinaAffirmationUtterance(text) {
  const q = fold(text);
  if (!q) return false;
  const body = q.replace(/^gina\b[\s,:!-]*/, "").trim();
  return /^(si|sí|ok|okay|vale|claro|perfecto|de acuerdo|yes|yep|yeah|dale|va|claro que si|claro que sí)([!?.\s]*)$/.test(body);
}

/**
 * Casual chat (greetings / how-are-you) — must not trigger today/incomplete overview.
 * Input is matched on folded text. "como esta trends" is NOT social (named target).
 * @param {string} text
 */
export function isGinaSocialUtterance(text) {
  const q = fold(text);
  if (!q) return false;
  if (GINA_WORK_CUE_RE.test(q)) return false;
  if (isGinaDismissUtterance(text)) return false;
  if (isGinaAffirmationUtterance(text)) return false;

  const body = q.replace(/^gina\b[\s,:!-]*/, "").trim();
  if (!body) return true;

  if (/^(hola|hey|hi|hello|holi|buenas|saludos|buenos?\s+dias?|buenas?\s+tardes?|buenas?\s+noches?)([!?.\s]*)$/.test(body)) {
    return true;
  }

  if (/^(gracias|thanks|thank you|ty)([!?.\s]*)$/.test(body)) {
    return true;
  }

  // "necesito saber cómo estás…" / "dime cómo estás"
  if (
    /\b(necesito saber|quiero saber|dime|cuentame|cuéntame)\b/.test(body)
    && /\b(como est|how are you|que tal)\b/.test(body)
  ) {
    return true;
  }

  // "como estas" / "que tal" alone or with soft address — not "como esta Trends"
  const howAre = body.match(/\b(?:como estas?|how are you|how'?s it going|que tal)\b(.*)$/);
  if (howAre) {
    const after = fold(howAre[1] || "").replace(/[!?.]+$/g, "").trim();
    if (isGinaHowAreYouFiller(after)) return true;
    // Likely named target (folder/dept) → not social
    return false;
  }

  // Short greeting + smalltalk ("hola como estas", "hey que tal tu dia")
  if (/\b(hola|hey|hi|hello|buenas|bueno)\b/.test(body)) {
    const words = body.split(/\s+/).filter(Boolean);
    if (words.length <= 14) {
      if (
        /\b(como est|que tal|how are|todo bien|tal tu dia|primeramente)\b/.test(body)
        || words.length <= 4
      ) {
        return true;
      }
    }
  }

  if (/\b(que tal tu dia|como va tu dia)\b/.test(body)) {
    return true;
  }

  return false;
}

/**
 * Apply live name scope (dept / category / folder) with ambiguity gate.
 * Mirrors Documents selectors: department → category → folder.
 */
function resolveScopeFilters(ctx, remainder, toolsCalled) {
  const deptHit = matchDepartmentInText(ctx, remainder);
  if (deptHit) {
    const category = matchLiveCategoryInText(ctx, remainder, deptHit.name);
    const folderHit = matchLiveFolderInText(ctx, remainder, deptHit.name);
    return {
      filters: {
        department: deptHit.name,
        category: category || null,
        folder: folderHit?.name || null,
        folderId: folderHit?.id || null,
      },
      ambiguity: null,
    };
  }

  const scoped = extractScopedName(remainder);
  if (!scoped) return { filters: {}, ambiguity: null };

  const amb = resolveNameAmbiguity(ctx, scoped);
  toolsCalled.push("resolve_name_ambiguity");
  if (amb.ambiguous) {
    return {
      filters: {},
      ambiguity: {
        intro: fold(scoped)
          ? `"${scoped}" aparece en más de un sitio (si hay categoría, hay departamento).`
          : "Ese nombre aparece en más de un sitio.",
        needle: amb.needle,
        options: amb.options.slice(0, 3),
      },
    };
  }
  if (amb.options.length === 1) {
    const o = amb.options[0];
    return {
      filters: {
        department: o.department || null,
        category: o.kind === "category" ? o.category : (o.category || null),
        folder: o.kind === "category" ? null : (o.folderName || amb.needle),
        folderId: o.folderId || null,
      },
      ambiguity: null,
    };
  }

  // Folder-only live match (no dept named)
  const folderOnly = matchLiveFolderInText(ctx, remainder, null);
  if (folderOnly) {
    return {
      filters: {
        department: folderOnly.departmentName || null,
        category: folderOnly.category || null,
        folder: folderOnly.name,
        folderId: folderOnly.id,
      },
      ambiguity: null,
    };
  }

  return { filters: {}, ambiguity: null };
}

/**
 * @param {string} text
 * @param {import("./ginaTools.js").GinaToolsContext} ctx
 */
export function runGinaQueryFamily(text, ctx = {}) {
  const q = fold(text);
  const toolsCalled = [];
  const locale = "es";

  const call = (name, fn) => {
    toolsCalled.push(name);
    return fn();
  };

  // Always attach inventory for grounding (caller may also inject)
  const inventory = call("get_workspace_inventory", () => get_workspace_inventory(ctx));

  if (isGinaUnclearUtterance(text)) {
    return {
      family: "unclear",
      toolsCalled,
      toolContext: {
        unclear: true,
        hint: "User message is not a usable request",
      },
      workspaceInventory: inventory,
    };
  }

  if (isGinaDismissUtterance(text)) {
    return {
      family: "dismiss",
      toolsCalled,
      toolContext: {
        dismiss: true,
        hint: "User declined help — close politely with no scope data",
      },
      workspaceInventory: inventory,
    };
  }

  // Daily report (occupied hours + conflicts) — before social so deferred nudge recovers on "hola".
  {
    const reportNow = ctx.now instanceof Date ? ctx.now : new Date();
    const uid = ctx.userId || ctx.authUserId || "anon";
    const pending = getPendingDailyReport(uid, reportNow);
    const pendingRecoverable = pending
      && (pending.status === "deferred" || pending.status === "ready" || pending.status === "queued");
    const wantsDailyReport = isGinaDailyReportUtterance(text)
      || (pendingRecoverable && /^(hola|hey|hi|hello|holi|buenas|saludos)([!?.\s]*)$/.test(
        q.replace(/^gina\b[\s,:!-]*/, "").trim(),
      ));
    const wantsMoveConflicts = /\bmover\s+horarios\s+en\s+conflicto\b/.test(q)
      || /\bmove\s+conflicting\s+schedules?\b/.test(q);
    const wantsKeepConflicts = /\bdejar\s+horarios\s+en\s+conflicto\s+as[ií]\b/.test(q)
      || /\bleave\s+conflicting\s+schedules\b/.test(q);
    const wantsConfirmMove = /\bconfirmar\s+mover\s+horarios\s+en\s+conflicto\b/.test(q)
      || /\bconfirm\s+move\s+conflicting\s+schedules\b/.test(q);
    const wantsSkipMove = /\bsaltar\s+mover\s+horarios\s+en\s+conflicto\b/.test(q)
      || /\bskip\s+moving\s+conflicting\s+schedules\b/.test(q);

    if (wantsConfirmMove) {
      const dailyReport = call("build_gina_daily_report", () => buildGinaDailyReport(ctx));
      return {
        family: "daily_report_move_confirm",
        toolsCalled,
        toolContext: {
          dailyReport,
          proposals: dailyReport.proposals,
          hint: "User confirmed moving conflicting schedules",
        },
        workspaceInventory: inventory,
      };
    }
    if (wantsSkipMove || wantsKeepConflicts) {
      return {
        family: "daily_report_skip_move",
        toolsCalled,
        toolContext: {
          skipMove: true,
          hint: "User skipped moving conflicting schedules",
        },
        workspaceInventory: inventory,
      };
    }
    if (wantsMoveConflicts) {
      const dailyReport = call("build_gina_daily_report", () => buildGinaDailyReport(ctx));
      return {
        family: "daily_report_move",
        toolsCalled,
        toolContext: {
          dailyReport,
          proposals: dailyReport.proposals,
          hint: "Preview move conflicting schedules",
        },
        workspaceInventory: inventory,
      };
    }
    if (wantsDailyReport) {
      const dailyReport = call("build_gina_daily_report", () => buildGinaDailyReport(ctx));
      try {
        markDailyReportOpened(uid, reportNow);
      } catch { /* ignore */ }
      return {
        family: "daily_report",
        toolsCalled,
        toolContext: {
          dailyReport,
          hint: "Daily report: occupied hours + conflicts",
        },
        workspaceInventory: inventory,
      };
    }
  }

  if (isGinaSocialUtterance(text)) {
    return {
      family: "social",
      toolsCalled,
      toolContext: {
        social: true,
        hint: "Casual chat — reply naturally; do not list documents or run scope tools",
      },
      workspaceInventory: inventory,
    };
  }

  if (isGinaAffirmationUtterance(text)) {
    const pending = getPendingGinaOffer() || ctx.pendingGinaOffer || null;
    if (
      pending?.type === "list_folder"
      && pending.folderId
      && recentWasFolderDocsOffer(ctx)
    ) {
      consumePendingGinaOffer();
      const folderHit = {
        id: pending.folderId,
        name: "",
        category: null,
        departmentName: null,
      };
      // Prefer live folder metadata from inventory
      const live = (inventory.folders || []).find((f) => f.id === pending.folderId);
      if (live) {
        folderHit.name = live.name;
        folderHit.category = live.category || null;
        folderHit.departmentName = live.departmentName || null;
      }
      return buildFolderDocsFamily(ctx, inventory, toolsCalled, folderHit, { skipPendingOffer: true });
    }
    // Stale list_folder from another topic — do not revive it.
    if (pending?.type === "list_folder") {
      clearPendingGinaOffer();
    }
    return {
      family: "confirm_continue",
      toolsCalled,
      toolContext: {
        confirmContinue: true,
        inventory,
        hint: "User said yes/ok to the previous offer — continue that thread with inventory",
      },
      workspaceInventory: inventory,
    };
  }

  // Confirm / skip recovery first (so "Confirmar marcar…" does not hit preview mark).
  {
    const wantsSkip = /\bsaltarlo\b/.test(q)
      || /\bomitir(\s+recuperaci[oó]n(\s+de\s+horario)?)?\b/.test(q)
      || /\bskip\s+schedule\s+recovery\b/.test(q);
    const wantsConfirmMark = /\bconfirmar\s+marcar\s+vencid/.test(q)
      || /\bconfirm\s+mark\s+passed\s+slots\s+as\s+past\s+due\b/.test(q);
    const wantsConfirmCascade = /\bconfirmar\s+reagendar\s+en\s+cadena\b/.test(q)
      || /\bconfirm\s+cascade\s+reschedule\b/.test(q);
    if (wantsSkip) {
      return {
        family: "schedule_recovery_skip",
        toolsCalled,
        toolContext: {
          skipRecovery: true,
          hint: "User skipped schedule recovery",
        },
        workspaceInventory: inventory,
      };
    }
    if (wantsConfirmMark || wantsConfirmCascade) {
      const today = call("get_today_scope", () => get_today_scope(ctx, { includeCompleted: false }));
      return {
        family: wantsConfirmMark ? "schedule_recovery_mark_confirm" : "schedule_recovery_postpone_confirm",
        toolsCalled,
        toolContext: {
          ...today,
          recoveryIntent: wantsConfirmMark ? "mark_past_due" : "postpone_schedule",
          markableSlots: today.markableSlots,
          passedSlots: today.passedSlots,
          hint: wantsConfirmMark
            ? "User confirmed mark past due — host should write status"
            : "User confirmed cascade — host should write new schedules",
        },
        workspaceInventory: inventory,
      };
    }
  }

  // Recovery brief gate (notify chip) — show late docs with highlights before a/b.
  {
    const wantsBrief = /\bassistance\s+requiere\s+informarte\s+algo\b/.test(q)
      || /\bassistance\s+has\s+something\s+to\s+tell\s+you\b/.test(q);
    if (wantsBrief) {
      const today = call("get_today_scope", () => get_today_scope(ctx, { includeCompleted: false }));
      return {
        family: "schedule_recovery_brief",
        toolsCalled,
        toolContext: {
          ...today,
          recoveryPhase: "brief",
          highlightPassedSlots: true,
          hint: "User opened the schedule recovery brief — show late slots with highlights",
        },
        workspaceInventory: inventory,
      };
    }
  }

  // Schedule recovery fork: preview intent (mutations only after confirm).
  {
    const wantsMarkPastDue = !/\bconfirm/.test(q) && (
      /\bmarcar\s+(como\s+)?vencid/.test(q)
      || /\bmark\s+(today'?s\s+)?(passed\s+)?(slots?\s+)?as\s+past\s+due\b/.test(q)
      || (/\bhorarios\s+pasados\s+de\s+hoy\b/.test(q) && /\bmarcar\b/.test(q))
    );
    const wantsPostpone = !/\bconfirm/.test(q) && (
      /\bposponer\s+horario\b/.test(q)
      || /\bpostpone\s+(today'?s\s+)?(passed\s+)?schedule\b/.test(q)
      || (/\bmanteniendo\s+el\s+orden\b/.test(q) && /\bposponer\b/.test(q))
    );
    if (wantsMarkPastDue || wantsPostpone) {
      const today = call("get_today_scope", () => get_today_scope(ctx, { includeCompleted: false }));
      return {
        family: wantsMarkPastDue ? "schedule_recovery_mark" : "schedule_recovery_postpone",
        toolsCalled,
        toolContext: {
          ...today,
          passedSlots: today.passedSlots,
          markableSlots: today.markableSlots,
          firstPendingTitle: today.firstPendingTitle,
          hint: wantsMarkPastDue
            ? "User chose mark passed slots as past due (preview only; no write yet)"
            : "User chose postpone/cascade schedule (preview only; no write yet)",
        },
        workspaceInventory: inventory,
      };
    }
  }

  // Quantitative: how many folders (corpus or department).
  if (wantsCountFolders(text)) {
    clearPendingGinaOffer();
    const deptHit = matchDepartmentInText(ctx, text);
    return buildCountFoldersFamily(ctx, inventory, toolsCalled, {
      departmentName: deptHit?.name || null,
      fromFocus: false,
    });
  }

  // Quantitative: how many categories (corpus or department).
  if (wantsCountCategories(text)) {
    clearPendingGinaOffer();
    const deptHit = matchDepartmentInText(ctx, text);
    return buildCountCategoriesFamily(ctx, inventory, toolsCalled, {
      departmentName: deptHit?.name || null,
    });
  }

  // Named category without saying "categoría" (blogs / social media / redes sociales).
  {
    const deptHit = matchDepartmentInText(ctx, text);
    const catHit = matchNamedCategoryInText(ctx, text, deptHit?.name || null)
      || matchNamedCategoryInText(ctx, text, null);
    if (catHit?.name) {
      const deptName = deptHit?.name || catHit.departmentName || null;
      // Explicit "categorías: A, B" layers → count_documents; "Listado completo de Blogs" stays category_scope
      const layeredCats = parseDocsListView(text).categories.length > 0;
      const listDocs = wantsNamedCategoryListDocs(text) && !layeredCats;
      const listFolders = wantsNamedCategoryListFolders(text);
      const countDocs = wantsNamedCategoryCountDocs(text);
      if (listDocs || listFolders || countDocs) {
        clearPendingGinaOffer();
        const mode = listDocs
          ? "list_docs"
          : (listFolders ? "list_folders" : "count_docs");
        return buildCategoryScopeFamily(ctx, inventory, toolsCalled, {
          mode,
          category: catHit.name,
          departmentName: deptName,
        });
      }
    }
  }

  // Quantitative: how many documents (corpus or department) — no named cat/folder.
  if (wantsCountDocuments(text)) {
    clearPendingGinaOffer();
    const deptHit = matchDepartmentInText(ctx, text);
    // "en todos los departamentos" → corpus total, not a single dept filter
    const acrossAllDepts = /\b(todos\s+los\s+departamentos|en\s+total)\b/.test(fold(text));
    return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
      mode: "count",
      departmentName: acrossAllDepts ? null : (deptHit?.name || null),
    });
  }

  // Docs by category syntax (Resaltar / “docs que sean de X”) → full sheet + highlight + filtered.
  // Before bare list_all so “entregame todos los docs que sean de Blogs” is not an unscoped dump.
  // Only fires when a LIVE category resolves — never invent; never steal department review.
  if (wantsDocsByCategorySyntax(text)) {
    const view = parseDocsListView(text);
    /** @type {string[]} */
    let catNames = (view.highlightCategories?.length
      ? view.highlightCategories
      : view.categories).filter(Boolean);
    if (!catNames.length) {
      const hint = extractCategoryHintFromDocsSyntax(text);
      const hit = (hint && matchNamedCategoryInText(ctx, hint, null))
        || matchNamedCategoryInText(ctx, text, null);
      if (hit?.name) catNames = [hit.name];
    } else {
      catNames = catNames
        .map((raw) => matchNamedCategoryInText(ctx, String(raw || "").trim(), null)?.name)
        .filter(Boolean);
    }
    // If the only named entity is a department (Sales/ventas), leave for department review.
    if (!catNames.length) {
      // fall through
    } else {
      clearPendingGinaOffer();
      return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
        mode: "list_all",
        view: {
          ...view,
          categories: catNames,
          highlightCategories: catNames,
        },
        text,
      });
    }
  }

  // Schedule-scope list from post-listado refine chips (before bare list_all / time scopes).
  if (wantsGinaScheduleScopeList(text)) {
    clearPendingGinaOffer();
    const scheduleScope = parseGinaScheduleScope(text);
    return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
      mode: "list_all",
      view: {
        showSchedule: true,
        showStatus: false,
        categories: [],
        highlightCategories: [],
        scheduleScope,
      },
      text,
    });
  }

  // Full corpus document list (before folder-list steals "listado de todos…").
  if (wantsCorpusDocsListAll(text)) {
    clearPendingGinaOffer();
    const view = parseDocsListView(text);
    return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
      mode: "list_all",
      view,
      text,
    });
  }

  // Browse docs by department (menu or filtered table).
  if (wantsDocsByDepartmentBrowse(text)) {
    clearPendingGinaOffer();
    const deptHit = matchDepartmentInText(ctx, text);
    const explicitDept = /\bdepartamento\s*:/.test(fold(text))
      || /\bdocumentos?\s+(del|de|en)\s+departamento\b/.test(fold(text));
    const view = parseDocsListView(text);
    if (deptHit && (explicitDept || /\bdepartamento\b/.test(fold(text)))) {
      return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
        mode: "list_by_department",
        departmentName: deptHit.name,
        view,
        text,
      });
    }
    return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
      mode: "pick_department",
    });
  }

  // Browse docs by category (menu or filtered table).
  if (wantsDocsByCategoryBrowse(text)) {
    clearPendingGinaOffer();
    const catHit = matchNamedCategoryInText(ctx, text, null);
    const explicitCat = /\bcategor[ií]a\s*:/.test(fold(text))
      || /\bdocumentos?\s+(de|del|en)\s+(la\s+)?categor[ií]a\b/.test(fold(text));
    const view = parseDocsListView(text);
    if (catHit?.name && (explicitCat || /\bcategor[ií]a\b/.test(fold(text)))) {
      return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
        mode: "list_by_category",
        categoryName: catHit.name,
        departmentName: catHit.departmentName || null,
        view: {
          ...view,
          categories: view.categories.length ? view.categories : [catHit.name],
        },
        text,
      });
    }
    // Layered "categorías: A, B" without the browse menu phrase → still list_all
    if (view.categories.length) {
      return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
        mode: "list_all",
        view,
        text,
      });
    }
    return buildCountDocumentsFamily(ctx, inventory, toolsCalled, {
      mode: "pick_category",
    });
  }

  // Quantitative: how many departments in this corpus (total / en general).
  if (wantsCountDepartments(text)) {
    clearPendingGinaOffer();
    call("get_workspace_inventory", () => inventory);
    const todayScope = call("get_today_scope", () => get_today_scope(ctx, { includeCompleted: true }));
    const todayDocs = Array.isArray(todayScope?.documents) ? todayScope.documents : [];
    const todayScheduleCount = todayScope?.totalDocumentsToday ?? todayDocs.length;
    const hasTodaySchedules = todayScheduleCount > 0;
    const depts = Array.isArray(inventory.departments) ? inventory.departments : [];
    const corpusName = String(
      ctx.corpusName || ctx.objectName || ctx.companyName || "",
    ).trim() || null;
    return {
      family: "count_departments",
      toolsCalled,
      toolContext: {
        inventory,
        corpusName,
        count: depts.length,
        departments: depts.map((d) => ({
          id: d.id,
          name: d.name,
          folderCount: d.folderCount ?? 0,
          documentCount: d.documentCount ?? 0,
          categories: d.categories || [],
        })),
        hasTodaySchedules,
        todayScheduleCount,
        hint: "Live department count for the active corpus only",
      },
      workspaceInventory: inventory,
      pendingGinaOffer: null,
    };
  }

  // Departments / daily focus (explicit workflow — not "fuera de contexto")
  if (
    /\bdepartamento/.test(q)
    || /\b(que|qué)\s+departamentos?\b/.test(q)
    || (/\benfoque\b/.test(q) && /\b(hoy|tengo|hay|que|qué|cual|cuál|quiero|depart|revis)\w*\b/.test(q))
  ) {
    const folders = call("get_all_company_folders", () => get_all_company_folders(ctx));
    return {
      family: "inventory",
      toolsCalled,
      toolContext: {
        inventory,
        folders,
        hint: "User asks which departments / focus they have",
      },
      workspaceInventory: inventory,
    };
  }

  // Department expand / focus from chips — NOT open a document/folder.
  {
    const wantsExpand = /\bexpand(ir|e)?\b/.test(q)
      || /\bstatus\s+(past_due|in_progress|not_started|reserved|submitted|completed)\b/.test(q)
      || /\bfolder\s+/.test(q)
      || /\bcategor(í|i)a\s+/.test(q);
    const wantsDeptFocus = /\b(enfocarme|enfoca|enfocate|enfócate|focus(\s+today)?\s+on)\b/.test(q)
      || /\bfocus\s+today\s+on\b/.test(q);
    const deptHit = (wantsExpand || wantsDeptFocus) ? matchDepartmentInText(ctx, text) : null;

    if ((wantsExpand || wantsDeptFocus) && deptHit) {
      // Bare "Enfocarme hoy en {Depto}" with zero folders → guide to create a folder first.
      const isBareDeptFocus = wantsDeptFocus && !wantsExpand;
      if (isBareDeptFocus) {
        const stats = getDepartmentCorpusStats(ctx, deptHit.name);
        if (stats && stats.folderCount === 0) {
          clearPendingGinaOffer();
          return buildCountFoldersFamily(ctx, inventory, toolsCalled, {
            departmentName: deptHit.name,
            fromFocus: true,
          });
        }
      }

      /** @type {Record<string, string | boolean | null>} */
      const filters = {
        department: deptHit.name,
        category: null,
        folder: null,
        status: null,
        includeCompleted: false,
      };

      const statusMatch = q.match(/\bstatus\s+(past_due|in_progress|not_started|reserved|submitted|completed)\b/);
      if (statusMatch) {
        filters.status = statusMatch[1];
        filters.includeCompleted = statusMatch[1] === "completed";
      } else if (/\bexpand(ir|e)?\s+status\b/.test(q)) {
        filters.includeCompleted = true;
      }

      const folderMatch = text.match(/\bFolder\s+(.+?)\s+hoy\s+en\b/i)
        || text.match(/\bFolder\s+(.+?)\s+today\s+in\b/i);
      if (folderMatch) {
        filters.folder = folderMatch[1].trim();
        filters.includeCompleted = true;
      }

      const catMatch = text.match(/\bCategor[íi]a\s+(.+?)\s+hoy\s+en\b/i)
        || text.match(/\bCategory\s+(.+?)\s+today\s+in\b/i);
      if (catMatch) {
        const catName = catMatch[1].trim();
        if (!/^(all|todas?)$/i.test(catName)) {
          // Only apply live categories (or uncategorized) — never invent.
          const liveCat = matchLiveCategoryInText(ctx, catName, deptHit.name)
            || matchLiveCategoryInText(ctx, `categoría ${catName}`, deptHit.name);
          const uncat = /\b(uncategorized|sin\s+categor)/i.test(catName);
          filters.category = liveCat || (uncat ? "uncategorized" : catName);
          // If not live and not uncat, still set — get_today_scope returns empty (honest).
          if (!liveCat && !uncat) {
            const stats = getDepartmentCorpusStats(ctx, deptHit.name);
            const known = (stats?.categories || []).some(
              (c) => fold(c) === fold(catName),
            );
            if (!known) filters.category = catName; // empty result, no invent
          }
        }
        filters.includeCompleted = true;
      }

      const toolContext = call("get_today_scope", () => get_today_scope(ctx, filters));
      return {
        family: "today",
        toolsCalled,
        toolContext,
        workspaceInventory: inventory,
      };
    }
  }

  // Find document by partial hierarchy + topic (before focus_open / title match).
  if (isFindDocumentIntent(q)) {
    const hints = parseFindHints(ctx, text);
    toolsCalled.push("search_documents_by_hints");
    if (hints.needsClarify) {
      return {
        family: "find_document",
        toolsCalled,
        toolContext: {
          hints,
          results: [],
          total: 0,
          empty: true,
          needsClarify: true,
          clarifyOptions: hints.clarifyOptions,
          hint: "Ambiguous hierarchy name — ask before searching",
        },
        workspaceInventory: inventory,
      };
    }
    const found = searchDocumentsByHints(ctx, hints);
    return {
      family: "find_document",
      toolsCalled,
      toolContext: {
        ...found,
        needsClarify: false,
        hint: found.empty
          ? "No document matches — be honest"
          : "Document matches for user to open or refine",
      },
      workspaceInventory: inventory,
    };
  }

  // Folder-first: "Dame todos los documentos del plan de negocio" (no dept required).
  // If the remnant is clearly a department name (Sales/ventas), fall through to department review.
  if (wantsFolderDocsList(q)) {
    const hits = matchLiveFoldersByNeedle(ctx, text, { limit: 5 });
    toolsCalled.push("match_live_folders_by_needle");
    const deptHit = matchDepartmentInText(ctx, text);
    const remnant = fold(text)
      .replace(/^gina\b[\s,:!-]*/, "")
      .replace(/\b(dame|muestra|muestrame|entreg\w*|lista\w*|listame|show|give|todos|todas|los|las|documentos?|del|de|en|el|la|un|una|por\s+favor|please)\b/g, " ")
      .replace(/[?!.]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const remnantIsDept = Boolean(
      deptHit
      && remnant
      && (
        fold(deptHit.name) === remnant
        || expandDepartmentNameTokens(deptHit.name).includes(remnant)
        || remnant.includes(fold(deptHit.name))
      ),
    );
    if (!remnantIsDept && hits.length === 1) {
      return buildFolderDocsFamily(ctx, inventory, toolsCalled, hits[0]);
    }
    if (!remnantIsDept && hits.length > 1) {
      clearPendingGinaOffer();
      return {
        family: "name_ambiguity",
        toolsCalled,
        toolContext: {
          ambiguity: {
            intro: "Ese nombre encaja con más de un folder.",
            needle: text,
            options: hits.slice(0, 3).map((h) => ({
              id: `folder:${h.id}`,
              kind: "folder",
              label: h.departmentName
                ? `En ${h.departmentName}: folder ${h.name}`
                : `Folder ${h.name}`,
              department: h.departmentName || null,
              category: h.category || null,
              folderId: h.id,
              folderName: h.name,
            })),
          },
        },
        workspaceInventory: inventory,
      };
    }
    if (!remnantIsDept && hits.length === 0 && !deptHit) {
      // Intent was folder docs but no live match — honest empty (do not free_chat invent).
      clearPendingGinaOffer();
      return {
        family: "folder_summary",
        toolsCalled,
        toolContext: {
          empty: true,
          listAll: true,
          folderName: null,
          departmentName: null,
          category: null,
          documents: [],
          aggregated: { total: 0, completed: 0, inProgress: 0, notStarted: 0, pastDue: 0 },
          notFound: true,
          hint: "No live folder matched — do not invent",
        },
        workspaceInventory: inventory,
      };
    }
    // remnant is a department (or no folder hit but dept present) → fall through
  }

  // Review / list all documents of a department (incl. flexible). Empty → cero datos (no invent).
  // Bare "todos" after a "hoy" turn stays on today scope (not free_chat).
  if (wantsDepartmentDocsReview(q) || isBareDepartmentUtterance(ctx, text)) {
    const deptHit = resolveDepartmentForReview(ctx, text);
    if (deptHit) {
      const body = fold(q).replace(/^gina\b[\s,:!-]*/, "").trim();
      const bareTodos = /^todos$|^todas$|^all$/.test(body);
      const explicitCorpus = /\bdocumentos?\s+(de|del|en|para)\b/.test(body)
        || /\brevisar\b/.test(body)
        || /\b(todos|todas)\s+(los|las)\s+documentos?\b/.test(body)
        || isBareDepartmentUtterance(ctx, text);
      const todayFollow = recentWasTodayScope(ctx)
        && !explicitCorpus
        && (bareTodos || isDeptScopedFollowUp(q));
      if (todayFollow) {
        const filters = {
          department: deptHit.name,
          category: null,
          folder: null,
          includeCompleted: true,
        };
        const toolContext = call("get_today_scope", () => get_today_scope(ctx, filters));
        return {
          family: "today",
          toolsCalled,
          toolContext: {
            ...toolContext,
            listAll: bareTodos || /\b(todos|all)\b/.test(body),
          },
          workspaceInventory: inventory,
        };
      }
      return buildDepartmentDocsFamily(ctx, inventory, toolsCalled, deptHit, { text });
    }
  }

  // Focus / open a specific document or folder (not a department card click).
  if (/\b(abre|abrir|open|trabajar en)\b/.test(q)
    || (/\b(enfoca|enfocarme|focus)\b/.test(q) && !matchDepartmentInText(ctx, text))) {
    const docs = get_all_company_documents(ctx);
    const folders = get_all_company_folders(ctx);
    const openDocumentId = pickBestTitleMatch(q, docs.map((d) => ({ id: d.id, name: d.title })));
    const openFolderId = openDocumentId
      ? null
      : pickBestTitleMatch(q, folders.map((f) => ({ id: f.id, name: f.name })));
    toolsCalled.push("resolve_focus");
    return {
      family: "focus_open",
      toolsCalled,
      toolContext: { openDocumentId, openFolderId, hint: "User wants to focus/open one item" },
      openDocumentId,
      openFolderId,
      workspaceInventory: inventory,
    };
  }

  if (/\b(conflicto|conflictos|solape|overlap|chocan)\b/.test(q)) {
    const toolContext = call("get_schedule_conflicts", () => get_schedule_conflicts(ctx));
    return { family: "conflicts", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  if (/\b(vencid\w*|past\s*due|atrasad\w*|se paso|se paso)\b/.test(q)) {
    const toolContext = call("get_past_due_documents", () => get_past_due_documents(ctx));
    return { family: "past_due", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  if (/\b(no complete|no complet|incomplet|sin completar|que no termine)\b/.test(q)) {
    const toolContext = call("get_incomplete_documents", () => get_incomplete_documents(ctx));
    return { family: "incomplete", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  // Time scopes (hasta mañana / dentro de N / para mañana / semana / hoy)
  const time = parseGinaTimeScope(text, ctx.now || new Date(), { locale });
  if (time) {
    const { filters, ambiguity } = resolveScopeFilters(ctx, time.remainder, toolsCalled);
    if (ambiguity) {
      return {
        family: "name_ambiguity",
        toolsCalled,
        toolContext: { ambiguity, time, needsConfirm: false },
        workspaceInventory: inventory,
      };
    }

    if (time.needsConfirm && time.kind === "day_offset") {
      return {
        family: "confirm_date",
        toolsCalled,
        toolContext: {
          needsConfirm: true,
          confirmDateKey: time.confirmDateKey,
          confirmDateLabel: time.confirmDateLabel,
          dayOffset: time.dayOffset,
          filters,
          hint: "Confirm the target date before detailing documents",
        },
        workspaceInventory: inventory,
      };
    }

    if (time.kind === "this_week") {
      const toolContext = call("get_week_scope", () => get_week_scope(ctx, 0));
      return {
        family: "this_week",
        toolsCalled,
        toolContext: { ...toolContext, overviewOnly: true, filters },
        workspaceInventory: inventory,
      };
    }

    if (time.kind === "next_week") {
      const toolContext = call("get_week_scope", () => get_week_scope(ctx, 1));
      return {
        family: "next_week",
        toolsCalled,
        toolContext: { ...toolContext, overviewOnly: true, filters },
        workspaceInventory: inventory,
      };
    }

    if (time.kind === "today") {
      const toolContext = call("get_today_scope", () => get_today_scope(ctx, filters));
      return { family: "today", toolsCalled, toolContext, workspaceInventory: inventory };
    }

    if (time.kind === "tomorrow_only" || time.kind === "through_tomorrow" || time.kind === "day_offset") {
      const toolContext = call("get_documents_by_date_range", () => get_documents_by_date_range(
        ctx,
        time.startKey,
        time.endKey,
        { ...filters, excludeCompleted: true },
      ));
      const family = time.kind === "tomorrow_only"
        ? "tomorrow"
        : time.kind === "through_tomorrow"
          ? "through_tomorrow"
          : "date_range";
      return { family, toolsCalled, toolContext, workspaceInventory: inventory };
    }
  }

  if (/\b(in[_ ]?progress|en progreso|en curso)\b/.test(q)) {
    const toolContext = call("get_documents_by_status", () => get_documents_by_status(ctx, "in_progress"));
    return { family: "status", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  // Category blogs — only if inventory has that category (no hardcoded Marketing)
  if (/\b(blog|blogs)\b/.test(q)) {
    const deptHit = matchDepartmentInText(ctx, q);
    const docs = call("filter_dept_category", () => filterDocumentsByDepartmentAndCategory(
      ctx,
      deptHit?.name || "",
      "blog",
    ));
    return {
      family: "blogs",
      toolsCalled,
      toolContext: {
        department: deptHit?.name || null,
        category: "blogs",
        documents: docs,
      },
      workspaceInventory: inventory,
    };
  }

  // Folder / department summary — match live inventory names only (aliases OK)
  const howMatch = q.match(/\b(?:como esta|cómo está|how is|status de|del departamento de|departamento de)\s+([a-z0-9áéíóúüñ\s_-]{2,40})/);
  if (howMatch) {
    const name = howMatch[1].replace(/\?+$/, "").trim();
    const amb = resolveNameAmbiguity(ctx, name);
    toolsCalled.push("resolve_name_ambiguity");
    if (amb.ambiguous) {
      return {
        family: "name_ambiguity",
        toolsCalled,
        toolContext: {
          ambiguity: {
            intro: `"${name}" aparece en más de un sitio.`,
            needle: name,
            options: amb.options.slice(0, 3),
          },
        },
        workspaceInventory: inventory,
      };
    }
    const deptHit = matchDepartmentInText(ctx, name) || matchDepartmentInText(ctx, q);
    if (deptHit) {
      const nameFold = fold(name);
      const tokens = expandDepartmentNameTokens(deptHit.name);
      if (fold(deptHit.name) === nameFold || tokens.includes(nameFold)) {
        return buildDepartmentDocsFamily(ctx, inventory, toolsCalled, deptHit, { text });
      }
    }
    const folderId = amb.options[0]?.folderId || findFolderIdByName(ctx, name);
    if (folderId) {
      const toolContext = call("get_folder_children_summary", () => get_folder_children_summary(ctx, folderId));
      return { family: "folder_summary", toolsCalled, toolContext, workspaceInventory: inventory };
    }
  } else {
    const deptHit = matchDepartmentInText(ctx, q);
    if (deptHit && /\b(como|cómo|how|esta|está|proyecto|folder|departamento|status)\b/.test(q)) {
      return buildDepartmentDocsFamily(ctx, inventory, toolsCalled, deptHit, { text });
    }
  }

  if (/\b(scope|panorama|puesta al dia|puesta al día|analisis general|análisis general)\b/.test(q)) {
    const toolContext = call("get_gina_scope", () => get_gina_scope(ctx, "all"));
    return { family: "gina_scope", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  if (/\b(todos los (folders|proyectos)|all (folders|projects)|muéstrame todo|muestrame todo)\b/.test(q)) {
    const toolContext = {
      folders: call("get_all_company_folders", () => get_all_company_folders(ctx)),
      documents: call("get_all_company_documents", () => get_all_company_documents(ctx)),
      inventory,
    };
    return { family: "inventory", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  // Bare name that is ambiguous (e.g. "qué hay en Trends")
  if (/\b(que|qué)\b/.test(q) && /\b(hay|esta|está|en)\b/.test(q)) {
    const scoped = extractScopedName(q) || extractScopedName(q.replace(/\b(que|qué)\s+(hay|tengo)\s*/g, ""));
    if (scoped) {
      const amb = resolveNameAmbiguity(ctx, scoped);
      toolsCalled.push("resolve_name_ambiguity");
      if (amb.ambiguous) {
        return {
          family: "name_ambiguity",
          toolsCalled,
          toolContext: {
            ambiguity: {
              intro: `"${scoped}" lo tienes en más de un sitio.`,
              needle: scoped,
              options: amb.options.slice(0, 3),
            },
          },
          workspaceInventory: inventory,
        };
      }
    }
  }

  const about = q.match(/\b(?:cu[eé]ntame (?:del|de|sobre)|tell me about|sobre el|sobre la)\s+(.+)$/);
  if (about) {
    const needle = fold(about[1]);
    const docs = get_all_company_documents(ctx);
    const hit = docs.find((d) => fold(d.title).includes(needle) || needle.includes(fold(d.title)));
    if (hit) {
      const toolContext = call("get_document_detail", () => get_document_detail(ctx, hit.id));
      return { family: "document_detail", toolsCalled, toolContext, workspaceInventory: inventory };
    }
  }

  // "entregame todos…" / bare "todos" / horarios|categorías follow-ups with dept in context.
  // Never fall to free_chat when a live department is resolvable.
  if (isDeptScopedFollowUp(q) || wantsDepartmentDocsReview(q)) {
    const deptHit = resolveDepartmentForReview(ctx, text);
    if (deptHit) {
      const body = fold(q).replace(/^gina\b[\s,:!-]*/, "").trim();
      const wantsTodayFollowUp = recentWasTodayScope(ctx)
        && (
          /\b(horarios?|agenda|schedule|categor\w*|folders?|status|expand)\b/.test(body)
          || /^todos$|^todas$|^all$/.test(body)
        );
      if (wantsTodayFollowUp) {
        const filters = {
          department: deptHit.name,
          category: null,
          folder: null,
          includeCompleted: true,
        };
        const toolContext = call("get_today_scope", () => get_today_scope(ctx, filters));
        return {
          family: "today",
          toolsCalled,
          toolContext: {
            ...toolContext,
            listAll: /^todos$|^todas$|^all$/.test(body) || /\b(todos|all)\b/.test(body),
          },
          workspaceInventory: inventory,
        };
      }
      return buildDepartmentDocsFamily(ctx, inventory, toolsCalled, deptHit, { text });
    }
  }

  // No explicit work request → free chat (Groq reasons without scope JSON).
  // Work tools/cards only when a known family matches (hoy, vencidos, …) —
  // later: expand that allowlist as a designed input library.
  return {
    family: "free_chat",
    toolsCalled,
    toolContext: {
      freeChat: true,
      hint: "No explicit work request — reply naturally on-task as Gina. Do not invent document lists or counts.",
    },
    workspaceInventory: inventory,
  };
}
