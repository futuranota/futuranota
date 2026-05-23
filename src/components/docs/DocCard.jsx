import { useObjectsStore } from "../../stores/objectsStore.js";
import { DocSyncBadge } from "./DocSyncBadge.jsx";

export function DocCard({ doc, onClick, active }) {
  const objects = useObjectsStore((s) => s.objects);
  const parent = doc.parentObjectId ? objects[doc.parentObjectId] : null;

  return (
    <button
      type="button"
      className={"fn-card fn-doc-card" + (active ? " active" : "")}
      onClick={onClick}
    >
      <span className="fn-card-dot doc" />
      <div className="fn-card-body">
        <b>{doc.title}</b>
        <span className="fn-card-meta">
          {parent ? `↳ ${parent.name}` : "suelto"} · {(doc.nodeIds || []).length} nodos
        </span>
      </div>
      <DocSyncBadge synced={doc.syncedWithCanvas !== false} />
    </button>
  );
}
