import { ForecastMetricIcon } from "./ForecastIcons.jsx";

export function ForecastMetricsGrid({ metrics = [] }) {
  if (!metrics.length) return null;

  return (
    <div className="forecast-metrics-card">
      <ul className="forecast-metrics-grid">
        {metrics.map((m) => (
          <li
            key={m.id}
            className="forecast-metrics-row"
            style={m.span === 2 ? { gridColumn: "span 2" } : undefined}
          >
            <ForecastMetricIcon name={m.icon} size={16} />
            {m.span === 2 ? (
              <p className="forecast-metrics-row__phase">{m.label}</p>
            ) : (
              <>
                <p className="forecast-metrics-row__label">{m.label}</p>
                <p className="forecast-metrics-row__value">{m.value}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
