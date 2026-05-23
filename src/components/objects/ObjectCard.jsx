export function ObjectCard({ object, onClick, active }) {
  return (
    <button
      type="button"
      className={"fn-card fn-object-card" + (active ? " active" : "")}
      onClick={onClick}
      style={{ "--fn-accent": object.color || "#6366f1" }}
    >
      <span className="fn-card-dot" />
      <div className="fn-card-body">
        <b>{object.name}</b>
        <span className="fn-card-meta">
          {object.description || `${(object.children || []).length} docs`}
        </span>
      </div>
    </button>
  );
}
