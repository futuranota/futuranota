import { daysBetween } from "../data.jsx";
import { parseDate, startOfCalendarDay } from "../temporal.js";
import { todayDateInputValue } from "./docDates.js";
import {
  isKnowledgeDoc,
  isProductDoc,
  isTemplateDoc,
} from "./templateDoc.js";

/** YYYY-MM-DD from a local Date (no UTC round-trip). */
function calendarDateInputValue(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive calendar range for a folder reservation.
 * @param {object | null | undefined} doc
 * @returns {{ start: Date, finish: Date } | null}
 */
export function resolveFolderScheduleRange(doc) {
  if (!doc) return null;
  const startRaw = parseDate(doc.scheduleStartAt) || parseDate(doc.launchAt);
  if (!startRaw) return null;
  const finishRaw = parseDate(doc.scheduleFinishAt) || startRaw;
  const start = startOfCalendarDay(startRaw);
  let finish = startOfCalendarDay(finishRaw);
  if (finish.getTime() < start.getTime()) finish = start;
  return { start, finish };
}

/** Content/campaign folders in an Object — not products, knowledge, or templates. */
export function isReservableFolderDoc(doc) {
  if (!doc?.parentObjectId) return false;
  if (isProductDoc(doc) || isKnowledgeDoc(doc) || isTemplateDoc(doc)) return false;
  return true;
}

/**
 * @param {Iterable<object> | object[]} docs
 * @param {string} parentObjectId
 * @param {{ excludeDocId?: string | null }} [options]
 * @returns {Array<{ docId: string, start: Date, finish: Date, title: string }>}
 */
export function listObjectFolderReservations(docs, parentObjectId, options = {}) {
  if (!parentObjectId) return [];
  const excludeDocId = options.excludeDocId || null;
  const list = Array.isArray(docs) ? docs : Object.values(docs || {});
  /** @type {Array<{ docId: string, start: Date, finish: Date, title: string }>} */
  const out = [];
  for (const doc of list) {
    if (!doc || doc.id === excludeDocId) continue;
    if (doc.parentObjectId !== parentObjectId) continue;
    if (!isReservableFolderDoc(doc)) continue;
    const range = resolveFolderScheduleRange(doc);
    if (!range) continue;
    out.push({
      docId: doc.id,
      start: range.start,
      finish: range.finish,
      title: String(doc.title || doc.category || "Folder").trim() || "Folder",
    });
  }
  return out;
}

/** Inclusive overlap on calendar days. */
export function folderRangesOverlap(a, b) {
  if (!a || !b) return false;
  return a.start.getTime() <= b.finish.getTime()
    && a.finish.getTime() >= b.start.getTime();
}

/** Calendar day after `date` as YYYY-MM-DD (local). */
export function dayAfterDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return todayDateInputValue();
  const next = new Date(startOfCalendarDay(date));
  next.setDate(next.getDate() + 1);
  return calendarDateInputValue(next);
}

/**
 * Map of YYYY-MM-DD → reservation title for every reserved calendar day.
 * @param {Iterable<object> | object[]} docs
 * @param {string} parentObjectId
 * @param {{ excludeDocId?: string | null }} [options]
 * @returns {Map<string, { title: string, docId: string }>}
 */
export function buildReservedDateLookup(docs, parentObjectId, options = {}) {
  /** @type {Map<string, { title: string, docId: string }>} */
  const map = new Map();
  for (const r of listObjectFolderReservations(docs, parentObjectId, options)) {
    const cursor = new Date(r.start);
    const endMs = r.finish.getTime();
    while (cursor.getTime() <= endMs) {
      const key = calendarDateInputValue(cursor);
      if (!map.has(key)) {
        map.set(key, { title: r.title, docId: r.docId });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

/**
 * Picker floor: today. Do NOT use max(finish)+1 here — that blocked whole earlier
 * months when any folder had a later Launch/Finish (e.g. August blocked July).
 * Overlap is enforced by validateFolderSchedule on change/save.
 */
export function folderSchedulePickerMinDateInput() {
  return todayDateInputValue();
}

/**
 * Suggested start after the latest Finish (for conflict copy only).
 * @param {Iterable<object> | object[]} docs
 * @param {string} parentObjectId
 * @param {{ excludeDocId?: string | null }} [options]
 */
export function earliestFolderScheduleStartDateInput(docs, parentObjectId, options = {}) {
  const today = todayDateInputValue();
  const reservations = listObjectFolderReservations(docs, parentObjectId, options);
  if (!reservations.length) return today;
  let maxFinish = reservations[0].finish;
  for (const r of reservations) {
    if (r.finish.getTime() > maxFinish.getTime()) maxFinish = r.finish;
  }
  const nextInput = dayAfterDateInput(maxFinish);
  return nextInput > today ? nextInput : today;
}

/**
 * @param {string} startInput YYYY-MM-DD
 * @param {string} finishInput YYYY-MM-DD
 * @param {Iterable<object> | object[]} docs
 * @param {string} parentObjectId
 * @param {{ excludeDocId?: string | null }} [options]
 * @returns {{ ok: true } | { ok: false, code: string, conflict?: object, minStart?: string }}
 */
export function validateFolderSchedule(
  startInput,
  finishInput,
  docs,
  parentObjectId,
  options = {},
) {
  const startStr = String(startInput || "").trim();
  const finishStr = String(finishInput || "").trim();
  if (!startStr || !finishStr) {
    return { ok: false, code: "required" };
  }
  const start = startOfCalendarDay(parseDate(`${startStr}T12:00:00`));
  const finish = startOfCalendarDay(parseDate(`${finishStr}T12:00:00`));
  if (!start || !finish) {
    return { ok: false, code: "invalid" };
  }
  if (finish.getTime() < start.getTime()) {
    return { ok: false, code: "finishBeforeStart" };
  }
  if (!parentObjectId) {
    return { ok: true };
  }
  const proposed = { start, finish };
  const reservations = listObjectFolderReservations(docs, parentObjectId, options);
  for (const other of reservations) {
    if (folderRangesOverlap(proposed, other)) {
      return {
        ok: false,
        code: "overlap",
        conflict: other,
        // Suggest day after the conflicting reservation (not global max).
        minStart: dayAfterDateInput(other.finish),
      };
    }
  }
  return { ok: true };
}

/**
 * Inclusive day count for Start→Finish (1 = same day).
 * @param {string} startInput
 * @param {string} finishInput
 */
export function folderScheduleDurationDays(startInput, finishInput) {
  const startStr = String(startInput || "").trim();
  const finishStr = String(finishInput || "").trim();
  if (!startStr || !finishStr) return null;
  const start = parseDate(`${startStr}T12:00:00`);
  const finish = parseDate(`${finishStr}T12:00:00`);
  if (!start || !finish) return null;
  const gap = daysBetween(startOfCalendarDay(start), startOfCalendarDay(finish));
  if (!Number.isFinite(gap) || gap < 0) return null;
  return gap + 1;
}

/**
 * @param {string} startInput
 * @param {string} finishInput
 * @param {(key: string, vars?: object) => string} [t]
 */
export function formatFolderScheduleDuration(startInput, finishInput, t) {
  const days = folderScheduleDurationDays(startInput, finishInput);
  if (days == null) return null;
  if (typeof t === "function") {
    return t("meta.scheduleDurationDays", { count: days, s: days === 1 ? "" : "s" });
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}
