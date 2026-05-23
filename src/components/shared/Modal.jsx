export function Modal({ onClose, children, title }) {
  return (
    <div className="modal-overlay fn-modal" onClick={onClose} role="presentation">
      <div className="modal glass notes-modal fn-modal-panel" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <span className="label" style={{ color: "var(--hud)" }}>{title}</span>
            <button type="button" className="btn xs ghost" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        )}
        {!title && (
          <button
            type="button"
            className="btn xs ghost fn-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
