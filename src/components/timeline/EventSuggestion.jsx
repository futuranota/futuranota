export function EventSuggestion({ event, onAddToNode, onAddToDoc, onDismiss }) {
  return (
    <div className="fn-event-suggestion">
      <div className="fn-event-header">
        <span className="fn-event-icon" aria-hidden>{event.icon}</span>
        <strong>{event.source}</strong>
        <span className="fn-event-date">{event.date}</span>
      </div>
      <div className="fn-event-content">{event.data}</div>
      <div className="fn-event-actions">
        <button type="button" className="btn xs solid" onClick={() => onAddToNode?.(event)}>
          ➕ Agregar a nodo
        </button>
        <button type="button" className="btn xs ghost" onClick={() => onAddToDoc?.(event)}>
          📄 Agregar al doc
        </button>
        <button type="button" className="btn xs ghost" onClick={() => onDismiss?.(event)}>
          ✕ Ignorar
        </button>
      </div>
    </div>
  );
}
