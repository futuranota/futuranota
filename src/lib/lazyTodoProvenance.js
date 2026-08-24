import { anchorFieldsFromIso } from "./nodeAnchor.js";
import { todayDateInputValue, formatMmDdYy } from "./docDates.js";
import { lazyTodoHasContent } from "./lazyTodoItemKeyDown.js";

/** Bucket key when the linked document has no schedule date. */
export const LAZY_TODO_UNSCHEDULED_DAY_KEY = "__unscheduled__";

/**
 * Local calendar YYYY-MM-DD for a document (node), or empty string.
 * @param {object|null|undefined} node
 */
export function scheduleDayKeyForNode(node) {
  if (!node || typeof node !== "object") return "";
  const explicit = String(node.anchorDate || "").trim();
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const fromIso = anchorFieldsFromIso(node.anchorAt || null).anchorDate;
  return String(fromIso || "").trim();
}

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem|null|undefined} item
 * @param {Record<string, object>} [nodesById]
 */
export function scheduleDayKeyForLazyTodo(item, nodesById = {}) {
  const documentId = item?.documentId != null ? String(item.documentId).trim() : "";
  if (!documentId) return LAZY_TODO_UNSCHEDULED_DAY_KEY;
  const day = scheduleDayKeyForNode(nodesById[documentId]);
  return day || LAZY_TODO_UNSCHEDULED_DAY_KEY;
}

/**
 * Provenance for a lazy todo linked to a document (node).
 * Folder = parent doc box; day = document schedule (not a todo-owned date).
 *
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem|null|undefined} item
 * @param {{
 *   nodesById?: Record<string, object>,
 *   docsById?: Record<string, object>,
 * }} [opts]
 */
export function resolveLazyTodoProvenance(item, opts = {}) {
  const nodesById = opts.nodesById || {};
  const docsById = opts.docsById || {};
  const documentId = item?.documentId != null ? String(item.documentId).trim() : "";
  if (!documentId) {
    return {
      documentId: null,
      documentTitle: "",
      folderId: null,
      folderTitle: "",
      anchorDate: "",
      dayKey: LAZY_TODO_UNSCHEDULED_DAY_KEY,
      canOpenDocument: false,
      canOpenFolder: false,
    };
  }

  const node = nodesById[documentId] || null;
  const documentTitle = String(node?.title || node?.sourceQuery || item?.listTitle || "").trim();
  const folderId = node?.parentDocId != null ? String(node.parentDocId).trim() : "";
  const folder = folderId ? docsById[folderId] : null;
  const folderTitle = String(folder?.title || folder?.name || "").trim();
  const anchorDate = scheduleDayKeyForNode(node);
  const dayKey = anchorDate || LAZY_TODO_UNSCHEDULED_DAY_KEY;

  return {
    documentId,
    documentTitle,
    folderId: folderId || null,
    folderTitle,
    anchorDate,
    dayKey,
    canOpenDocument: Boolean(node),
    canOpenFolder: Boolean(folderId && folder),
  };
}

/**
 * @param {string} dayKey
 * @param {string} [today]
 */
export function addCalendarDays(dayKey, deltaDays) {
  const base = String(dayKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(deltaDays || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} dayKey
 * @param {{ today?: string }} [opts]
 * @returns {'today' | 'tomorrow' | 'past' | 'future' | 'unscheduled'}
 */
export function classifyLazyTodoDayKey(dayKey, opts = {}) {
  const key = String(dayKey || "").trim() || LAZY_TODO_UNSCHEDULED_DAY_KEY;
  if (key === LAZY_TODO_UNSCHEDULED_DAY_KEY) return "unscheduled";
  const today = String(opts.today || todayDateInputValue()).trim();
  if (key === today) return "today";
  if (key === addCalendarDays(today, 1)) return "tomorrow";
  return key < today ? "past" : "future";
}

/**
 * Stable sort: today → tomorrow → future (asc) → past (desc) → unscheduled.
 * @param {string} a
 * @param {string} b
 * @param {string} [today]
 */
export function compareLazyTodoDayKeys(a, b, today = todayDateInputValue()) {
  const rank = (key) => {
    const kind = classifyLazyTodoDayKey(key, { today });
    if (kind === "today") return 0;
    if (kind === "tomorrow") return 1;
    if (kind === "future") return 2;
    if (kind === "past") return 3;
    return 4;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 2) return String(a).localeCompare(String(b));
  if (ra === 3) return String(b).localeCompare(String(a));
  return 0;
}

/**
 * @param {string} dayKey
 * @param {{ today?: string, locale?: string }} [opts]
 */
export function formatLazyTodoDayLabel(dayKey, opts = {}) {
  const kind = classifyLazyTodoDayKey(dayKey, { today: opts.today });
  if (kind === "unscheduled") {
    return { kind, dayKey: LAZY_TODO_UNSCHEDULED_DAY_KEY, display: "" };
  }
  const display = formatMmDdYy(dayKey) || dayKey;
  return { kind, dayKey, display };
}

/**
 * Group contentful queued/active items by linked document schedule day.
 *
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items
 * @param {{
 *   nodesById?: Record<string, object>,
 *   today?: string,
 *   requireContent?: boolean,
 * }} [opts]
 * @returns {{ dayKey: string, kind: string, display: string, items: import("../stores/lazyTodosStore.js").LazyTodoItem[] }[]}
 */
export function groupLazyTodosByScheduleDay(items, opts = {}) {
  const nodesById = opts.nodesById || {};
  const today = String(opts.today || todayDateInputValue()).trim();
  const requireContent = opts.requireContent !== false;
  const buckets = new Map();

  for (const item of items || []) {
    if (!item?.id) continue;
    if (requireContent && !lazyTodoHasContent(item)) continue;
    const dayKey = scheduleDayKeyForLazyTodo(item, nodesById);
    if (!buckets.has(dayKey)) buckets.set(dayKey, []);
    buckets.get(dayKey).push(item);
  }

  const keys = [...buckets.keys()].sort((a, b) => compareLazyTodoDayKeys(a, b, today));
  return keys.map((dayKey) => {
    const meta = formatLazyTodoDayLabel(dayKey, { today });
    const list = [...buckets.get(dayKey)].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime()
        - new Date(a.updatedAt || a.createdAt).getTime(),
    );
    return {
      dayKey,
      kind: meta.kind,
      display: meta.display,
      items: list,
    };
  });
}
