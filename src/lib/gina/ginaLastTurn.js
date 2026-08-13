/**
 * Session-scoped Gina turn history (what she just showed).
 * Follow-ups like “este / modificar / filtrar tabla anterior” read this stack.
 */

import { foldGinaText } from "./ginaTimeScope.js";
import { matchNamedCategoryInText, matchDepartmentInText } from "./ginaTools.js";
import { buildGinaTableSchemaFromVisualization } from "./ginaTableColumnRefine.js";

/**
 * @typedef {{
 *   id: string,
 *   title?: string,
 * }} GinaLastTurnDoc
 *
 * @typedef {{
 *   locale?: "es" | "en",
 *   columns?: Array<{ key: string, label: string, role: string }>,
 *   valuesByKey?: Record<string, string[]>,
 * }} GinaTableSchema
 *
 * @typedef {{
 *   family: string,
 *   refKind: "schedule" | "folder" | "department" | "find" | "list" | "other",
 *   objectId?: string | null,
 *   department?: string | null,
 *   folderId?: string | null,
 *   folderName?: string | null,
 *   dateKey?: string | null,
 *   documents: GinaLastTurnDoc[],
 *   tableSchema?: GinaTableSchema | null,
 *   userText?: string | null,
 *   ts: number,
 * }} GinaLastTurn
 */

const MAX_TURN_HISTORY = 5;

/** @type {GinaLastTurn | null} */
let lastTurn = null;

/** @type {GinaLastTurn[]} */
let turnHistory = [];

const NO_STAMP_FAMILIES = new Set([
  "wall_clock",
  "social",
  "dismiss",
  "unclear",
  "free_chat",
  "last_turn_modify",
  "last_turn_missing",
  "last_turn_empty",
  "confirm_continue",
  "confirm_date",
  "name_ambiguity",
  "word_scope",
  "gina_day_ritual_reset",
  "table_category_ask",
]);

/**
 * @param {string} family
 */
export function shouldStampGinaLastTurn(family) {
  if (!family || NO_STAMP_FAMILIES.has(family)) return false;
  if (String(family).startsWith("last_turn_")) return false;
  return true;
}

/**
 * @param {GinaLastTurn | null | undefined} turn
 */
export function isListableGinaTurn(turn) {
  if (!turn) return false;
  if (turn.refKind === "list") return true;
  if (turn.family === "category_scope") return true;
  if (turn.refKind === "department" && (turn.documents?.length || turn.department)) return true;
  return false;
}

/**
 * @param {GinaLastTurn} turn
 */
function normalizeTurn(turn) {
  return {
    ...turn,
    documents: Array.isArray(turn.documents) ? turn.documents.slice(0, 40) : [],
    tableSchema: turn.tableSchema || null,
    ts: turn.ts || Date.now(),
  };
}

/**
 * @param {GinaLastTurn} turn
 */
function pushTurnHistory(turn) {
  if (!isListableGinaTurn(turn)) return;
  const snap = normalizeTurn(turn);
  turnHistory = [
    snap,
    ...turnHistory.filter((t) => (
      t.family !== snap.family
      || t.department !== snap.department
      || t.ts !== snap.ts
    )),
  ].slice(0, MAX_TURN_HISTORY);
}

/**
 * @param {GinaLastTurn | null} turn
 */
export function setGinaLastTurn(turn) {
  if (!turn) {
    lastTurn = null;
    return;
  }
  lastTurn = normalizeTurn(turn);
  pushTurnHistory(lastTurn);
}

export function getGinaLastTurn() {
  return lastTurn;
}

/** @returns {GinaLastTurn[]} */
export function getGinaTurnHistory() {
  return turnHistory.slice();
}

export function clearGinaLastTurn() {
  lastTurn = null;
  turnHistory = [];
}

/**
 * @param {unknown} raw
 * @returns {GinaLastTurnDoc[]}
 */
