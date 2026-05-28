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

export function ForecastPeriodBlock({ period }) {
  if (!period) return null;
  const wind = period.wind || {};

  return (
    <div className="forecast-period">
      <div className="forecast-period__head">
        <div className="forecast-period__main">
          <p className="forecast-period__title">
            <span className="forecast-period__date">{period.dateLabel}</span>
            {" | "}
            {period.periodLabel}
          </p>
          <div className="forecast-period__hero">
            <Temp value={period.temp} />
            <ForecastConditionIcon name={period.conditionIcon} />
          </div>
        </div>
        <div className="forecast-period__stats">
          <span className="forecast-period__stat">
            <ForecastIconRain size={14} />
            {period.precipPct}%
          </span>
          <span className="forecast-period__stat">
            <ForecastIconWind size={14} />
            {wind.dir}{" "}
            {wind.speed} {wind.unit || "mph"}
          </span>
        </div>
      </div>
      <p className="forecast-period__desc">{period.description}</p>
    </div>
  );
}
