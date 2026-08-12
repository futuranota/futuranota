/**
 * Session-scoped last Gina turn (what she just showed).
 * Follow-ups like “este / modificar / ábrelo” read this before folder-name match.
 */

/**
 * @typedef {{
 *   id: string,
 *   title?: string,
 * }} GinaLastTurnDoc
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
 *   userText?: string | null,
 *   ts: number,
 * }} GinaLastTurn
 */

/** @type {GinaLastTurn | null} */
let lastTurn = null;

const NO_STAMP_FAMILIES = new Set([
  "wall_clock",
  "social",
  "dismiss",
  "unclear",
  "free_chat",
  "last_turn_modify",
  "last_turn_missing",
  "confirm_continue",
  "confirm_date",
  "name_ambiguity",
  "gina_day_ritual_reset",
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
 * @param {GinaLastTurn | null} turn
 */
export function setGinaLastTurn(turn) {
  lastTurn = turn
    ? { ...turn, documents: Array.isArray(turn.documents) ? turn.documents.slice(0, 12) : [], ts: Date.now() }
    : null;
}

export function getGinaLastTurn() {
  return lastTurn;
}

export function clearGinaLastTurn() {
  lastTurn = null;
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
    if (out.length >= 12) break;
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
  if (family === "count_documents" || family === "blogs" || family === "status") return "list";
  return "other";
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
export function enrichGinaLastTurnFromVisualization(visualization) {
  if (!lastTurn || !visualization || typeof visualization !== "object") return lastTurn;
  const data = visualization.data && typeof visualization.data === "object"
    ? visualization.data
    : null;
  if (!data) return lastTurn;
  const fromViz = mapDocs(data.documents);
  if (!fromViz.length) return lastTurn;
  if (lastTurn.documents.length === 0) {
    lastTurn = { ...lastTurn, documents: fromViz, ts: Date.now() };
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