function mapDocs(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {GinaLastTurnDoc[]} */
  const out = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const id = String(/** @type {{ id?: string }} */ (d).id || "").trim();
    if (!id) continue;
    const title = String(
      /** @type {{ title?: string, name?: string }} */ (d).title
      || /** @type {{ name?: string }} */ (d).name
      || "",
    ).trim();
    out.push({ id, title });
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * @param {string} family
 * @returns {GinaLastTurn["refKind"]}
 */
function refKindForFamily(family) {
  if (
    family === "today"
    || family === "tomorrow"
    || family === "through_tomorrow"
    || family === "this_week"
    || family === "next_week"
    || family === "date_range"
    || family.startsWith("day_sheet_")
    || family.startsWith("schedule_recovery")
    || family === "daily_report"
  ) {
    return "schedule";
  }
  if (family === "folder_summary") return "folder";
  if (family === "department") return "department";
  if (family === "find_document") return "find";
  if (
    family === "count_documents"
    || family === "category_scope"
    || family === "blogs"
    || family === "status"
  ) {
    return "list";
  }
  return "other";
}

/**
 * Explicit stack offset from utterance (“anterior a la anterior” = 2 listables back).
 * @param {string} text
 * @returns {number | null} 1-based index into listable stack, or null for smart resolve
 */
export function parseLastTurnAnchorOffset(text) {
  const q = foldGinaText(text);
  if (!q) return null;
  if (
    /\banterior\s+a\s+la\s+anterior\b/.test(q)
    || /\bdos\s+tablas?\s+atr[aá]s\b/.test(q)
    || /\btwo\s+tables?\s+back\b/.test(q)
  ) {
    return 2;
  }
  if (
    /\btres\s+tablas?\s+atr[aá]s\b/.test(q)
    || /\bthree\s+tables?\s+back\b/.test(q)
  ) {
    return 3;
  }
  return null;
}

/**
 * Pick the best listable turn to anchor a table refine / open.
 * @param {string} text
 * @param {{ categoryNeedle?: string | null, departmentNeedle?: string | null, ctx?: object }} [opts]
 * @returns {{ anchor: GinaLastTurn | null, depth: number, reason: string }}
 */
export function resolveLastTurnAnchor(text, opts = {}) {
  const listable = turnHistory.filter(isListableGinaTurn);
  if (!listable.length && lastTurn && isListableGinaTurn(lastTurn)) {
    listable.push(lastTurn);
  }
  if (!listable.length) {
    return { anchor: null, depth: 0, reason: "no_listable_history" };
  }

  const qText = foldGinaText(text);
  const tableCue = /\b(tabla\s+anterior|lista\s+anterior|de\s+la\s+tabla\s+anterior)\b/.test(qText);

  const explicitOffset = parseLastTurnAnchorOffset(text);
  if (explicitOffset != null) {
    const idx = explicitOffset - 1;
    const anchor = listable[idx] || null;
    return {
      anchor,
      depth: explicitOffset,
      reason: anchor ? "explicit_offset" : "explicit_offset_out_of_range",
    };
  }

  const deptNeedle = String(opts.departmentNeedle || "").trim();
  const ctx = opts.ctx || null;
  if (deptNeedle && ctx && !tableCue) {
    for (let i = listable.length - 1; i >= 0; i -= 1) {
      if (!listable[i].department) {
        return {
          anchor: listable[i],
          depth: listable.length - i,
          reason: "corpus_list_for_department_pivot",
        };
      }
    }
  }

  if (deptNeedle && ctx) {
    const deptHit = matchDepartmentInText(ctx, deptNeedle);
    if (deptHit?.name) {
      const deptFold = foldGinaText(deptHit.name);
      const deptMatch = listable.find((t) => foldGinaText(t.department || "") === deptFold);
      if (deptMatch) {
        return { anchor: deptMatch, depth: 1, reason: "department_match" };
      }
    }
  }

  const needle = String(opts.categoryNeedle || "").trim();
  if (needle && ctx) {
    const catHit = matchNamedCategoryInText(ctx, needle, null);
    if (catHit?.departmentName) {
      const deptFold = foldGinaText(catHit.departmentName);
      const deptMatch = listable.find((t) => foldGinaText(t.department || "") === deptFold);
      if (deptMatch) {
        return { anchor: deptMatch, depth: 1, reason: "category_department_match" };
      }
    }
  }

  return { anchor: listable[0], depth: 1, reason: "most_recent_listable" };
}

/**
 * Build snapshot from a routed family result (before UI viz).
 * @param {{
 *   family?: string,
 *   toolContext?: Record<string, unknown> | null,
 *   openDocumentId?: string | null,
 * }} routed
 * @param {{ objectId?: string | null, userText?: string | null }} [ctx]
 * @returns {GinaLastTurn | null}
 */
export function buildGinaLastTurnFromRouted(routed, ctx = {}) {
  const family = String(routed?.family || "").trim();
  if (!shouldStampGinaLastTurn(family)) return null;

  const tc = routed?.toolContext && typeof routed.toolContext === "object"
    ? routed.toolContext
    : {};

  let documents = mapDocs(tc.documents);
  if (!documents.length && Array.isArray(tc.results)) {
    documents = mapDocs(tc.results);
  }
  if (!documents.length && tc.document && typeof tc.document === "object") {
    documents = mapDocs([tc.document]);
  }
  if (!documents.length && routed?.openDocumentId) {
    documents = [{ id: String(routed.openDocumentId), title: "" }];
  }

  const department = String(
    tc.department
    || tc.departmentName
    || (tc.filters && typeof tc.filters === "object"
      ? /** @type {{ department?: string }} */ (tc.filters).department
      : "")
    || "",
  ).trim() || null;

  const folderId = String(tc.folderId || "").trim() || null;
  const folderName = String(tc.folderName || tc.name || "").trim() || null;
  const dateKey = String(tc.date || tc.dateKey || "").trim() || null;

  return {
    family,
    refKind: refKindForFamily(family),
    objectId: ctx.objectId || null,
    department,
    folderId,
    folderName,
    dateKey,
    documents,
    userText: ctx.userText || null,
    ts: Date.now(),
  };
}

/**
 * If viz has document rows and lastTurn is thin, fill ids/titles from what the user saw.
 * @param {{ type?: string, data?: Record<string, unknown> } | null | undefined} visualization
 */
export function enrichGinaLastTurnFromVisualization(visualization, opts = {}) {
  if (!lastTurn || !visualization || typeof visualization !== "object") return lastTurn;
  const data = visualization.data && typeof visualization.data === "object"
    ? visualization.data
    : null;
  if (!data) return lastTurn;
  const fromViz = mapDocs(data.documents);
  const schema = buildGinaTableSchemaFromVisualization(visualization, {
    locale: opts.locale || data.locale || "es",
  });
  if (!fromViz.length && !schema) return lastTurn;
  lastTurn = {
    ...lastTurn,
    documents: fromViz.length ? fromViz : lastTurn.documents,
    department: lastTurn.department
      || String(data.department || "").trim()
      || null,
    tableSchema: schema || lastTurn.tableSchema || null,
    ts: Date.now(),
  };
  if (turnHistory.length && turnHistory[0]?.ts === lastTurn.ts) {
    turnHistory[0] = { ...lastTurn };
  } else if (turnHistory.length === 0 || turnHistory[0]?.family !== lastTurn.family) {
    pushTurnHistory(lastTurn);
  } else {
    turnHistory[0] = { ...lastTurn };
  }
  return lastTurn;
}

/**
 * Stamp session lastTurn from a routed result (no-op for clock/social/follow-up families).
 * @param {Parameters<typeof buildGinaLastTurnFromRouted>[0]} routed
 * @param {{ objectId?: string | null, userText?: string | null }} [ctx]
 */
export function stampGinaLastTurnFromRouted(routed, ctx = {}) {
  const snap = buildGinaLastTurnFromRouted(routed, ctx);
  if (snap) setGinaLastTurn(snap);
  return snap;
}

/**
 * @param {GinaLastTurn | null | undefined} turn
 */
export function isGinaLastTurnScheduleLike(turn) {
  if (!turn) return false;
  return turn.refKind === "schedule";
}
