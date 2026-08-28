import { useState } from "react";
import { daysBetween, fmtDate } from "../../data.jsx";
import { formatScheduleLabelFromIso } from "../../lib/nodeAnchor.js";
import { resolveActiveForecastNode, resolveForecastTargetDate, formatForecastUiDate } from "../../lib/forecastSearch.js";
import { CalendarEventCanvas } from "./CalendarEventCanvas.jsx";
import { IntelFolderAccordion } from "./IntelFolderAccordion.jsx";

function CalendarGrid({ today, launchDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState(null);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = `${months[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
  const startWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ day: prevMonthDays - startWeekday + i + 1, mute: true });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateObj = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    cells.push({
      day: d,
      dateObj,
      today: dateObj.toDateString() === today.toDateString(),
      event: launchDate && dateObj.toDateString() === launchDate.toDateString(),
    });
  }
  while (cells.length < 42) {
    cells.push({ day: cells.length - daysInMonth - startWeekday + 1, mute: true });
  }
  const daysUntilLaunch = launchDate ? daysBetween(today, launchDate) : null;

  return (
    <div className="cal">
      <div className="cal-nav">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <span className="cal-nav-mid">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`h${i}`} className="cal-h">{d}</div>
        ))}
        {cells.map((c, i) => {
          let cls = "cal-day";
          if (c.mute) cls += " mute";
          if (c.today) cls += " today";
          if (c.event) cls += " event";
          if (selected && c.dateObj && c.dateObj.toDateString() === selected.toDateString()) {
            cls += " selected";
          }
          return (
            <div
              key={i}
              className={cls}
              onClick={() => {
                if (c.dateObj) {
                  setSelected(c.dateObj);
                  onSelectDate?.(c.dateObj);
                }
              }}
            >
              {c.day}
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <div className="cal-legend__row">
          <span><span className="cal-legend__dot cal-legend__dot--today">●</span> Today</span>
          <span className="tnum mono">{fmtDate(today, "short")}</span>
        </div>
        {launchDate ? (
          <div className="cal-legend__row">
            <span><span className="cal-legend__dot cal-legend__dot--launch">●</span> Launch</span>
            <span className="tnum mono cal-legend__launch">T−{daysUntilLaunch}d</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CalendarPanel({
  today,
  launchDate,
  onSelectDate,
  scheduleHint = "",
  nodeEntities = {},
  docsById = {},
  expandedNodeId = null,
  selection = [],
  canvasNodes = [],
  onInsertEventNode,
}) {
  const [accordionOpen, setAccordionOpen] = useState(false);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = `${months[today.getMonth()]} ${today.getFullYear()}`;

  const activeNode = resolveActiveForecastNode(
    nodeEntities,
    { expandedNodeId, selection, canvasNodes },
    docsById,
  );

  return (
    <div className="cal-panel">
      <IntelFolderAccordion
        defaultOpen={false}
        onOpenChange={setAccordionOpen}
        summary={(
          <>
            <span className="forecast-summary__label">{monthLabel}</span>
            <span className="forecast-summary__hide-when-open forecast-summary__wx">
              <span className="forecast-summary__condition">{fmtDate(today, "short")}</span>
            </span>
            {scheduleHint ? (
              <span className="forecast-summary__hide-when-open forecast-summary__wind">
                {scheduleHint}
              </span>
            ) : null}
          </>
        )}
      >
        <CalendarGrid today={today} launchDate={launchDate} onSelectDate={onSelectDate} />
      </IntelFolderAccordion>

      {!accordionOpen ? (
        <CalendarEventCanvas
          activeNode={activeNode}
          today={today}
          onInsertEventNode={onInsertEventNode}
        />
      ) : null}
    </div>
  );
}

export function getScheduleHintForNode(node) {
  if (!node) return "";
  const { date, resolvedFrom, scheduleIso } = resolveForecastTargetDate(node);
  if (date) {
    if (resolvedFrom === "schedule" && scheduleIso) {
      const label = formatScheduleLabelFromIso(scheduleIso);
      if (label) return label.replace(/^schedule:\s*/, "");
    }
    return formatForecastUiDate(date);
  }
  if (node.createdAt) {
    const d = new Date(node.createdAt);
    if (Number.isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `created: ${mm}/${dd}`;
  }
  return "";
}
