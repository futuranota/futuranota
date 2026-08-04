/**
 * Map user utterances to Gina tool families (1–2 tools).
 * Live corpus only — time scope + name ambiguity.
 */

import { parseGinaTimeScope, foldGinaText } from "./ginaTimeScope.js";
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
} from "./ginaTools.js";

function fold(s) {
  return foldGinaText(s);
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
const GINA_WORK_CUE_RE = /\b((que|qué)\s+(tengo|hay|tenemos)|(dime|muestra|muestrame|entreg|lista|revis)\w*.*\b(hoy|manana|mañana)|para\s+hoy|vencid\w*|atrasad\w*|conflicto\w*|incomplet\w*|sin completar|abre|abrir|\bopen\b|enfoca|enfoque|enfocarme|departamento\w*|folder\w*|documento\w*|\bstatus\b|progreso|\bscope\b|panorama|dentro\s+de\s+\d+\s+d|hasta\s+(manana|mañana)|esta\s+semana|blogs?|schedule|horario\w*|aprende|significa|past\s*due|incomplete|conflict|what\s+(do\s+i\s+)?have|show\s+me\s+today|focus\s+today)\b/;

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
 */
function resolveScopeFilters(ctx, remainder, toolsCalled) {
  const deptHit = matchDepartmentInText(ctx, remainder);
  if (deptHit) {
    return {
      filters: { department: deptHit.name, category: null, folder: null },
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
        category: o.kind === "category" ? o.category : null,
        folder: o.kind === "category" ? null : (o.folderName || amb.needle),
        folderId: o.folderId || null,
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

  // Department focus from chips/cards — NOT open a document/folder.
  // "Enfocarme hoy en Marketing" must scope today to that dept.
  {
    const wantsDeptFocus = /\b(enfocarme|enfoca|enfocate|enfócate|focus(\s+today)?\s+on)\b/.test(q)
      || /\bfocus\s+today\s+on\b/.test(q);
    const deptHit = wantsDeptFocus ? matchDepartmentInText(ctx, text) : null;
    if (wantsDeptFocus && deptHit) {
      const filters = { department: deptHit.name, category: null, folder: null };
      const toolContext = call("get_today_scope", () => get_today_scope(ctx, filters));
      return {
        family: "today",
        toolsCalled,
        toolContext,
        workspaceInventory: inventory,
      };
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

  // Folder / department summary — match live inventory names only
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
    if (deptHit && fold(deptHit.name) === fold(name)) {
      const docs = filterDocumentsByDepartmentAndCategory(ctx, deptHit.name, "");
      toolsCalled.push("filter_department");
      return {
        family: "department",
        toolsCalled,
        toolContext: { department: deptHit.name, documents: docs },
        workspaceInventory: inventory,
      };
    }
    const folderId = amb.options[0]?.folderId || findFolderIdByName(ctx, name);
    if (folderId) {
      const toolContext = call("get_folder_children_summary", () => get_folder_children_summary(ctx, folderId));
      return { family: "folder_summary", toolsCalled, toolContext, workspaceInventory: inventory };
    }
  } else {
    const deptHit = matchDepartmentInText(ctx, q);
    if (deptHit && /\b(como|cómo|how|esta|está|proyecto|folder|departamento|status)\b/.test(q)) {
      const docs = filterDocumentsByDepartmentAndCategory(ctx, deptHit.name, "");
      toolsCalled.push("filter_department");
      return {
        family: "department",
        toolsCalled,
        toolContext: { department: deptHit.name, documents: docs },
        workspaceInventory: inventory,
      };
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
