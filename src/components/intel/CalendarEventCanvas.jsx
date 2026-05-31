import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildEventNodePayload,
  buildEventNodeTitle,
  fetchEventsForNode,
} from "../../lib/eventCalendarSearch.js";
import {
  formatForecastUiDate,
  resolveForecastTargetDate,
} from "../../lib/forecastSearch.js";
import { CalendarEventResultBox } from "./CalendarEventResultBox.jsx";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";

const CALENDAR_EVENT_ILLUSTRATION = "/uploads/botones/e-c.svg";

function SearchIcon({ className = "", size = 14 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden
    >
      <circle
        cx="4.25"
        cy="4.25"
        r="2.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M6.2 6.2L8.5 8.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Empty event-calendar canvas — visible while calendar accordion is collapsed. */
export function CalendarEventCanvas({
  activeNode,
  today = new Date(),
  onInsertEventNode,
}) {
  const [phase, setPhase] = useState("empty");
  const [result, setResult] = useState(null);

  const targetKey = useMemo(() => {
    if (!activeNode) return "";
    const { date, scheduleIso } = resolveForecastTargetDate(activeNode);
    return `${activeNode.id}:${scheduleIso || ""}:${date?.getTime() || ""}`;
  }, [activeNode]);

  useEffect(() => {
    setPhase("empty");
    setResult(null);
  }, [targetKey]);

  const targetDate = activeNode ? resolveForecastTargetDate(activeNode).date : null;
  const pillDate = targetDate ? formatForecastUiDate(targetDate) : "";
  const canSearch = Boolean(activeNode && targetDate);

  const handleSearch = useCallback(async () => {
    if (!canSearch || phase === "loading") return;

    setPhase("loading");
    const next = await fetchEventsForNode(activeNode, today);
    setResult(next);

    if (next.status === "success") {
      setPhase("result");
    } else if (next.status === "empty") {
      setPhase("noEvent");
    } else {
      setPhase("error");
    }
  }, [activeNode, canSearch, phase, today]);

  const handleInsert = () => {
    if (!result || result.status !== "success" || !onInsertEventNode) return;
    onInsertEventNode({
      title: buildEventNodeTitle(result),
      payload: buildEventNodePayload(result),
      sourceNode: result.node,
      anchorAt: result.scheduleIso || null,
    });
  };

  if (phase === "result" && result?.status === "success") {
    return (
      <div className="cal-event-canvas cal-event-canvas--result" aria-label="Event calendar result">
        <CalendarEventResultBox result={result} onInsert={handleInsert} />
      </div>
    );
  }

  if (phase === "noEvent" || phase === "error") {
    return (
      <div className="cal-event-canvas cal-event-canvas--result" aria-label="Event calendar">
        <div className="cal-event-result cal-event-result--message" role="status">
          <p className="cal-event-result__message">{result?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cal-event-canvas" aria-label="Event calendar">
      <img
        src={CALENDAR_EVENT_ILLUSTRATION}
        alt=""
        className="cal-event-canvas__illustration"
        aria-hidden
      />
      <p className="cal-event-canvas__title">Event calendar</p>
      <p className="cal-event-canvas__hint">
        <svg className="cal-event-canvas__info" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M6 5.1V8.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <circle cx="6" cy="3.4" r="0.65" fill="currentColor" />
        </svg>
        What&apos;s an event calendar
      </p>
      <p className="cal-event-canvas__tagline">
        Anticipate Every Opportunity: The Ultimate Calendar for Brands That Make a Difference
      </p>

      <button
        type="button"
        className={
          "cal-event-canvas__search-pill"
          + (phase === "loading" ? " is-loading" : "")
          + (pillDate ? " has-date" : "")
        }
        onClick={handleSearch}
        disabled={!canSearch || phase === "loading"}
        aria-busy={phase === "loading"}
        aria-label={
          phase === "loading"
            ? "Searching events"
            : "Search events for schedule date"
        }
      >
        {phase === "loading" ? (
          <SearchSpinner size={14} />
        ) : (
          <>
            <span
              className={
                "cal-event-canvas__date tnum"
                + (pillDate ? "" : " cal-event-canvas__date--placeholder")
              }
            >
              {pillDate || "month/day"}
            </span>
            {!pillDate ? (
              <SearchIcon className="cal-event-canvas__search-icon" size={14} />
            ) : null}
          </>
        )}
      </button>
    </div>
  );
}
