import { useState } from "react";
import {
  ForecastConditionIcon,
  ForecastIconRain,
  ForecastIconWind,
} from "./ForecastIcons.jsx";
import { ForecastPeriodBlock } from "./ForecastPeriodBlock.jsx";
import { ForecastMetricsGrid } from "./ForecastMetricsGrid.jsx";
import { ForecastPeriodSwitch } from "./ForecastPeriodSwitch.jsx";

function TempPair({ high, low }) {
  return (
    <span className="forecast-summary__temps">
      <span className="forecast-summary__temp-high">
        {high}
        <span className="forecast-temp__deg">°</span>
      </span>
      {" / "}
      <span className="forecast-summary__temp-low">
        {low}
        <span className="forecast-temp__deg">°</span>
      </span>
    </span>
  );
}

export function ForecastDayAccordion({ day, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [periodMode, setPeriodMode] = useState("day");
  const wind = day.wind || {};
  const activePeriod = periodMode === "night" ? day.night : day.day;
  const activeMetrics = periodMode === "night" ? day.nightMetrics : day.dayMetrics;
  const summaryIcon = activePeriod?.conditionIcon || day.conditionIcon;
  const summaryCondition = activePeriod?.condition || day.condition;

  return (
    <article
      className={"forecast-accordion" + (open ? " is-open" : "")}
      data-state={open ? "open" : "closed"}
    >
      <h3 className="forecast-accordion__heading">
        <button
          type="button"
          className="forecast-accordion__trigger"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="forecast-accordion__summary">
            <span className="forecast-summary__label">{day.label}</span>
            <span className="forecast-summary__hide-when-open">
              <TempPair high={day.high} low={day.low} />
            </span>
            <span className="forecast-summary__hide-when-open forecast-summary__wx">
              <ForecastConditionIcon name={summaryIcon} size={24} />
              <span className="forecast-summary__condition">{summaryCondition}</span>
            </span>
            <span className="forecast-summary__hide-when-open forecast-summary__precip">
              <ForecastIconRain size={12} />
              {day.precipPct}%
            </span>
            <span className="forecast-summary__hide-when-open forecast-summary__wind">
              <ForecastIconWind size={12} />
              {wind.dir} {wind.speed} {wind.unit || "mph"}
            </span>
          </span>
          <span className="forecast-accordion__toggle" aria-hidden>
            <span className="forecast-accordion__icon forecast-accordion__icon--plus" />
            <span className="forecast-accordion__icon forecast-accordion__icon--minus" />
          </span>
        </button>
      </h3>
      {open ? (
        <div className="forecast-accordion__content" role="region">
          <ForecastPeriodSwitch value={periodMode} onChange={setPeriodMode} />
          <ForecastPeriodBlock period={activePeriod} compact />
          <ForecastMetricsGrid metrics={activeMetrics} compact />
        </div>
      ) : null}
    </article>
  );
}
