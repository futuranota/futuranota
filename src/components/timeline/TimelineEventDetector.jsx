import { useState, useEffect } from "react";
import { useTimelineStore } from "../../stores/timelineStore.js";
import { EventSuggestion } from "./EventSuggestion.jsx";

/** Mock external events from dates (no live API — evita CORS/keys en dev) */
function buildMockEventsForDates(dates) {
  return dates.map((date) => {
    const month = parseInt(date.slice(5, 7), 10);
    const rainy = month >= 10 || month <= 3;
    return {
      id: `context-${date}`,
      date,
      type: "context",
      source: "Contexto (demo)",
      data: rainy
        ? "Posible lluvia en esa fecha — considera plan B en exterior."
        : "Clima favorable para actividades al aire libre.",
      icon: rainy ? "🌧️" : "☀️",
    };
  });
}

export function TimelineEventDetector({ dates }) {
  const externalEvents = useTimelineStore((s) => s.externalEvents);
  const dismissExternalEvent = useTimelineStore((s) => s.dismissExternalEvent);
  const [localEvents, setLocalEvents] = useState([]);

  useEffect(() => {
    if (!dates?.length) {
      setLocalEvents([]);
      return;
    }
    setLocalEvents(buildMockEventsForDates(dates));
  }, [dates.join("|")]);

  const events = externalEvents.length ? externalEvents : localEvents;
  if (!events.length) return null;

  return (
    <div className="fn-event-detector">
      <h3 className="fn-event-detector-title">🔮 Eventos detectados</h3>
      <div className="fn-events-list">
        {events.map((event) => (
          <EventSuggestion
            key={event.id}
            event={event}
            onDismiss={() => dismissExternalEvent(event.id)}
          />
        ))}
      </div>
    </div>
  );
}
