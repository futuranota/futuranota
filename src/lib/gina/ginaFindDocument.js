/**
 * Gina find-document: parse partial hierarchy + topic hints, scan title/body locally.
 * Never invents matches — returns 0 / N / clarify.
 */

import { getNodeWritingPlainText } from "../nodeWritingExcerpt.js";
import {
  get_all_company_documents,
  get_workspace_inventory,
  matchDepartmentInText,
} from "./ginaTools.js";
import { foldGinaText } from "./ginaTimeScope.js";

function fold(s) {
  return foldGinaText(s);
}

const STOP = new Set([
  "a", "al", "algo", "algun", "alguna", "alguno", "an", "and", "about",
  "abre", "abrir", "buscar", "busca", "buscame", "encontre", "encuentra", "encontrar",
  "encuentrame", "encuentramelo", "encuentreme", "buscamelo", "buscame",
  "categoria", "category", "de", "del", "departamento", "department", "doc", "documento",
  "documentos", "el", "ella", "en", "encuentra", "ese", "esa", "eso", "este", "esta",
  "find", "folder", "for", "gina", "habla", "hablar", "hay", "i", "la", "las", "lo", "los",
  "me", "mi", "mis", "no", "of", "on", "or", "over", "para", "por", "que", "quiero",
  "remember", "similar", "sobre", "te", "the", "to", "un", "una", "uno", "where", "with",
  "y", "yo", "donde", "esta", "está", "tengo", "puedes", "puedo", "mostrar", "muestra",
  "dame", "necesito", "looking", "look", "search", "please", "porfa", "porfavor",
  "empiece", "empieza", "empieze", "comienza", "starts", "with", "something",
]);

const UNCATEGORIZED = new Set(["", "uncategorized", "sin categoria", "sin categoría", "none", "n/a"]);

/**
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeFindQuery(text) {
  return fold(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/**
 * Levenshtein distance (short strings only).
 * @param {string} a
 * @param {string} b
 */
export function editDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  /** @type {number[]} */
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    /** @type {number[]} */
    const cur = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    prev = cur;
  }
  return prev[t.length];
}

/**
 * @param {string} hayFolded
 * @param {string} kw
 */
function fuzzyIncludes(hayFolded, kw) {
  if (!kw) return false;
  if (hayFolded.includes(kw)) return true;
  if (kw.length < 4) return false;
  const maxDist = kw.length >= 7 ? 2 : 1;
  const tokens = hayFolded.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (Math.abs(tok.length - kw.length) > maxDist) continue;
    if (editDistance(tok, kw) <= maxDist) return true;
  }
  return false;
}

/**
 * Extract "starts with / que empiece …" title prefix from utterance.
 * @param {string} text
 * @returns {string | null}
 */
export function extractTitlePrefix(text) {
  const raw = String(text || "");
  const m = raw.match(
    /\b(?:que\s+empie(?:ce|za|ze)|empie(?:ce|za)\s+con|comienza\s+con|starts?\s+with|beginning\s+with|titled?\s+|titulado\s+)\s*["“]?(.+?)["”]?(?=\s+o\s+algo|\s+or\s+something|\s+gina\b|$)/i,
  );
  if (!m?.[1]) return null;
  const prefix = m[1].replace(/\s+/g, " ").trim();
  return prefix.length >= 3 ? prefix : null;
}

/**
 * @param {string} titleFolded
 * @param {string} prefixFolded
 */
function titleMatchesPrefix(titleFolded, prefixFolded) {
  if (!prefixFolded || !titleFolded) return false;
  if (titleFolded.startsWith(prefixFolded)) return true;
  // Soft: first N chars of prefix (typo near the end)
  const softLen = Math.max(10, prefixFolded.length - 3);
  if (prefixFolded.length >= 8 && titleFolded.startsWith(prefixFolded.slice(0, softLen))) {
    return true;
  }
  // Token-wise fuzzy on the prefix head
  const pToks = prefixFolded.split(/\s+/).filter(Boolean);
  const tToks = titleFolded.split(/\s+/).filter(Boolean);
  if (pToks.length < 2 || tToks.length < 2) return false;
  let hits = 0;
  const n = Math.min(pToks.length, tToks.length, 5);
  for (let i = 0; i < n; i += 1) {
    if (pToks[i] === tToks[i] || fuzzyIncludes(tToks[i], pToks[i])) hits += 1;
  }
  return hits >= Math.ceil(n * 0.6);
}

function isUncategorized(cat) {
  return UNCATEGORIZED.has(fold(cat || ""));
}

/**
 * @param {import("./ginaTools.js").GinaToolsContext} ctx
 * @param {string} text
 */
