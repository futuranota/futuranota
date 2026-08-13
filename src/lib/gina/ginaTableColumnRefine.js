/**
 * Live table schema + NL refine against last shown Gina table.
 * Column names + cell values; typos / synonyms; multi-column AND filters.
 * Bridge: any phrase matching a live cell → filter + show (never ask to list).
 *
 * Hard rule: category / document / department / dayBadge match ONLY live
 * valuesByKey (any user corpus — Birthday, not a hardcoded cat list).
 * Status + hoy/vigentes use fixed product / calendar semantics.
 */

import { foldGinaText, dayKey, startOfDay, addDays, toDate } from "./ginaTimeScope.js";
import { nearMatchToken } from "./ginaFuzzyMatch.js";
import { GINA_TABLE_MAX_PREDICATES } from "./ginaTableViewContract.js";

function fold(s) {
  return foldGinaText(s);
}

/** @type {Record<"es"|"en", Record<string, string>>} */
export const GINA_TABLE_COLUMN_LABELS = {
  es: {
    document: "Documento",
    department: "Departamento",
    category: "Categoría",
    path: "Ruta",
    status: "Estado",
    time: "Fecha y Hora",
    folder: "Folder",
    weekday: "Día",
  },
  en: {
    document: "Document",
    department: "Department",
    category: "Category",
    path: "Path",
    status: "Status",
    time: "Date and time",
    folder: "Folder",
    weekday: "Day",
  },
};

const ROLE_BY_KEY = {
  document: "title",
  department: "department",
  category: "category",
  path: "path",
  status: "status",
  time: "schedule",
  folder: "folder",
  weekday: "weekday",
};

/**
 * @param {string} [locale]
 */
export function ginaTableColumnLabel(key, locale = "es") {
  const loc = locale === "en" ? "en" : "es";
  return GINA_TABLE_COLUMN_LABELS[loc][key] || key;
}

/**
 * Build schema from a rendered table visualization payload.
 * @param {{
 *   type?: string,
 *   data?: {
 *     columns?: string[],
 *     documents?: object[],
 *     view?: object,
 *     fromCountDocuments?: boolean,
 *     locale?: string,
 *   },
 * } | null | undefined} visualization
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaTableSchemaFromVisualization(visualization, opts = {}) {
  if (!visualization || visualization.type !== "table") return null;
  const data = visualization.data && typeof visualization.data === "object"
    ? visualization.data
    : null;
  if (!data) return null;

  const locale = opts.locale === "en" || data.locale === "en" ? "en" : "es";
  const docs = Array.isArray(data.documents) ? data.documents : [];
  /** @type {string[]} */
  let keys = Array.isArray(data.columns) && data.columns.length
    ? data.columns.map((k) => String(k || "").trim()).filter(Boolean)
    : [];

  if (!keys.length) {
    const fromCount = Boolean(data.fromCountDocuments);
    const view = data.view || {};
    keys = fromCount
      ? [
        "document",
        view.secondaryColumn === "folder" ? "folder" : "category",
        ...(view.showSchedule ? ["time"] : []),
        ...(view.showStatus ? ["status"] : []),
      ]
      : ["document", "path", "status", "time"];
  }

  const columns = keys.map((key) => ({
    key,
    label: ginaTableColumnLabel(key, locale),
    role: ROLE_BY_KEY[key] || key,
  }));

  /** @type {Record<string, string[]>} */
  const valuesByKey = {};
  for (const key of keys) {
    valuesByKey[key] = [];
    for (const doc of docs.slice(0, 80)) {
      pushUniqueValues(valuesByKey, key, cellDisplayValues(doc, key));
    }
  }

  // Always stamp department + dayBadge even when those keys are not visible columns
  // (rail / badges are filterable live surfaces for ANY user labels).
  for (const doc of docs.slice(0, 80)) {
    pushUniqueValues(valuesByKey, "department", cellDisplayValues(doc, "department"));
    if (doc.dayBadge) pushUniqueValues(valuesByKey, "time", [doc.dayBadge]);
  }
  const rail = Array.isArray(data.departmentRail)
    ? data.departmentRail
    : (data.railMode === "department" && Array.isArray(data.rail) ? data.rail : null);
  if (rail) {
    for (const seg of rail) {
      pushUniqueValues(valuesByKey, "department", [seg?.name]);
    }
  }

  return { locale, columns, valuesByKey };
}

