import { useEffect, useMemo, useRef, useState } from "react";
import { formatMmDdYy } from "../../lib/docDates.js";
import {
  buildReservedDateLookup,
  folderSchedulePickerMinDateInput,
} from "../../lib/folderScheduleReservation.js";
import { useI18n } from "../../i18n/useI18n.js";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** @param {string} yyyyMmDd */
function parseLocalDay(yyyyMmDd) {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** @param {Date} d */
function toInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} startKey
 * @param {string} endKey
 * @param {Map<string, unknown>} reservedLookup
 */
function rangeIncludesReserved(startKey, endKey, reservedLookup) {
  const start = parseLocalDay(startKey);
  const end = parseLocalDay(endKey);
  if (!start || !end) return false;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const key = toInputValue(cursor);
    if (reservedLookup.has(key)) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

/** @param {string} start @param {string} finish */
export function formatScheduleRangeDisplay(start, finish) {
  const a = formatMmDdYy(start);
  const b = formatMmDdYy(finish);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  if (a) return `${a} – …`;
  return "";
}

/**
 * Single calendar: first click = start, second click = end (range).
 */
export function FolderScheduleRangeField({
  label,
  startValue = "",
  finishValue = "",
  onStartChange,
  onFinishChange,
  minDate = "",
  allDocs = null,
  parentId = "",
  excludeDocId = null,
}) {
  const { t } = useI18n();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [hoverDay, setHoverDay] = useState("");
  const [blockedHint, setBlockedHint] = useState(false);

  const floor = minDate || folderSchedulePickerMinDateInput();
  const focusDate =
    parseLocalDay(startValue) || parseLocalDay(floor) || new Date();
  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth());

  const reservedLookup = useMemo(
    () => buildReservedDateLookup(allDocs || [], parentId, { excludeDocId }),
    [allDocs, parentId, excludeDocId],
  );

  const activeStart = pickingEnd ? draftStart : startValue;
  const previewEnd = pickingEnd
    ? (hoverDay && hoverDay >= draftStart ? hoverDay : "")
    : finishValue;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setPickingEnd(false);
        setBlockedHint(false);
        setHoverDay("");
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPickingEnd(false);
        setBlockedHint(false);
        setHoverDay("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focus = parseLocalDay(startValue) || parseLocalDay(floor) || new Date();
    setViewYear(focus.getFullYear());
    setViewMonth(focus.getMonth());
  }, [open, startValue, floor]);

  useEffect(() => {
    if (!open) return;
    setPickingEnd(false);
    setDraftStart("");
    setBlockedHint(false);
    setHoverDay("");
  }, [open]);

  const monthLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  }, [viewYear, viewMonth]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    /** @type {Array<null | object>} */
    const out = [];
    for (let i = 0; i < startPad; i += 1) out.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = toInputValue(new Date(viewYear, viewMonth, day));
      const reserved = reservedLookup.get(key) || null;
      const beforeMin = Boolean(floor && key < floor);
      const rangeEnd = previewEnd || (pickingEnd ? draftStart : "");
      const inRange =
        Boolean(activeStart)
        && Boolean(rangeEnd)
        && key >= activeStart
        && key <= rangeEnd;
      const isStart = key === activeStart;
      const isFinish = Boolean(previewEnd) && key === previewEnd;
      const isDraftStart = pickingEnd && key === draftStart;
      out.push({
        key,
        day,
        reserved: Boolean(reserved),
        reservedTitle: reserved?.title || "",
        disabled: beforeMin || Boolean(reserved),
        inRange,
        isStart: isStart || isDraftStart,
        isFinish,
      });
    }
    return out;
  }, [
    viewYear,
    viewMonth,
    reservedLookup,
    floor,
    activeStart,
    previewEnd,
    pickingEnd,
    draftStart,
  ]);

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const display =
    formatScheduleRangeDisplay(startValue, finishValue)
    || t("meta.scheduleRangePlaceholder");

  const pickDay = (key) => {
    setBlockedHint(false);
    if (!pickingEnd) {
      setDraftStart(key);
      setPickingEnd(true);
      setHoverDay("");
      onStartChange?.(key);
      onFinishChange?.("");
      return;
    }

    if (key < draftStart) {
      setDraftStart(key);
      onStartChange?.(key);
      return;
    }

    if (rangeIncludesReserved(draftStart, key, reservedLookup)) {
      setBlockedHint(true);
      return;
    }

    onStartChange?.(draftStart);
    onFinishChange?.(key);
    setPickingEnd(false);
    setDraftStart("");
    setHoverDay("");
    setOpen(false);
  };

  return (
    <div className="doc-meta-field doc-meta-field--schedule-date" ref={rootRef}>
      <span className="doc-meta-field-k">{label || t("meta.scheduleRange")}</span>
      <button
        type="button"
        className={
          "doc-meta-schedule-date-trigger"
          + (open ? " is-open" : "")
          + (!(startValue && finishValue) ? " is-empty" : "")
        }
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {display}
      </button>
      {open ? (
        <div
          className="doc-meta-schedule-cal"
          role="dialog"
          aria-label={label || t("meta.scheduleRange")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="doc-meta-schedule-cal__head">
            <button
              type="button"
              className="doc-meta-schedule-cal__nav"
              onClick={() => shiftMonth(-1)}
              aria-label={t("meta.schedulePrevMonth")}
            >
              ‹
            </button>
            <span className="doc-meta-schedule-cal__month">{monthLabel}</span>
            <button
              type="button"
              className="doc-meta-schedule-cal__nav"
              onClick={() => shiftMonth(1)}
              aria-label={t("meta.scheduleNextMonth")}
            >
              ›
            </button>
          </div>
          <div className="doc-meta-schedule-cal__weekdays" aria-hidden>
            {WEEKDAYS.map((w) => (
              <span key={w} className="doc-meta-schedule-cal__wd">{w}</span>
            ))}
          </div>
          <div className="doc-meta-schedule-cal__grid">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <span key={`pad-${idx}`} className="doc-meta-schedule-cal__pad" />;
              }
              const title = cell.reserved
                ? t("meta.scheduleDayReserved", { title: cell.reservedTitle })
                : undefined;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={
                    "doc-meta-schedule-cal__day"
                    + (cell.isStart || cell.isFinish ? " is-selected" : "")
                    + (cell.inRange ? " is-in-range" : "")
                    + (cell.reserved ? " is-reserved" : "")
                    + (cell.disabled ? " is-disabled" : "")
                  }
                  disabled={cell.disabled}
                  title={title}
                  onMouseEnter={() => {
                    if (pickingEnd && !cell.disabled) setHoverDay(cell.key);
                  }}
                  onMouseLeave={() => {
                    if (pickingEnd) setHoverDay("");
                  }}
                  onClick={() => {
                    if (cell.disabled) return;
                    pickDay(cell.key);
                  }}
                >
                  <span className="doc-meta-schedule-cal__day-num">{cell.day}</span>
                </button>
              );
            })}
          </div>
          {pickingEnd ? (
            <p className="doc-meta-schedule-cal__hint">{t("meta.scheduleRangePickEnd")}</p>
          ) : null}
          {blockedHint ? (
            <p className="doc-meta-schedule-cal__hint is-error">{t("meta.scheduleRangeBlocked")}</p>
          ) : null}
          {!pickingEnd && !blockedHint && reservedLookup.size > 0 ? (
            <p className="doc-meta-schedule-cal__hint">{t("meta.scheduleReservedHint")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
