import { useMemo } from "react";
import { getForecastMock } from "../../data/forecastMock.js";
import { ForecastDayAccordion } from "./ForecastDayAccordion.jsx";

export function ForecastPanel({ today = new Date() }) {
  const forecast = useMemo(() => getForecastMock(today), [today]);

  return (
    <div className="forecast-panel">
      <header className="forecast-panel__header">
        <h2 className="forecast-panel__title">Daily Forecast</h2>
        <p className="forecast-panel__location">
          <span className="forecast-panel__pin" aria-hidden>⌖</span>
          {forecast.location} · {forecast.asOf}
        </p>
      </header>
      <div className="forecast-panel__days">
        {forecast.days.map((day, i) => (
          <ForecastDayAccordion key={day.id} day={day} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
