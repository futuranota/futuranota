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
  matchLiveFolderInText,
} from "./ginaTools.js";

function fold(s) {
  return foldGinaText(s);
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
