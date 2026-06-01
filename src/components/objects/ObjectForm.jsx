import { useState } from "react";
import {
  OBJECT_COLOR_CORPUS,
  OBJECT_COLOR_SATELLITE,
} from "../../lib/objectColors.js";

export function ObjectForm({ onSubmit, onCancel, initialData = null, defaultColor }) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [color, setColor] = useState(
    initialData?.color || defaultColor || OBJECT_COLOR_CORPUS,
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), color });
  };

  return (
    <form className="fn-form object-form" onSubmit={handleSubmit}>
      <h3 className="fn-form-title">{initialData ? "Editar objeto" : "Crear objeto"}</h3>

      <div className="fn-form-group">
        <label className="label">Nombre *</label>
        <input
          type="text"
          className="note-form-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: yo, Proyecto X"
          autoFocus
          required
        />
      </div>

      <div className="fn-form-group">
        <label className="label">Descripción</label>
        <textarea
          className="note-form-field"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe este objeto…"
          rows={3}
        />
      </div>

      <div className="fn-form-group">
        <label className="label">Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>

      <div className="fn-form-actions">
        <button type="submit" className="btn primary">{initialData ? "Guardar" : "Crear"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
