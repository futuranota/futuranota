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
 * Month grid date field with reserved days shown struck-through / disabled.
 */
export function FolderScheduleDateField({
  label,
  value = "",
  onChange,
  minDate = "",
  allDocs = null,
  parentId = "",
  excludeDocId = null,
}) {
  const { t } = useI18n();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const floor = minDate || folderSchedulePickerMinDateInput();
  const initialMonth = parseLocalDay(value) || parseLocalDay(floor) || new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  const reservedLookup = useMemo(
    () => buildReservedDateLookup(allDocs || [], parentId, { excludeDocId }),
    [allDocs, parentId, excludeDocId],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
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
    const focus = parseLocalDay(value) || parseLocalDay(floor) || new Date();
    setViewYear(focus.getFullYear());
    setViewMonth(focus.getMonth());
  }, [open, value, floor]);

  const monthLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [viewYear, viewMonth]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    /** @type {Array<null | { key: string, day: number, reserved: boolean, reservedTitle: string, disabled: boolean, selected: boolean }>} */
    const out = [];
    for (let i = 0; i < startPad; i += 1) out.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = toInputValue(new Date(viewYear, viewMonth, day));
      const reserved = reservedLookup.get(key) || null;
      const beforeMin = Boolean(floor && key < floor);
      out.push({
        key,
        day,
        reserved: Boolean(reserved),
        reservedTitle: reserved?.title || "",
        disabled: beforeMin || Boolean(reserved),
        selected: key === value,
      });
    }
    return out;
  }, [viewYear, viewMonth, reservedLookup, floor, value]);

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const display = formatMmDdYy(value) || "—";

  return (
    <div className="doc-meta-field doc-meta-field--schedule-date" ref={rootRef}>
      <span className="doc-meta-field-k">{label}</span>
      <button
        type="button"
        className={
          "doc-meta-schedule-date-trigger"
          + (open ? " is-open" : "")
          + (!value ? " is-empty" : "")
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
          aria-label={label}
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
                    + (cell.selected ? " is-selected" : "")
                    + (cell.reserved ? " is-reserved" : "")
                    + (cell.disabled ? " is-disabled" : "")
                  }
                  disabled={cell.disabled}
                  title={title}
                  onClick={() => {
                    if (cell.disabled) return;
                    onChange?.(cell.key);
                    setOpen(false);
                  }}
                >
                  <span className="doc-meta-schedule-cal__day-num">{cell.day}</span>
                </button>
              );
            })}
          </div>
          {reservedLookup.size > 0 ? (
            <p className="doc-meta-schedule-cal__hint">{t("meta.scheduleReservedHint")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
