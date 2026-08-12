/**
 * Syntax bank: fetch-about a word without naming the hierarchy layer.
 * Gina scans department → category → folder → document (live corpus only)
 * and asks in natural language when more than one layer hits.
 */

import { foldGinaText } from "./ginaTimeScope.js";

function fold(s) {
  return foldGinaText(s);
}

const STOP = new Set([
  "a", "al", "de", "del", "el", "la", "las", "lo", "los", "un", "una",
  "todo", "todos", "todas", "sobre", "por", "en", "con", "gina",
  "dame", "entregame", "muestra", "trae", "quiero", "ver", "please",
]);

/**
 * Fetch-about without an explicit layer (departamento / categoría / folder).
 * "dame todo lo de plan de negocio" · "entregame todos sobre estrategias"
 * @param {string} text
 */
export function wantsWordScopeScan(text) {
  const q = fold(text);
  if (!q) return false;
  if (/\b(tabla\s+anterior|lista\s+anterior)\b/.test(q)) return false;
  if (/\b(encontr\w*|busca\w*|find)\b/.test(q) && /\bdocumento/.test(q)) return false;
  // Explicit layer stays on department / folder / category routers
  if (/\b(departamento|depto)\b/.test(q)) return false;
  if (/\bcategor[ií]a\b/.test(q)) return false;
  if (/\b(folder|carpeta|caja)\b/.test(q)) return false;
  if (/\bdocumentos?\s+(del|de|en)\b/.test(q)) return false;
  if (/\blistado\s+completo\b/.test(q) && !/\b(sobre|de)\s+\w+/.test(q)) return false;

  const hasFetch = /\b(entreg\w*|dame|muestra\w*|trae\w*|quiero|ver|lista\w*)\b/.test(q);
  if (!hasFetch) return false;
  if (/\b(todo\s+sobre|todos\s+sobre|todo\s+lo\s+de|todos\s+lo\s+de|todo\s+de|lo\s+de)\b/.test(q)) {
    return true;
  }
  if (/\bsobre\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function extractWordScopeNeedle(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const strip = (s) => String(s || "")
    .replace(/\b(por\s+favor|please|gina|ok|okay|gracias)\b/gi, " ")
    .replace(/[.?!,;]+$/g, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const todoSobre = raw.match(/\btodos?\s+sobre\s+(.+)$/i);
  if (todoSobre) return strip(todoSobre[1]);
  const todoLoDe = raw.match(/\btodo(?:s)?\s+lo\s+de\s+(.+)$/i);
  if (todoLoDe) return strip(todoLoDe[1]);
  const todoDe = raw.match(/\btodo(?:s)?\s+de\s+(.+)$/i);
  if (todoDe) return strip(todoDe[1]);
  const loDe = raw.match(/\blo\s+de\s+(.+)$/i);
  if (loDe) return strip(loDe[1]);
  const sobre = raw.match(/\bsobre\s+(.+)$/i);
  if (sobre) return strip(sobre[1]);
  return strip(raw);
}

/**
 * Significant tokens for layer matching (drop stopwords).
 * @param {string} text
 * @returns {string[]}
 */
export function wordScopeTokens(text) {
  return fold(text)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/**
 * User picked a layer and/or a live name from a pending word-scope ask.
 * @param {string} text
 * @param {{
 *   needle?: string,
 *   departments?: Array<{ name?: string }>,
 *   categories?: Array<{ name?: string, departmentName?: string }>,
 *   folders?: Array<{ id?: string, name?: string, departmentName?: string, category?: string }>,
 *   documents?: Array<{ id?: string, title?: string }>,
 * } | null} scan
 * @returns {{
 *   layer: "department" | "category" | "folder" | "document" | null,
 *   name: string | null,
 *   id?: string | null,
 *   departmentName?: string | null,
 *   category?: string | null,
 * } | null}
 */
export function parseWordScopeLayerReply(text, scan) {
  const q = fold(text);
  if (!q || !scan) return null;

  let layer = null;
  if (/\b(departamento|depto)\b/.test(q)) layer = "department";
  else if (/\bcategor/.test(q)) layer = "category";
  else if (/\b(folder|carpeta|caja)\b/.test(q)) layer = "folder";
  else if (/\bdocumento/.test(q)) layer = "document";

  const depts = Array.isArray(scan.departments) ? scan.departments : [];
  const cats = Array.isArray(scan.categories) ? scan.categories : [];
  const folders = Array.isArray(scan.folders) ? scan.folders : [];
  const docs = Array.isArray(scan.documents) ? scan.documents : [];

  const nameIn = (liveName) => {
    const n = fold(liveName);
    if (!n || n.length < 2) return false;
    return q.includes(n) || n.includes(q) || wordScopeTokens(q).every((tok) => n.includes(tok));
  };

  const deptHits = depts.filter((d) => nameIn(d.name) || (layer === "department" && depts.length === 1));
  const catHits = cats.filter((c) => nameIn(c.name) || (layer === "category" && cats.length === 1));
  const folderHits = folders.filter((f) => nameIn(f.name) || (layer === "folder" && folders.length === 1));
  const docHits = docs.filter((d) => nameIn(d.title) || (layer === "document" && docs.length === 1));

  if (layer === "department") {
    const pick = deptHits.length === 1 ? deptHits[0] : (depts.length === 1 ? depts[0] : null);
    if (pick?.name) return { layer: "department", name: pick.name, departmentName: pick.name };
    return null;
  }
  if (layer === "category") {
    const pick = catHits.length === 1 ? catHits[0] : (cats.length === 1 ? cats[0] : null);
    if (pick?.name) {
      return {
        layer: "category",
        name: pick.name,
        departmentName: pick.departmentName || null,
        category: pick.name,
      };
    }
    return null;
  }
  if (layer === "folder") {
    const pick = folderHits.length === 1 ? folderHits[0] : (folders.length === 1 ? folders[0] : null);
    if (pick?.name) {
      return {
        layer: "folder",
        name: pick.name,
        id: pick.id || null,
        departmentName: pick.departmentName || null,
        category: pick.category || null,
      };
    }
    return null;
  }
  if (layer === "document") {
    const pick = docHits.length === 1 ? docHits[0] : (docs.length === 1 ? docs[0] : null);
    if (pick?.id) return { layer: "document", name: pick.title || null, id: pick.id };
    return null;
  }

  const namedLayers = [
    deptHits.length === 1 ? { layer: "department", name: deptHits[0].name, departmentName: deptHits[0].name } : null,
    catHits.length === 1 ? {
      layer: "category",
      name: catHits[0].name,
      departmentName: catHits[0].departmentName || null,
      category: catHits[0].name,
    } : null,
    folderHits.length === 1 ? {
      layer: "folder",
      name: folderHits[0].name,
      id: folderHits[0].id || null,
      departmentName: folderHits[0].departmentName || null,
      category: folderHits[0].category || null,
    } : null,
    docHits.length === 1 ? { layer: "document", name: docHits[0].title || null, id: docHits[0].id } : null,
  ].filter(Boolean);

  if (namedLayers.length === 1) return namedLayers[0];
  return null;
}

function isUncategorized(category) {
  const c = fold(category);
  return !c || c === "uncategorized" || c === "sin categoria";
}

/**
 * Natural-language ask when several live layers match the same word.
 * @param {{
 *   needle?: string,
 *   departments?: Array<{ name?: string }>,
 *   categories?: Array<{ name?: string }>,
 *   folders?: Array<{ name?: string, category?: string | null }>,
 *   documents?: Array<{ title?: string }>,
 * }} scan
 * @param {{ locale?: "es"|"en" }} [opts]
 */
export function buildWordScopeAskMessage(scan = {}, opts = {}) {
  const en = opts.locale === "en";
  const needle = String(scan.needle || "").trim() || (en ? "that" : "eso");
  const depts = Array.isArray(scan.departments) ? scan.departments : [];
  const cats = Array.isArray(scan.categories) ? scan.categories : [];
  const folders = Array.isArray(scan.folders) ? scan.folders : [];
  const uncatFolders = folders.filter((f) => isUncategorized(f.category));
  const docs = Array.isArray(scan.documents) ? scan.documents : [];

  const orBits = [];
  if (depts.length) {
    const label = depts.map((d) => d.name).filter(Boolean).slice(0, 2).join(", ");
    orBits.push(en ? `the **${label}** department` : `al departamento de **${label}**`);
  }
  if (cats.length) {
    const label = cats.map((c) => c.name).filter(Boolean).slice(0, 2).join(", ");
    orBits.push(en ? `the **${label}** category` : `a la categoría **${label}**`);
  }
  if (folders.length && orBits.length < 2) {
    const label = folders.map((f) => f.name).filter(Boolean).slice(0, 2).join(", ");
    orBits.push(en ? `the folder **${label}**` : `al folder **${label}**`);
  }
  if (docs.length && orBits.length < 2 && !depts.length && !cats.length && !folders.length) {
    orBits.push(en
      ? `${docs.length} document${docs.length === 1 ? "" : "s"} with that word`
      : `${docs.length} documento${docs.length === 1 ? "" : "s"} con esa palabra`);
  }

  const parts = [];
  if (orBits.length >= 2) {
    parts.push(en
      ? `Do you mean ${orBits[0]} or ${orBits[1]}?`
      : `¿Te refieres ${orBits[0]} o ${orBits[1]}?`);
  } else if (folders.length > 1) {
    parts.push(en
      ? `I found ${folders.length} folders with «${needle}». Which one do you want?`
      : `Encontré ${folders.length} folders con «${needle}». ¿Cuál quieres?`);
  } else if (cats.length > 1) {
    parts.push(en
      ? `I found ${cats.length} categories with «${needle}». Which one do you mean?`
      : `Encontré ${cats.length} categorías con «${needle}». ¿A cuál te refieres?`);
  } else if (depts.length > 1) {
    parts.push(en
      ? `I found ${depts.length} departments with «${needle}». Which one?`
      : `Encontré ${depts.length} departamentos con «${needle}». ¿Cuál?`);
  }

  if (uncatFolders.length) {
    parts.push(en
      ? `I also found ${uncatFolders.length} folder${uncatFolders.length === 1 ? "" : "s"} that contain «${needle}» and have no category.`
      : `Por cierto también identifiqué ${uncatFolders.length} folder${uncatFolders.length === 1 ? "" : "s"} que contienen el texto «${needle}» y no tienen categoría.`);
  }
  if (docs.length && (depts.length || cats.length || folders.length)) {
    parts.push(en
      ? `There are also ${docs.length} document${docs.length === 1 ? "" : "s"} with that word in the title.`
      : `También hay ${docs.length} documento${docs.length === 1 ? "" : "s"} con esa palabra en el título.`);
  }
  parts.push(en ? "Can you explain a bit more?" : "¿Me puedes explicar mejor?");
  return parts.filter(Boolean).join(" ");
}

/**
 * @param {string} needle
 * @param {{ locale?: "es"|"en" }} [opts]
 */
export function buildWordScopeEmptyMessage(needle, opts = {}) {
  const en = opts.locale === "en";
  const word = String(needle || "").trim() || (en ? "that" : "eso");
  return en
    ? `I haven't found a department, category, folder, or document about «${word}». I won't invent one.`
    : `No encontré departamento, categoría, folder ni documento sobre «${word}». No voy a inventar.`;
}

/**
 * Chips that send layer + name so the next turn has both variables.
 * @param {object} scan
 * @param {{ locale?: "es"|"en" }} [opts]
 */
export function buildWordScopeChips(scan = {}, opts = {}) {
  const en = opts.locale === "en";
  /** @type {Array<{ id: string, label: string, text: string, primary?: boolean }>} */
  const chips = [];
  for (const d of (scan.departments || []).slice(0, 3)) {
    if (!d?.name) continue;
    chips.push({
      id: `ws_dept_${fold(d.name).replace(/\s+/g, "_")}`,
      label: en ? `Dept: ${d.name}` : `Depto: ${d.name}`,
      text: en ? `the ${d.name} department` : `el departamento de ${d.name}`,
      primary: chips.length === 0,
    });
  }
  for (const c of (scan.categories || []).slice(0, 3)) {
    if (!c?.name) continue;
    chips.push({
      id: `ws_cat_${fold(c.name).replace(/\s+/g, "_")}`,
      label: en ? `Category: ${c.name}` : `Categoría: ${c.name}`,
      text: en ? `the ${c.name} category` : `la categoría ${c.name}`,
      primary: chips.length === 0,
    });
  }
  for (const f of (scan.folders || []).slice(0, 5)) {
    if (!f?.name) continue;
    chips.push({
      id: `ws_folder_${f.id || fold(f.name).replace(/\s+/g, "_")}`,
      label: en ? `Folder: ${f.name}` : `Folder: ${f.name}`,
      text: en ? `the folder ${f.name}` : `el folder ${f.name}`,
      primary: chips.length === 0,
    });
  }
  return chips;
}