export function parseFindHints(ctx, text) {
  const q = fold(text);
  const inventory = get_workspace_inventory(ctx);
  const department = matchDepartmentInText(ctx, text);
  const titlePrefix = extractTitlePrefix(text);

  /** @type {string | null} */
  let category = null;
  const categories = [];
  const deptNames = new Set(
    (inventory.departments || []).map((d) => fold(d.name)).filter(Boolean),
  );
  for (const d of inventory.departments || []) {
    for (const cat of d.categories || []) {
      const c = fold(cat);
      if (!c || c.length < 2) continue;
      categories.push({ name: cat, fold: c, department: d.name });
      // Don't treat a department name token as a category match (e.g. Marketing dept vs marketing cat).
      if (deptNames.has(c)) continue;
      if (isUncategorized(c)) continue;
      if (q.includes(c) || new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q)) {
        if (!category || c.length > fold(category).length) category = cat;
      }
    }
  }

  // Explicit uncategorized ask
  if (/\buncategorized\b/.test(q) || /\bsin\s+categor/.test(q)) {
    category = "uncategorized";
  }

  /** @type {{ id: string, name: string } | null} */
  let folder = null;
  for (const f of inventory.folders || []) {
    const n = fold(f.name);
    if (!n || n.length < 2) continue;
    if (q.includes(n) || n.includes(q.slice(0, Math.min(q.length, n.length)))) {
      if (!folder || n.length > fold(folder.name).length) {
        folder = { id: f.id, name: f.name };
      }
    }
  }

  /** @type {{ kind: string, label: string, text: string }[]} */
  const clarifyOptions = [];
  if (department) {
    const deptFold = fold(department.name);
    const asCatElsewhere = categories.filter(
      (c) => c.fold === deptFold && fold(c.department) !== deptFold && !isUncategorized(c.fold),
    );
    if (asCatElsewhere.length && !category) {
      for (const c of asCatElsewhere.slice(0, 3)) {
        clarifyOptions.push({
          kind: "category_elsewhere",
          label: `Categoría ${c.name} en ${c.department}`,
          text: `Buscar en categoría ${c.name} del departamento ${c.department}`,
        });
      }
      clarifyOptions.unshift({
        kind: "department",
        label: `Departamento ${department.name}`,
        text: `Buscar en el departamento ${department.name}`,
      });
    }
  }

  let topicRaw = q;
  if (department) topicRaw = topicRaw.replace(new RegExp(fold(department.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
  if (category && !isUncategorized(category)) {
    topicRaw = topicRaw.replace(new RegExp(fold(category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
  }
  if (folder) topicRaw = topicRaw.replace(new RegExp(fold(folder.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
  if (titlePrefix) {
    topicRaw = topicRaw.replace(fold(titlePrefix), " ");
  }

  const about = text.match(
    /\b(?:sobre|about|habla(?:ndo)?\s+(?:de|sobre)|trata\s+de|que\s+trata(?:\s+de)?)\s+(.+)$/i,
  );
  const topicSource = about?.[1] || topicRaw;
  let keywords = tokenizeFindQuery(topicSource);
  // If we have a title prefix, also tokenize it as strong keywords
  if (titlePrefix) {
    const prefixKws = tokenizeFindQuery(titlePrefix);
    keywords = [...new Set([...prefixKws, ...keywords])];
  }

  const hasHierarchy = Boolean(department || category || folder);
  const hasTopic = keywords.length > 0 || Boolean(titlePrefix);

  return {
    department: department?.name || null,
    departmentId: department?.id || null,
    category,
    folderId: folder?.id || null,
    folderName: folder?.name || null,
    titlePrefix,
    keywords,
    clarifyOptions,
    needsClarify: clarifyOptions.length > 1 && !hasTopic,
    hasHierarchy,
    hasTopic,
    raw: String(text || "").trim(),
  };
}

/**
 * @param {import("./ginaTools.js").GinaToolsContext} ctx
 * @param {ReturnType<typeof parseFindHints>} hints
 * @param {{ limit?: number }} [opts]
 */
export function searchDocumentsByHints(ctx, hints, opts = {}) {
  const limit = opts.limit ?? 8;
  const docs = get_all_company_documents(ctx);
  const nodes = ctx.nodes
    ? (Array.isArray(ctx.nodes) ? ctx.nodes : Object.values(ctx.nodes))
    : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const deptF = fold(hints.department);
  const catF = fold(hints.category);
  const wantUncat = isUncategorized(catF);
  const folderId = hints.folderId;
  const keywords = hints.keywords || [];
  const prefixF = fold(hints.titlePrefix || "");

  /** @type {object[]} */
  const scored = [];

  for (const doc of docs) {
    const docDept = fold(doc.departmentName || doc.department || "");
    const docCat = fold(doc.category || "");

    if (deptF && docDept !== deptF && !docDept.includes(deptF) && !deptF.includes(docDept)) {
      if (!catF && !folderId && !prefixF) continue;
      if (catF && !wantUncat && docCat !== catF && !docCat.includes(catF)) continue;
    }
    if (catF) {
      if (wantUncat) {
        if (!isUncategorized(docCat)) continue;
      } else if (docCat !== catF && !docCat.includes(catF) && !catF.includes(docCat)) {
        continue;
      }
    }
    if (folderId && doc.parentFolderId !== folderId && doc.parentDocId !== folderId) {
      continue;
    }

    const title = fold(doc.title || "");
    const raw = nodeById.get(doc.id);
    const body = fold(getNodeWritingPlainText(raw?.content) || String(raw?.body || "").slice(0, 4000));

    let score = 0;
    let titleHits = 0;
    let bodyHits = 0;
    let prefixHit = false;

    if (prefixF && titleMatchesPrefix(title, prefixF)) {
      score += 24;
      prefixHit = true;
      titleHits += 1;
    }

    if (!keywords.length && !prefixF) {
      score = Math.max(score, 1);
    } else {
      for (const kw of keywords) {
        if (title.includes(kw) || fuzzyIncludes(title, kw)) {
          score += 5;
          titleHits += 1;
        } else if (body.includes(kw) || fuzzyIncludes(body, kw)) {
          score += 2;
          bodyHits += 1;
        }
      }
      if (score === 0) continue;
    }

    // Require a real content/title signal when the user gave topic/prefix
    if ((keywords.length || prefixF) && titleHits === 0 && bodyHits === 0 && !prefixHit) {
      continue;
    }

    if (deptF && docDept === deptF) score += 2;
    if (catF && !wantUncat && docCat === catF) score += 2;
    if (wantUncat && isUncategorized(docCat)) score += 2;
    if (folderId && (doc.parentFolderId === folderId || doc.parentDocId === folderId)) score += 3;

    const excerptSource = getNodeWritingPlainText(raw?.content) || "";
    const excerpt = excerptSource.slice(0, 140).trim();

    scored.push({
      id: doc.id,
      title: doc.title || "Untitled",
      department: doc.departmentName || doc.department || null,
      departmentId: doc.departmentId || null,
      category: doc.category || null,
      folder: doc.parentFolderName || doc.folder || null,
      folderId: doc.parentFolderId || null,
      status: doc.status || null,
      score,
      titleHits,
      bodyHits,
      excerpt: excerpt || null,
      matchWhere: prefixHit
        ? "title_prefix"
        : (titleHits > 0 ? "title" : (bodyHits > 0 ? "body" : "scope")),
    });
  }

  scored.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));
  const results = scored.slice(0, limit);

  return {
    results,
    total: scored.length,
    hints,
    empty: results.length === 0,
  };
}

/**
 * @param {{ empty?: boolean, total?: number, results?: object[], hints?: object, locale?: string, needsClarify?: boolean }} opts
 */
export function buildFindDocumentMessage(opts = {}) {
  const en = opts.locale === "en";
  const hints = opts.hints || {};
  const results = Array.isArray(opts.results) ? opts.results : [];
  const total = opts.total ?? results.length;

  if (opts.needsClarify && Array.isArray(hints.clarifyOptions) && hints.clarifyOptions.length) {
    return en
      ? "I don’t want to assume — I see more than one reading of that name. Are you referring to a department, a category in another department, or something else? Pick below or tell me more."
      : "No quiero asumir — veo más de una lectura de ese nombre. ¿Te refieres a un departamento, a una categoría en otro departamento, o a algo más? Elige abajo o dame más detalle.";
  }

  if (opts.empty || total === 0) {
    const scopeBits = [];
    if (hints.department) scopeBits.push(en ? `department ${hints.department}` : `departamento ${hints.department}`);
    if (hints.category) scopeBits.push(en ? `category ${hints.category}` : `categoría ${hints.category}`);
    if (hints.folderName) scopeBits.push(en ? `folder ${hints.folderName}` : `folder ${hints.folderName}`);
    if (hints.titlePrefix) {
      scopeBits.push(en ? `title starting “${hints.titlePrefix}”` : `título que empiece «${hints.titlePrefix}»`);
    }
    const scope = scopeBits.length
      ? (en ? ` in ${scopeBits.join(" · ")}` : ` en ${scopeBits.join(" · ")}`)
      : "";
    return en
      ? `I searched${scope} and didn’t find a matching document. I won’t invent one — want another keyword, folder, or department?`
      : `Busqué${scope} y no encontré un documento que coincida. No voy a inventar uno — ¿me das otra palabra, folder o departamento?`;
  }

  if (total === 1) {
    const hit = results[0];
    const t = hit?.title || (en ? "this document" : "este documento");
    const path = [hit?.department, hit?.category || (en ? "uncategorized" : "sin categoría"), hit?.folder]
      .filter(Boolean)
      .join(" / ");
    return en
      ? `I found one match: “${t}”${path ? ` (${path})` : ""}. Want me to open it?`
      : `Encontré una coincidencia: «${t}»${path ? ` (${path})` : ""}. ¿Quieres que te lo abra?`;
  }

  return en
    ? `I found ${total} option${total === 1 ? "" : "s"}. Here’s the list from your live workspace — pick one to open, or give me more detail.`
    : `Encontré ${total} opción${total === 1 ? "" : "es"}. Aquí tienes el listado de tu workspace live — elige una para abrir, o dame más detalle.`;
}

/**
 * @param {{ results?: object[], locale?: string, empty?: boolean, needsClarify?: boolean, clarifyOptions?: object[] }} opts
 */
export function buildFindDocumentChips(opts = {}) {
  const en = opts.locale === "en";
  /** @type {{ id: string, label: string, text: string, primary?: boolean }[]} */
  const chips = [];

  if (opts.needsClarify && Array.isArray(opts.clarifyOptions)) {
    for (const opt of opts.clarifyOptions.slice(0, 4)) {
      chips.push({
        id: `clarify_${opt.kind}_${opt.label}`,
        label: opt.label,
        text: opt.text,
        primary: opt.kind === "department",
      });
    }
    chips.push({
      id: "find_dont_remember",
      label: en ? "I don’t remember" : "No me acuerdo",
      text: en
        ? "I don’t remember the department or category, search by topic only"
        : "No me acuerdo del departamento ni la categoría, busca solo por el tema",
    });
    return chips;
  }

  const results = Array.isArray(opts.results) ? opts.results : [];
  for (const doc of results.slice(0, 5)) {
    if (!doc?.id) continue;
    chips.push({
      id: `reveal_${doc.id}`,
      label: en ? `Show “${doc.title}” in Documents` : `Ver «${doc.title}» en Documents`,
      text: `GinaRevealDocument:${doc.id}`,
      primary: results.length === 1,
    });
    chips.push({
      id: `open_${doc.id}`,
      label: en ? `Open “${doc.title}”` : `Abrir «${doc.title}»`,
      text: `GinaOpenDocument:${doc.id}`,
    });
  }

  if (!opts.empty) {
    chips.push({
      id: "find_narrow",
      label: en ? "More detail" : "Más detalle",
      text: en
        ? "Help me narrow the search with department or category"
        : "Ayúdame a filtrar con departamento o categoría",
    });
  } else {
    chips.push({
      id: "today_depts",
      label: en ? "Departments today" : "Departamentos de hoy",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
    });
  }

  return chips;
}

/**
 * Detect find-document intent.
 * @param {string} foldedQuery
 */
export function isFindDocumentIntent(foldedQuery) {
  const q = fold(foldedQuery);
  if (!q) return false;
  // encuentra / encuentrame / encuentramelo / buscar / buscame …
  if (/\b(busc(?:ar|a|ame|amel[oa])|encontr(?:ar|e|o|amos)|encuentr(?:a|e|ame|amelo|amela|alo|ala)|dónde\s+est[aá]|donde\s+est[aá]|find(?:\s+me)?|search|looking\s+for)\b/.test(q)) {
    return true;
  }
  if (/\bdocumento\b/.test(q) && /\b(sobre|habla|trata|about|empie|starts?\s+with|comienza)\b/.test(q)) {
    return true;
  }
  if (/\b(empie(?:ce|za)|starts?\s+with|comienza\s+con)\b/.test(q) && /\b(doc|documento|titulo|título|titled)\b/.test(q)) {
    return true;
  }
  if (/\b(no\s+me\s+acuerdo|dont\s+remember|don't\s+remember)\b/.test(q) && /\b(tema|topic|departamento|categor)/.test(q)) {
    return true;
  }
  if (/\bbuscar\s+en\s+(el\s+)?departamento\b/.test(q)) return true;
  if (/\bbuscar\s+en\s+categor/.test(q)) return true;
  if (/\bay[uú]dame\s+a\s+filtrar\b/.test(q)) return true;
  return false;
}