/**
 * @param {Record<string, string[]>} valuesByKey
 * @param {string} key
 * @param {unknown} raw
 */
function pushUniqueValues(valuesByKey, key, raw) {
  if (!valuesByKey[key]) valuesByKey[key] = [];
  const seen = new Set(valuesByKey[key].map((v) => fold(v)));
  const list = Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    if (item == null) continue;
    const v = String(item).trim();
    const f = fold(v);
    if (!f || f === "-" || f === "—" || seen.has(f)) continue;
    if (valuesByKey[key].length >= 40) break;
    seen.add(f);
    valuesByKey[key].push(v);
  }
}

/**
 * Lightweight schema from lastTurn document stubs (when viz stamp missing).
 * @param {{ documents?: object[], department?: string|null }} last
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaTableSchemaFromLastTurn(last, opts = {}) {
  const docs = Array.isArray(last?.documents) ? last.documents : [];
  if (!docs.length) return null;
  const locale = opts.locale === "en" ? "en" : "es";
  const keys = ["document", "category", "folder", "department"];
  const columns = keys.map((key) => ({
    key,
    label: ginaTableColumnLabel(key, locale),
    role: ROLE_BY_KEY[key] || key,
  }));
  /** @type {Record<string, string[]>} */
  const valuesByKey = {};
  for (const key of keys) {
    const seen = new Set();
    /** @type {string[]} */
    const vals = [];
    for (const doc of docs) {
      for (const v of cellDisplayValues(doc, key)) {
        const f = fold(v);
        if (!f || seen.has(f) || f === "-" || f === "—") continue;
        seen.add(f);
        vals.push(String(v).trim());
      }
    }
    valuesByKey[key] = vals;
  }
  return { locale, columns, valuesByKey };
}

/**
 * @param {object} doc
 * @param {string} key
 * @returns {string[]}
 */
function cellDisplayValues(doc, key) {
  const h = doc?.hierarchy || {};
  switch (key) {
    case "document":
      return [doc.title || doc.name].filter(Boolean);
    case "department":
      return [doc.department || doc.departmentName || h.department].filter(Boolean);
    case "folder":
      return [doc.folder || doc.parentFolderName || h.folder].filter(Boolean);
    case "category": {
      const c = doc.category || h.category;
      if (!c || fold(c) === "uncategorized" || fold(c) === "sin categoria") {
        return ["sin categoria", "uncategorized"];
      }
      return [c];
    }
    case "path": {
      const path = [h.department || doc.department, h.category || doc.category, h.folder || doc.folder]
        .filter(Boolean)
        .join(" / ");
      return path ? [path] : [];
    }
    case "status":
      return doc.status ? [String(doc.status)] : [];
    case "time": {
      if (!doc.anchorAt && (doc.timeLabel === "Flexible" || doc.time === "Flexible" || !doc.timeLabel)) {
        return ["Flexible", "flexible", "sin horario"];
      }
      /** @type {string[]} */
      const out = [];
      if (doc.dayBadge) out.push(String(doc.dayBadge).trim());
      if (doc.timeLabel) out.push(String(doc.timeLabel).trim());
      else if (doc.time) out.push(String(doc.time).trim());
      return out.filter(Boolean);
    }
    case "weekday":
      return [doc.weekday].filter(Boolean);
    default:
      return [];
  }
}

/** Soft action / organize / filter cue for last-table bridge. */
function hasTableBridgeActionCue(q) {
  return (
    /\b(filtr\w*|organiz\w*|orden\w*|reorganiz\w*|agrup\w*|entreg\w*|dame|muestra\w*|trae\w*|quiero|solo|solamente|todos|todas|sobre|tabla|lista)\b/.test(q)
    || /\bpor\b/.test(q)
  );
}

/**
 * True when user likely wants to refine the last shown table (incl. organiza / por / quiero).
 * @param {string} text
 * @param {{ valuesByKey?: Record<string, string[]> } | null} [schema]
 */
