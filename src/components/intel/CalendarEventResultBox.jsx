export function CalendarEventResultBox({ result, onInsert, showInsert = true }) {
  const scopeBrief = result?.scopeBrief;
  if (!scopeBrief?.body) return null;

  return (
    <div className="cal-event-result" role="status">
      <p className="cal-event-result__scope-body">{scopeBrief.body}</p>
      {showInsert && onInsert && result?.event ? (
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
