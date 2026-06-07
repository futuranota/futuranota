import { useLayoutEffect, useRef, useState } from "react";
import { EVENT_CALENDAR_RANGE_OPTIONS } from "../../lib/eventCalendarSearch.js";

export function EventCalendarRangeSwitch({ value, onChange, disabled = false }) {
  const refs = useRef([]);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const idx = EVENT_CALENDAR_RANGE_OPTIONS.findIndex((o) => o.id === value);
    const el = refs.current[idx >= 0 ? idx : 0];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  return (
    <div
      className="forecast-period-switch cal-event-range-switch"
      role="tablist"
      aria-label="Event search range"
      aria-disabled={disabled || undefined}
    >
      <div
        className="forecast-period-switch-thumb"
        style={{ left: thumb.left, width: thumb.width }}
      />
      {EVENT_CALENDAR_RANGE_OPTIONS.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          ref={(el) => { refs.current[i] = el; }}
          className="forecast-period-switch__btn"
          data-on={value === o.id ? "1" : "0"}
          disabled={disabled}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