export function wantsGinaTableColumnRefine(text, schema = null) {
  const q = fold(text);
  if (!q) return false;
  if (/\b(encontr\w*|busca\w*|find)\b/.test(q) && /\bdocumento/.test(q) && !/\btabla\b/.test(q)) {
    return false;
  }
  if (/\b(departamento|depto)\b/.test(q) && !/\b(esta\s+tabla|tabla\s+anterior|organiz|por)\b/.test(q)) {
    return false;
  }

  const tableCue = /\b(esta\s+tabla|tabla\s+anterior|de\s+esta\s+tabla|from\s+this\s+table|this\s+table|lista\s+anterior)\b/.test(q);
  const filterCue = /\b(filtr\w*|entreg\w*|dame|muestra\w*|trae\w*|quiero|solo|solamente|todos|todas|organiz\w*|orden\w*|reorganiz\w*|agrup\w*)\b/.test(q);

  if (/\bflexibl/.test(q) || nearMatchAny(q, ["flexible", "flexibles", "sin horario"])) return true;
  if (/\b(horario|horarios|hora|horas|vigente|vigentes|pasad|antelacion|antelación)\b/.test(q)) return true;
  if (/\bsin\s+categor\w*/.test(q) || /\buncategorized\b/.test(q)) return true;
  if (/\b(status|estado)\b/.test(q)) return true;
  if (matchStatusToken(q)) return true;
  if (/\b(hoy|today)\b/.test(q)) return true;
  if (tableCue && filterCue) return true;
  if (schema && matchGinaTableSchemaValue(text, schema)?.score >= 5) return true;
  if (filterCue && /\bpor\b/.test(q)) return true;
  if (!filterCue && !tableCue && !/\bpor\b/.test(q)) return false;
  return false;
}

/**
 * Match user text to the longest / best live cell value in stamped schema.
 * @param {string} text
 * @param {{
 *   columns?: Array<{ key: string, role?: string }>,
 *   valuesByKey?: Record<string, string[]>,
 * } | null} schema
 * @returns {{ key: string, role: string, value: string, score: number } | null}
 */
export function matchGinaTableSchemaValue(text, schema) {
  const all = matchAllGinaTableSchemaValues(text, schema, { max: 1 });
  return all[0] || null;
}

/**
 * All live cell hits in the user phrase (one best value per key), score ≥ 5.
 * Used for AND refine — values come only from stamped schema (Birthday, etc.).
 * @param {string} text
 * @param {{
 *   columns?: Array<{ key: string, role?: string }>,
 *   valuesByKey?: Record<string, string[]>,
 * } | null} schema
 * @param {{ max?: number }} [opts]
 * @returns {Array<{ key: string, role: string, value: string, score: number }>}
 */
export function matchAllGinaTableSchemaValues(text, schema, opts = {}) {
  const q = fold(text);
  if (!q || !schema?.valuesByKey) return [];
  const max = Math.max(1, Math.min(
    Number(opts.max) || GINA_TABLE_MAX_PREDICATES,
    GINA_TABLE_MAX_PREDICATES,
  ));

  const preferOrder = ["category", "folder", "department", "document", "status", "time", "weekday", "path"];
  /** @type {Array<{ key: string, role: string, value: string, score: number }>} */
  const candidates = [];

  const keys = [
    ...preferOrder.filter((k) => schema.valuesByKey[k]),
    ...Object.keys(schema.valuesByKey).filter((k) => !preferOrder.includes(k)),
  ];

  for (const key of keys) {
    const vals = schema.valuesByKey[key];
    if (!Array.isArray(vals) || !vals.length) continue;
    const role = ROLE_BY_KEY[key] || key;
    /** @type {{ key: string, role: string, value: string, score: number } | null} */
    let bestForKey = null;
    for (const v of vals) {
      const score = scorePhraseInQuery(q, v);
      if (score < 5) continue;
      if (!bestForKey || score > bestForKey.score) {
        bestForKey = { key, role, value: String(v).trim(), score };
      }
    }
    if (bestForKey) candidates.push(bestForKey);
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return fold(b.value).length - fold(a.value).length;
  });

  /** @type {Array<{ key: string, role: string, value: string, score: number }>} */
  const taken = [];
  for (const c of candidates) {
    if (taken.some((t) => t.key === c.key)) continue;
    const fc = fold(c.value);
    if (taken.some((t) => {
      const ft = fold(t.value);
      return ft.includes(fc) && ft.length > fc.length;
    })) continue;
    taken.push(c);
    if (taken.length >= max) break;
  }
  return taken;
}

