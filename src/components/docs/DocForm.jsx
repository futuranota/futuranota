import { useState } from "react";
import { findObjectIdByName } from "../../lib/storeSanitize.js";
import { useObjectsStore } from "../../stores/objectsStore.js";

export function DocForm({ onSubmit, onCancel, initialData = null }) {
  const objectMap = useObjectsStore((s) => s.objects);
  const objects = Object.values(objectMap);
  const defaultParent = findObjectIdByName(objectMap, "yo") || objects[0]?.id || "";

  const [title, setTitle] = useState(initialData?.title || "");
  const [parentObjectId, setParentObjectId] = useState(initialData?.parentObjectId || defaultParent);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), parentObjectId: parentObjectId || null });
  };

  return (
    <form className="fn-form doc-form" onSubmit={handleSubmit}>
      <h3 className="fn-form-title">{initialData ? "Editar doc" : "Crear documento"}</h3>

      <div className="fn-form-group">
        <label className="label">Título *</label>
        <input
          type="text"
          className="note-form-field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Planes del fin de semana"
          autoFocus
          required
        />
      </div>

      <div className="fn-form-group">
        <label className="label">Objeto padre</label>
        <select
          className="note-form-field"
          value={parentObjectId}
          onChange={(e) => setParentObjectId(e.target.value)}
        >
          <option value="">— Sin padre —</option>
          {objects.map((obj) => (
            <option key={obj.id} value={obj.id}>{obj.name}</option>
          ))}
        </select>
      </div>

      <div className="fn-form-actions">
        <button type="submit" className="btn primary">{initialData ? "Guardar" : "Crear"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
