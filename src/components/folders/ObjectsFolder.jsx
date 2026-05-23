import { useState } from "react";
import { useObjectsStore, useUIStateStore } from "../../stores/index.js";
import { ObjectCard } from "../objects/ObjectCard.jsx";
import { ObjectForm } from "../objects/ObjectForm.jsx";
import { Modal } from "../shared/Modal.jsx";

export function ObjectsFolder() {
  const objects = useObjectsStore((s) => s.objects);
  const addObject = useObjectsStore((s) => s.addObject);
  const expandedObjectId = useUIStateStore((s) => s.expandedObjectId);
  const setExpandedObject = useUIStateStore((s) => s.setExpandedObject);

  const [showForm, setShowForm] = useState(false);

  return (
    <section className="folder objects-folder notes-folder">
      <div className="notes-folder-head">
        <h2 className="notes-folder-title">📦 OBJECTS</h2>
      </div>

      <div className="fn-folder-list">
        {Object.values(objects).map((obj) => (
          <ObjectCard
            key={obj.id}
            object={obj}
            active={expandedObjectId === obj.id}
            onClick={() => setExpandedObject(expandedObjectId === obj.id ? null : obj.id)}
          />
        ))}
      </div>

      <button type="button" className="btn xs solid fn-btn-add" onClick={() => setShowForm(true)}>
        + Crear objeto
      </button>

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <ObjectForm
            onSubmit={({ name, description, color }) => {
              addObject(name, description, color);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </section>
  );
}