/**
 * Higher = better. Multi-word category beats short token noise.
 * @param {string} q folded query
 * @param {string} phrase cell value
 */
function scorePhraseInQuery(q, phrase) {
  const fp = fold(phrase);
  if (!fp || fp.length < 3) return 0;
  if (fp === "-" || fp === "—") return 0;
  if ((fp === "flexible" || fp === "sin horario")
    && !/\bflexibl/.test(q)
    && !/\bsin\s+horario/.test(q)) {
    return 0;
  }
  if (q.includes(fp)) return fp.length + 20;
  const stemQ = softStemPhrase(q);
  const stemP = softStemPhrase(fp);
  if (stemP.length >= 4 && stemQ.includes(stemP)) return stemP.length + 15;
  const pToks = fp.split(/\s+/).filter((t) => t.length >= 3);
  if (pToks.length >= 2) {
    const qToks = q.split(/\s+/);
    let hit = 0;
    for (const pt of pToks) {
      const stemPt = softStemPhrase(pt);
      if (qToks.some((qt) => {
        const stemQt = softStemPhrase(qt);
        return qt.includes(pt) || pt.includes(qt)
          || stemQt === stemPt
          || nearMatchToken(qt, pt);
      })) {
        hit += 1;
      }
    }
    if (hit === pToks.length) return fp.length + 8;
    if (hit >= Math.ceil(pToks.length * 0.66) && hit >= 2) return fp.length;
  } else if (pToks.length === 1) {
    const pt = pToks[0];
    if (pt.length >= 5 && nearMatchAny(q, [pt])) return pt.length + 5;
  }
  return 0;
}

