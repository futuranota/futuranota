export function CalendarEventResultBox({ result, onInsert, showInsert = true }) {
  const event = result?.event;
  if (!event) return null;

  const rangeLabel = event.dateEnd && event.dateEnd !== event.date
    ? `${event.date} → ${event.dateEnd}`
    : event.date;

  return (
    <div className="cal-event-result" role="status">
      <div className="cal-event-result__meta">
        <span className="cal-event-result__date tnum">{result.uiDate}</span>
        {result.rangeLabel ? (
          <span className="cal-event-result__range-label tnum">{result.rangeLabel}</span>
        ) : null}
        <span className="cal-event-result__source">{result.sourceLabel}</span>
      </div>
      <div className="cal-event-result__body">
        <h4 className="cal-event-result__title">{event.title}</h4>
        <p className="cal-event-result__range tnum mono">{rangeLabel}</p>
        <p className="cal-event-result__summary">{event.summary}</p>
        {event.source ? (
          <p className="cal-event-result__source-name">{event.source}</p>
        ) : null}
      </div>
      {showInsert && onInsert ? (
        <button
          type="button"
          className="cal-event-result__insert btn xs"
          onClick={onInsert}
        >
          Insert node
        </button>
      ) : null}
    </div>
  );
}
