import { useLayoutEffect, useRef, useState } from "react";

const OPTIONS = [
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
];

export function ForecastPeriodSwitch({ value, onChange }) {
  const refs = useRef([]);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const idx = OPTIONS.findIndex((o) => o.id === value);
    const el = refs.current[idx];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  return (
    <div
      className="forecast-period-switch"
      role="tablist"
      aria-label="Day or night forecast"
    >
      <div className="forecast-period-switch-thumb" style={{ left: thumb.left, width: thumb.width }} />
      {OPTIONS.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          ref={(el) => { refs.current[i] = el; }}
          className="forecast-period-switch__btn"
          data-on={value === o.id ? "1" : "0"}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