function softStemPhrase(s) {
  return fold(s)
    .split(/\s+/)
    .map((t) => t.replace(/ciones$/, "cion").replace(/es$/, "").replace(/s$/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function nearMatchAny(q, words) {
  const toks = q.split(/\s+/).filter((t) => t.length >= 4);
  for (const w of words) {
    if (q.includes(fold(w))) return true;
    for (const t of toks) {
      if (nearMatchToken(t, w)) return true;
    }
  }
  return false;
}

/**
 * Parse NL refine against stamped schema → predicates.
 * @param {string} text
 * @param {{
 *   locale?: string,
 *   columns?: Array<{ key: string, label: string, role: string }>,
 *   valuesByKey?: Record<string, string[]>,
 * } | null} schema
 * @param {Date} [now]
 */
export function parseGinaTableColumnRefine(text, schema, now = new Date()) {
  const q = fold(text);
  if (!q) return null;

  /** @type {Array<{ role: string, key: string, kind: string, dayOffset?: number, status?: string, needle?: string }>} */
  const predicates = [];

  const scheduleCol = pickColumn(schema, "schedule") || { key: "time", role: "schedule", label: "time" };
  const categoryCol = pickColumn(schema, "category");
  const statusCol = pickColumn(schema, "status") || { key: "status", role: "status" };

  if (
    /\bflexibl/.test(q)
    || nearMatchAny(q, ["flexible", "flexibles"])
    || /\bsin\s+horario/.test(q)
  ) {
    predicates.push({ role: "schedule", key: scheduleCol.key, kind: "flexible_only" });
  }

  if (
    !predicates.some((p) => p.kind === "flexible_only")
    && (
      /\b(con\s+horario|tienen\s+horario|tienen\s+horas|con\s+horas|que\s+tienen\s+horario)\b/.test(q)
      || (/\bhorario/.test(q) && /\b(filtr|entreg|dame|muestra|todos|organiz)\b/.test(q)
        && !/\b(vigente|pasad|antel|flexible|sin\s+horario|hoy|today)\b/.test(q)
        && !/\ben\s+\d+\s+d/.test(q))
    )
  ) {
    predicates.push({ role: "schedule", key: scheduleCol.key, kind: "timed_only" });
  }

  if (/\b(vigente|vigentes|no\s+han?\s+pasad|que\s+faltan|futur)\b/.test(q)) {
    predicates.push({ role: "schedule", key: scheduleCol.key, kind: "upcoming" });
  }

  // Schedule "past" (hours already gone) — not the same as status past_due / "vencidos"
  if (
    /\b(horas?\s+pasad|ya\s+pasaron|atrasad)\b/.test(q)
    || (/\bpasad\b/.test(q) && !/\bpast\s+due\b/.test(q) && !matchStatusToken(q))
  ) {
    predicates.push({ role: "schedule", key: scheduleCol.key, kind: "past" });
  }

  if (/\b(hoy|today)\b/.test(q)) {
    predicates.push({
      role: "schedule",
      key: scheduleCol.key,
      kind: "day_offset",
      dayOffset: 0,
    });
  } else {
    const offsetMatch = q.match(/\b(?:en|de|dentro\s+de|con)\s+(\d+)\s+d[ií]as?(?:\s+de\s+antelaci[oó]n)?\b/)
      || q.match(/\b(\d+)\s+d[ií]as?\s+(?:de\s+)?antelaci[oó]n\b/)
      || q.match(/\b(?:in|within)\s+(\d+)\s+days?\b/);
    if (offsetMatch) {
      predicates.push({
        role: "schedule",
        key: scheduleCol.key,
        kind: "day_offset",
        dayOffset: Number(offsetMatch[1]),
      });
    }
  }

  if (/\bsin\s+categor\w*/.test(q) || /\buncategorized\b/.test(q) || /\bno\s+tienen\s+categor\w*/.test(q)) {
    const col = categoryCol || pickColumn(schema, "path") || { key: "category", role: "category" };
    predicates.push({ role: "category", key: col.key, kind: "uncategorized" });
  }

  // Product status enum — no need to say "estado"; aliases are fixed, not user categories.
  const statusHit = matchStatusToken(q);
  if (statusHit) {
    predicates.push({
      role: "status",
      key: statusCol.key,
      kind: "status_eq",
      status: statusHit,
    });
  }

  // Live cells (Birthday, custom depts, titles…) — merge with semantic preds (AND).
  const cellHits = matchAllGinaTableSchemaValues(text, schema, {
    max: GINA_TABLE_MAX_PREDICATES,
  });
  for (const hit of cellHits) {
    if (hit.key === "status" || hit.role === "status") {
      // Prefer status_eq from product aliases when present
      if (statusHit) continue;
    }
    if (hit.key === "time" || hit.role === "schedule") {
      const fv = fold(hit.value);
      if (predicates.some((p) => p.kind === "flexible_only")
        && (fv === "flexible" || fv === "sin horario")) {
        continue;
      }
      // day badges still useful as value_includes alongside hoy? skip if day_offset already set
      if (predicates.some((p) => p.kind === "day_offset" || p.kind === "upcoming" || p.kind === "past")) {
        // Keep badge needles that are not "hoy"/flexible — e.g. "14 Ago"
        if (fv === "flexible" || fv === "sin horario" || fv === "hoy" || fv === "today") continue;
      }
    }
    predicates.push({
      role: hit.role,
      key: hit.key,
      kind: "value_includes",
      needle: hit.value,
    });
  }

  if (!predicates.length) return null;

  const seen = new Set();
  const unique = [];
  for (const p of predicates) {
    const id = `${p.key}:${p.kind}:${p.dayOffset || ""}:${p.status || ""}:${fold(p.needle || "")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(p);
    if (unique.length >= GINA_TABLE_MAX_PREDICATES) break;
  }

  return {
    predicates: unique,
    nowIso: now instanceof Date ? now.toISOString() : new Date().toISOString(),
  };
}

/**
 * Bridge entry: when last table exists, parse refine even for “organiza por …”.
 * @param {string} text
 * @param {object | null} schema
 * @param {Date} [now]
 */
export function tryParseGinaLastTurnTableBridge(text, schema, now = new Date()) {
  if (!schema) return null;
  const q = fold(text);
  if (!q) return null;
  const hit = matchGinaTableSchemaValue(text, schema);
  const statusHit = matchStatusToken(q);
  const liveEnough = Boolean((hit && hit.score >= 5) || statusHit);
  if (!hasTableBridgeActionCue(q) && !liveEnough) return null;
  if (!wantsGinaTableColumnRefine(text, schema) && !liveEnough) return null;
  return parseGinaTableColumnRefine(text, schema, now);
}

/**
 * @param {object | null | undefined} schema
 * @param {string} role
 */
function pickColumn(schema, role) {
  const cols = Array.isArray(schema?.columns) ? schema.columns : [];
  return cols.find((c) => c.role === role) || null;
}

function matchStatusToken(q) {
  const map = [
    ["not_started", ["not_started", "sin empezar", "no empez", "not started"]],
    ["in_progress", ["in_progress", "en progreso", "in progress"]],
    ["past_due", ["past_due", "vencido", "vencidos", "past due"]],
    ["completed", ["completed", "completado", "completados", "completo"]],
    ["submitted", ["submitted", "entregado", "entregados"]],
    ["reserved", ["reserved", "reservado", "reservados"]],
    ["flexible", ["flexible", "flexibles"]],
  ];
  for (const [code, aliases] of map) {
    for (const a of aliases) {
      if (q.includes(fold(a))) return code;
    }
  }
  return null;
}

/**
 * @param {object[]} docs
 * @param {{ predicates: Array<{ kind: string, dayOffset?: number, status?: string, needle?: string }> }} refine
 * @param {Date} [now]
 */
export function filterDocsByTableColumnRefine(docs, refine, now = new Date()) {
  const list = Array.isArray(docs) ? docs : [];
  const preds = Array.isArray(refine?.predicates) ? refine.predicates : [];
  if (!preds.length) return list;
  const clock = now instanceof Date ? now : new Date();

  return list.filter((d) => preds.every((p) => docMatchesPredicate(d, p, clock)));
}

/**
 * @param {object} d
 * @param {{ kind: string, dayOffset?: number, status?: string, needle?: string, role?: string }} p
 * @param {Date} now
 */
function docMatchesPredicate(d, p, now) {
  const anchor = toDate(d?.anchorAt);
  const finish = toDate(d?.anchorFinishAt) || anchor;

  switch (p.kind) {
    case "flexible_only":
      return !anchor;
    case "timed_only":
      return Boolean(anchor);
    case "upcoming": {
      if (!anchor) return false;
      const end = finish || anchor;
      return end.getTime() >= startOfDay(now).getTime();
    }
    case "past": {
      if (!anchor) return false;
      const end = finish || anchor;
      return end.getTime() < startOfDay(now).getTime();
    }
    case "day_offset": {
      if (!anchor || p.dayOffset == null) return false;
      const target = dayKey(addDays(startOfDay(now), Number(p.dayOffset)));
      return dayKey(anchor) === target;
    }
    case "uncategorized": {
      const c = fold(d?.category);
      return !c || c === "uncategorized" || c === "sin categoria";
    }
    case "status_eq":
      return fold(d?.status) === fold(p.status);
    case "value_includes": {
      const needle = fold(p.needle || p.status || "");
      if (!needle) return false;
      const stemN = softStemPhrase(needle);
      const fieldsByRole = {
        category: [d?.category],
        folder: [d?.folder, d?.parentFolderName],
        department: [d?.departmentName, d?.department],
        title: [d?.title, d?.name],
        schedule: [d?.timeLabel, d?.time, d?.dayBadge],
        status: [d?.status],
      };
      const roleFields = fieldsByRole[p.role] || null;
      const blob = fold([
        ...(roleFields || [
          d?.timeLabel,
          d?.time,
          d?.dayBadge,
          d?.title,
          d?.name,
          d?.category,
          d?.status,
          d?.folder,
          d?.parentFolderName,
          d?.departmentName,
          d?.department,
        ]),
      ].filter(Boolean).join(" "));
      if (!blob) return false;
      if (blob.includes(needle)) return true;
      const stemBlob = softStemPhrase(blob);
      return Boolean(stemN && stemBlob.includes(stemN));
    }
    default:
      return true;
  }
}

/**
 * @param {{
 *   locale?: string,
 *   predicates?: Array<{ kind: string, dayOffset?: number, needle?: string }>,
 *   count?: number,
 *   empty?: boolean,
 * }} opts
 */
export function buildGinaTableColumnRefineMessage(opts = {}) {
  const en = opts.locale === "en";
  const n = Number(opts.count) || 0;
  const preds = Array.isArray(opts.predicates) ? opts.predicates : [];
  const kinds = preds.map((p) => p.kind);
  const valuePred = preds.find((p) => p.kind === "value_includes" && p.needle);

  if (opts.empty || n === 0) {
    if (valuePred?.needle) {
      return en
        ? `In that table I found no rows matching «${valuePred.needle}».`
        : `En esa tabla no encontré filas que coincidan con «${valuePred.needle}».`;
    }
    if (kinds.includes("flexible_only")) {
      return en
        ? "In that table there are no flexible (unscheduled) rows."
        : "En esa tabla no hay filas flexibles (sin horario).";
    }
    if (kinds.includes("uncategorized")) {
      return en
        ? "In that table there are no rows without a category."
        : "En esa tabla no hay filas sin categoría.";
    }
    return en
      ? "In that table I found no rows matching that filter."
      : "En esa tabla no encontré filas que coincidan con ese filtro.";
  }

  if (valuePred?.needle) {
    return en
      ? `Here are the ${n} row${n === 1 ? "" : "s"} for «${valuePred.needle}» from that table.`
      : `Aquí tienes ${n === 1 ? "la fila" : `las ${n} filas`} de «${valuePred.needle}» de esa tabla.`;
  }
  if (kinds.includes("flexible_only")) {
    return en
      ? `Here are the ${n} flexible row${n === 1 ? "" : "s"} from that table.`
      : `Aquí tienes ${n === 1 ? "la fila flexible" : `las ${n} filas flexibles`} de esa tabla.`;
  }
  if (kinds.includes("upcoming")) {
    return en
      ? `Here are ${n} upcoming scheduled row${n === 1 ? "" : "s"} from that table.`
      : `Aquí tienes ${n === 1 ? "el horario vigente" : `los ${n} horarios vigentes`} de esa tabla.`;
  }
  if (kinds.includes("past")) {
    return en
      ? `Here are ${n} past scheduled row${n === 1 ? "" : "s"} from that table.`
      : `Aquí tienes ${n === 1 ? "el horario pasado" : `los ${n} horarios pasados`} de esa tabla.`;
  }
  if (kinds.includes("timed_only")) {
    return en
      ? `Here are the ${n} scheduled row${n === 1 ? "" : "s"} from that table.`
      : `Aquí tienes ${n === 1 ? "la fila con horario" : `las ${n} filas con horario`} de esa tabla.`;
  }
  if (kinds.includes("uncategorized")) {
    return en
      ? `Here are ${n} row${n === 1 ? "" : "s"} without a category.`
      : `Aquí tienes ${n === 1 ? "la fila sin categoría" : `las ${n} filas sin categoría`}.`;
  }
  const dayPred = preds.find((p) => p.kind === "day_offset");
  if (dayPred?.dayOffset != null) {
    return en
      ? `Here are ${n} row${n === 1 ? "" : "s"} scheduled in ${dayPred.dayOffset} day${dayPred.dayOffset === 1 ? "" : "s"}.`
      : `Aquí tienes ${n === 1 ? "la fila" : `las ${n} filas`} a ${dayPred.dayOffset} día${dayPred.dayOffset === 1 ? "" : "s"}.`;
  }
  return en
    ? `Here are ${n} matching row${n === 1 ? "" : "s"} from that table.`
    : `Aquí tienes ${n === 1 ? "la fila" : `las ${n} filas`} filtradas de esa tabla.`;
}
