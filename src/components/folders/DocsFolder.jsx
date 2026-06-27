import { useState } from "react";
import { useDocsStore, useUIStateStore } from "../../stores/index.js";
import { DocCard } from "../docs/DocCard.jsx";
import { DocForm } from "../docs/DocForm.jsx";
import { DocExpandedView } from "../docs/DocExpandedView.jsx";
import { Modal } from "../shared/Modal.jsx";

export function DocsFolder() {
  const docs = useDocsStore((s) => s.docs);
  const addDoc = useDocsStore((s) => s.addDoc);
  const expandedDocId = useUIStateStore((s) => s.expandedDocId);
  const setExpandedDoc = useUIStateStore((s) => s.setExpandedDoc);

  const [showForm, setShowForm] = useState(false);

  return (
    <section className="folder docs-folder notes-folder">
      <div className="notes-folder-head">
        <h2 className="notes-folder-title">📄 DOCS</h2>
      </div>

      <div className="fn-folder-list">
        {Object.values(docs).map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            active={expandedDocId === doc.id}
            onClick={() => setExpandedDoc(expandedDocId === doc.id ? null : doc.id)}
          />
        ))}
      </div>

      {expandedDocId && (
        <DocExpandedView key={expandedDocId} docId={expandedDocId} onClose={() => setExpandedDoc(null)} />
      )}

      <button type="button" className="btn xs solid fn-btn-add" onClick={() => setShowForm(true)}>
        + Crear documento
      </button>

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <DocForm
            onSubmit={({ title, parentObjectId }) => {
              addDoc(title, parentObjectId);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </section>
  );
}
