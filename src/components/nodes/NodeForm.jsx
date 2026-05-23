import { useState } from "react";
import { NODE_DATA_TYPES, DATA_TYPE_LABELS } from "../../lib/nodeDataTypes.js";

export function NodeForm({ onSubmit, onCancel, initialData = null }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [dataType, setDataType] = useState(initialData?.dataType || "text");
  const [content, setContent] = useState(
    initialData?.content != null ? String(initialData.content) : "",
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    let payload = content;
    if (dataType === "metric") {
      const num = Number(content);
      payload = { value: Number.isNaN(num) ? content : num, unit: "" };
    }
    if (dataType === "checkbox") {
      payload = content === "true" || content === true;
    }
    onSubmit({ title: title.trim(), dataType, content: payload });
  };

  return (
    <form className="fn-form node-form" onSubmit={handleSubmit}>
      <h3 className="fn-form-title">{initialData ? "Editar nodo" : "Crear nodo"}</h3>

      <div className="fn-form-group">
        <label className="label">Título *</label>
        <input
          type="text"
          className="note-form-field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Ir de compras"
          autoFocus
          required
        />
      </div>

      <div className="fn-form-group">
        <label className="label">Tipo *</label>
        <select
          className="note-form-field"
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
        >
          {Object.values(NODE_DATA_TYPES).map((type) => (
            <option key={type} value={type}>{DATA_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </div>

      <div className="fn-form-group">
        <label className="label">Contenido</label>
        {dataType === "date" && (
          <input
            type="date"
            className="note-form-field"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
        {dataType === "checkbox" && (
          <label className="fn-checkbox-row">
            <input
              type="checkbox"
              checked={content === "true" || content === true}
              onChange={(e) => setContent(e.target.checked ? "true" : "false")}
            />
            Marcado
          </label>
        )}
        {(dataType === "text" || dataType === "metric") && (
          <textarea
            className="note-form-field"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenido…"
            rows={4}
          />
        )}
      </div>

      <div className="fn-form-actions">
        <button type="submit" className="btn primary">{initialData ? "Guardar" : "Crear"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
