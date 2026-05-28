import {
  ForecastConditionIcon,
  ForecastIconRain,
  ForecastIconWind,
} from "./ForecastIcons.jsx";

function Temp({ value }) {
  return (
    <span className="forecast-temp">
      {value}
      <span className="forecast-temp__deg">°</span>
    </span>
  );
}

export function ForecastPeriodBlock({ period, compact = false }) {
  if (!period) return null;
  const wind = period.wind || {};

  return (
    <div className={"forecast-period" + (compact ? " forecast-period--compact" : "")}>
      <div className="forecast-period__head">
        <div className="forecast-period__main">
          <p className="forecast-period__title">
            <span className="forecast-period__date">{period.dateLabel}</span>
            {!compact ? (
              <>
                {" | "}
                {period.periodLabel}
              </>
            ) : null}
          </p>
          <div className="forecast-period__hero">
            <Temp value={period.temp} />
            <ForecastConditionIcon name={period.conditionIcon} size={compact ? 30 : 36} />
          </div>
        </div>
        <div className="forecast-period__stats">
          <span className="forecast-period__stat">
            <ForecastIconRain size={compact ? 11 : 12} />
            {period.precipPct}%
          </span>
          <span className="forecast-period__stat">
            <ForecastIconWind size={compact ? 11 : 12} />
            {wind.dir}{" "}
            {wind.speed} {wind.unit || "mph"}
          </span>
        </div>
      </div>
      <p className="forecast-period__desc">{period.description}</p>
    </div>
  );
}
