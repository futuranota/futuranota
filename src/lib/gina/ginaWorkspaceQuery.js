/**
 * Client-side workspace_query contract (deterministic).
 * Mirrors the FETCH/COUNT tool schema without Groq function-calling.
 */

import { foldGinaText } from "./ginaTimeScope.js";

function fold(s) {
  return foldGinaText(s);
}

/** Deliver / list verbs for FETCH (schema contract synonyms). */
export const WORKSPACE_FETCH_VERBS = [
  "entregame",
  "entregar",
  "dame",
  "muestra",
  "muestrame",
  "traeme",
  "traer",
  "quiero ver",
  "quiero el listado",
  "lista",
  "listame",
  "show",
  "give",
  "fetch",
  "bring",
];

const FETCH_VERB_RE = /\b(entreg\w*|dame|muestra\w*|trae\w*|lista\w*|listame|show|give|fetch|bring|quiero(\s+ver|\s+el\s+listado)?|ver)\b/;

/**
 * @typedef {{
 *   action: "FETCH" | "COUNT" | "GROUP" | "SCHEDULE" | null,
 *   target: "documents" | "departments" | "folders" | "categories" | "blogs" | "schedules" | "all" | null,
 *   filters: {
 *     department?: string | null,
 *     folder?: string | null,
 *     category?: string | null,
 *     timeframe?: string | null,
 *   },
 *   group_by: "department" | "folder" | "category" | "none",
 * }} GinaWorkspaceQuery
 */

/**
 * Parse a natural-language workspace query into structured params.
 * @param {string} text
 * @returns {GinaWorkspaceQuery}
 */
export function parseWorkspaceQuery(text) {
  const q = fold(text);
  /** @type {GinaWorkspaceQuery} */
  const out = {
    action: null,
    target: null,
    filters: {},
    group_by: "none",
  };
  if (!q) return out;

  const hasDocs = /\b(documentos?|docs?|documents?)\b/.test(q);
  const hasAllDocs = /\b(todos|todas|all)\b/.test(q) && hasDocs;
  const hasFetchVerb = FETCH_VERB_RE.test(q)
    || /\blistado\s+completo\b/.test(q)
    || /\bfull\s+(document\s+)?list\b/.test(q);

  if (hasFetchVerb && hasDocs) {
    // Folder-scoped "documentos del X" is not corpus FETCH-all
    const folderScoped = /\bdocumentos?\s+(del|de|en)\s+(?!todos\b|todas\b|general\b|total\b|departamento\b|categor)/.test(q)
      && !/\b(departamento|categor)/.test(q);
    if (!folderScoped || hasAllDocs) {
      out.action = "FETCH";
      out.target = "documents";
      out.group_by = "department";
    }
  }

  if (/\b(cuantos|cuantas|cuanto|how\s+many|total)\b/.test(q) && hasDocs) {
    out.action = out.action || "COUNT";
    out.target = out.target || "documents";
  }

  if (/\bpor\s+departamento/.test(q) || /\bgroup\w*\s+by\s+department/.test(q)) {
    out.group_by = "department";
    if (!out.action && hasDocs) {
      out.action = "GROUP";
      out.target = "documents";
    }
  }
  if (/\bpor\s+categor/.test(q)) out.group_by = "category";
  if (/\bpor\s+folder|\bpor\s+carpeta/.test(q)) out.group_by = "folder";

  if (/\b(horario|schedule|con\s+horarios)\b/.test(q) && hasDocs) {
    if (!out.action) out.action = "SCHEDULE";
    out.target = out.target || "documents";
  }

  return out;
}

/**
 * True when utterance is a corpus-wide FETCH of all documents.
 * @param {string} text
 */
export function isWorkspaceFetchAllDocuments(text) {
  const q = fold(text);
  if (!q) return false;
  const parsed = parseWorkspaceQuery(text);
  if (parsed.action === "FETCH" && parsed.target === "documents") {
    // Prefer "todos" / listado completo / full list
    if (/\blistado\s+completo\b/.test(q) || /\bfull\s+(document\s+)?list\b/.test(q)) return true;
    if (/\b(todos|todas)\s+(los|las)\s+(documentos?|docs?)\b/.test(q)) return true;
    if (/\b(all\s+(the\s+)?documents?|every\s+document)\b/.test(q)) return true;
    // "entregame los documentos" / "tráeme los docs" without folder scope
    if (FETCH_VERB_RE.test(q) && /\b(documentos?|docs?)\b/.test(q)) {
      if (/\bdocumentos?\s+(del|de|en)\s+(?!todos\b|todas\b|los\b|las\b|general\b|total\b)/.test(q)
        && !/\b(departamento|categor)/.test(q)) {
        return false;
      }
      return true;
    }
  }
  return false;
}
