/** Actions for a doc block still linked to a timeline node (mirrors calendar embed actions). */
export function LinkedNodeDocActions({ onDetach, label = "Eliminar del nodo" }) {
  if (!onDetach) return null;

  return (
    <div className="doc-linked-node-actions doc-embedded-calendar__actions">
      <button
        type="button"
        className="doc-linked-node-actions__detach doc-embedded-calendar__remove btn xs ghost"
        onClick={onDetach}
      >
        {label}
      </button>
    </div>
  );
}
