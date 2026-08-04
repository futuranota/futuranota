import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { todayDateInputValue } from "../../../lib/docDates.js";

const TIME_STEP_MINUTES = 15;

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function timeFromMinutes(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTime(value) {
  const minutes = minutesFromTime(value);
  if (minutes == null) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${period}`;
}

function overlapsOccupied(time, occupied) {
  const point = minutesFromTime(time);
  if (point == null) return false;
  return occupied.some((interval) => {
    if (Number.isFinite(interval?.startMs) && Number.isFinite(interval?.finishMs)) {
      const startD = new Date(interval.startMs);
      const finishD = new Date(interval.finishMs);
      const start = startD.getHours() * 60 + startD.getMinutes();
      const finish = finishD.getHours() * 60 + finishD.getMinutes();
      return point >= start && point < finish;
    }
    // Legacy HH:mm-HH:mm strings
    const raw = String(interval?.time || "");
    const [left, right] = raw.split(/[-–]/);
    const start = minutesFromTime(left?.trim());
    const finish = minutesFromTime(right?.trim());
    return start != null && finish != null && point >= start && point < finish;
  });
}

/** Earliest selectable slot at/after now, snapped up to the 15-minute grid. */
function earliestSelectableMinutes(now = new Date()) {
  const raw = now.getHours() * 60 + now.getMinutes();
  const rem = raw % TIME_STEP_MINUTES;
  if (rem === 0) return raw;
  return Math.min(24 * 60 - TIME_STEP_MINUTES, raw + (TIME_STEP_MINUTES - rem));
}

/** Optional date/time range for Title and Checkbox blocks (node + wires). */
export function BlockAnchorFields({
  anchorDate = "",
  anchorTime = "",
  anchorFinishTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  onAnchorFinishTimeChange,
  readOnly = false,
  className = "",
  hideLabel = false,
  /** Visible label when hideLabel is false (e.g. "Schedule" or "Launch date"). */
  label = "Schedule",
  showContentToggle = false,
  contentExpanded = true,
  onContentToggle,
  /** YYYY-MM-DD inclusive floor from parent folder reservation (optional). */
  minDate = "",
  /** YYYY-MM-DD inclusive ceiling from parent folder reservation (optional). */
  maxDate = "",
  occupied = [],
  overlapHint = "",
  validationError = "",
  enableTimeRange = false,
}) {
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const gridRef = useRef(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [selectingFinish, setSelectingFinish] = useState(false);
  /** Refresh past-slot cutoff while the popover is open. */
  const [nowTick, setNowTick] = useState(() => Date.now());
  const rootClass = [
    "doc-block-anchor",
    readOnly ? "doc-block-anchor--readonly" : "",
    showContentToggle ? "doc-block-anchor--with-toggle" : "",
    showContentToggle && !contentExpanded ? "doc-block-anchor--content-collapsed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const min = String(minDate || "").trim() || undefined;
  const max = String(maxDate || "").trim() || undefined;
  const startMinutes = minutesFromTime(anchorTime);
  const finishMinutes = minutesFromTime(anchorFinishTime);
  const isToday = String(anchorDate || "").trim() === todayDateInputValue();
  const earliestMinutes = useMemo(
    () => (isToday ? earliestSelectableMinutes(new Date(nowTick)) : 0),
    [isToday, nowTick],
  );
  const earliestTimeValue = isToday ? timeFromMinutes(earliestMinutes) : undefined;
  const slots = useMemo(
    () => Array.from(
      { length: (24 * 60) / TIME_STEP_MINUTES },
      (_, index) => timeFromMinutes(index * TIME_STEP_MINUTES),
    ),
    [],
  );
  const rangeLabel = anchorTime && anchorFinishTime
    ? `${formatTime(anchorTime)} – ${formatTime(anchorFinishTime)}`
    : "Select time range";

  useEffect(() => {
    if (!timeOpen) return undefined;
    const close = (event) => {
      const clickedTrigger = rootRef.current?.contains(event.target);
      const clickedPopover = popoverRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedPopover) {
        setTimeOpen(false);
        setSelectingFinish(false);
      }
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setTimeOpen(false);
        setSelectingFinish(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [timeOpen]);

  useEffect(() => {
    if (!timeOpen) return undefined;
    setNowTick(Date.now());
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [timeOpen]);

  useEffect(() => {
    if (!timeOpen || !gridRef.current) return;
    const targetTime = (anchorTime && minutesFromTime(anchorTime) >= earliestMinutes)
      ? anchorTime
      : (isToday ? timeFromMinutes(earliestMinutes) : "08:00");
    const target = gridRef.current.querySelector(`[data-time="${targetTime}"]`);
    target?.scrollIntoView?.({ block: "center" });
  }, [timeOpen, anchorTime, earliestMinutes, isToday]);

  const selectSlot = (time) => {
    const timeMinutes = minutesFromTime(time);
    if (timeMinutes == null) return;
    if (isToday && timeMinutes < earliestMinutes) return;
    if (!anchorTime || !selectingFinish) {
      onAnchorTimeChange?.(time);
      if (anchorFinishTime && minutesFromTime(anchorFinishTime) <= timeMinutes) {
        onAnchorFinishTimeChange?.("");
      }
      setSelectingFinish(true);
      return;
    }
    if (timeMinutes <= minutesFromTime(anchorTime)) return;
    onAnchorFinishTimeChange?.(time);
    setSelectingFinish(false);
  };

  return (
    <div className={rootClass} ref={rootRef}>
      {showContentToggle ? (
        <button
          type="button"
          className="doc-block-anchor__content-toggle"
          onClick={() => onContentToggle?.()}
          aria-expanded={contentExpanded}
          aria-label={contentExpanded ? "Collapse document content" : "Expand document content"}
          title={contentExpanded ? "Collapse content" : "Expand content"}
        >
          <span className="doc-block-anchor__content-chevron" aria-hidden />
        </button>
      ) : null}
      {hideLabel ? null : (
        <span className="doc-block-anchor__label">{label}</span>
      )}
      <input
        type="date"
        className="doc-block-anchor__date"
        value={anchorDate}
        min={min}
        max={max}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : 0}
        aria-readonly={readOnly}
        onChange={readOnly ? undefined : (e) => onAnchorDateChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={label === "Launch date" ? "Launch date" : "Anchor date"}
      />
      {enableTimeRange ? (
      <div className="doc-time-range">
        <button
          type="button"
          className={"doc-time-range__trigger" + (anchorTime && anchorFinishTime ? "" : " is-empty")}
          onClick={() => !readOnly && setTimeOpen((value) => !value)}
          aria-expanded={timeOpen}
          aria-haspopup="dialog"
          disabled={readOnly}
        >
          {rangeLabel}
          <span className="doc-time-range__clock" aria-hidden>◷</span>
        </button>
        {timeOpen && typeof document !== "undefined" ? createPortal(
          <div
            ref={popoverRef}
            className="doc-time-range__popover"
            role="dialog"
            aria-label="Select time range"
          >
            <div className="doc-time-range__fields">
              <label>
                <span>Start</span>
                <input
                  type="time"
                  value={anchorTime}
                  min={earliestTimeValue}
                  step={TIME_STEP_MINUTES * 60}
                  onChange={(event) => {
                    const next = event.target.value;
                    const mins = minutesFromTime(next);
                    if (isToday && mins != null && mins < earliestMinutes) return;
                    onAnchorTimeChange?.(next);
                    setSelectingFinish(true);
                  }}
                  aria-label="Start time"
                />
              </label>
              <span className="doc-time-range__arrow" aria-hidden>→</span>
              <label>
                <span>Finish</span>
                <input
                  type="time"
                  value={anchorFinishTime}
                  min={
                    (() => {
                      const startMin = minutesFromTime(anchorTime);
                      if (startMin != null && (!isToday || startMin >= earliestMinutes)) {
                        return anchorTime;
                      }
                      return earliestTimeValue;
                    })()
                  }
                  step={TIME_STEP_MINUTES * 60}
                  onChange={(event) => {
                    const next = event.target.value;
                    const mins = minutesFromTime(next);
                    if (mins == null) return;
                    if (isToday && mins < earliestMinutes) return;
                    if (startMinutes != null && mins <= startMinutes) return;
                    onAnchorFinishTimeChange?.(next);
                  }}
                  aria-label="Finish time"
                />
              </label>
            </div>
            <div className="doc-time-range__phase">
              {selectingFinish && anchorTime
                ? `Choose a finish after ${formatTime(anchorTime)}`
                : (isToday
                  ? "Choose a start time (past hours unavailable)"
                  : "Choose a start time")}
            </div>
            <div className="doc-time-range__grid" ref={gridRef}>
              {slots.map((time) => {
                const timeMinutes = minutesFromTime(time);
                const isPast = isToday && timeMinutes < earliestMinutes;
                const unavailableFinish = selectingFinish
                  && startMinutes != null
                  && timeMinutes <= startMinutes;
                const unavailable = isPast || unavailableFinish;
                const inRange = startMinutes != null
                  && finishMinutes != null
                  && timeMinutes >= startMinutes
                  && timeMinutes <= finishMinutes;
                const occupiedSlot = overlapsOccupied(time, occupied);
                return (
                  <button
                    key={time}
                    type="button"
                    data-time={time}
                    className={
                      "doc-time-range__slot"
                      + (time === anchorTime ? " is-start" : "")
                      + (time === anchorFinishTime ? " is-finish" : "")
                      + (inRange ? " is-in-range" : "")
                      + (occupiedSlot ? " is-occupied" : "")
                      + (unavailableFinish ? " is-before-start" : "")
                      + (isPast ? " is-past" : "")
                    }
                    onClick={() => {
                      if (unavailable) return;
                      selectSlot(time);
                    }}
                    disabled={unavailable}
                    aria-disabled={unavailable}
                    aria-pressed={time === anchorTime || time === anchorFinishTime}
                    title={
                      isPast
                        ? "Past time unavailable"
                        : (occupiedSlot ? "Occupied, but selectable" : undefined)
                    }
                  >
                    {formatTime(time)}
                  </button>
                );
              })}
            </div>
            {occupied.length ? (
              <div className="doc-time-range__occupied-list">
                <span>Occupied hours</span>
                {occupied.map((interval) => (
                  <span key={interval.id}>
                    <s>{String(interval.time || "").replace("-", "–")}</s>
                    {" · "}
                    {interval.title}
                  </span>
                ))}
              </div>
            ) : null}
            {overlapHint || validationError ? (
              <p className="doc-time-range__hint">{validationError || overlapHint}</p>
            ) : null}
          </div>,
          document.body,
        ) : null}
      </div>
      ) : (
        <input
          type="time"
          className="doc-block-anchor__time"
          value={anchorTime}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : 0}
          aria-readonly={readOnly}
          onChange={readOnly ? undefined : (event) => onAnchorTimeChange?.(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={label === "Launch date" ? "Launch time" : "Anchor time"}
        />
      )}
    </div>
  );
}
