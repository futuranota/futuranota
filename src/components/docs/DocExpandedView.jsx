import { useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { Modal } from "../shared/Modal.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";

function NodeFromSelectionModal({ query, onClose, onSave }) {
  return (
    <Modal onClose={onClose} title="NEW NOTE">
      <p className="query-line">query: {query}</p>
      <NodeForm
        initialData={{ title: query, dataType: "text", content: "" }}
        onSubmit={onSave}
        onCancel={onClose}
      />
    </Modal>
  );
}

export function DocExpandedView({ docId, onClose }) {
  const doc = useDocsStore((s) => s.docs[docId]);
  const updateDocContent = useDocsStore((s) => s.updateDocContent);
  const addNodeFromDoc = useNodesStore((s) => s.addNodeFromDoc);
  const [selectionModal, setSelectionModal] = useState(null);

  if (!doc) return null;

  const body = doc.body ?? doc.content ?? "";

  const handleContextMenu = (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (!text) return;
    setSelectionModal({ query: text });
  };

  return (
    <div className="fn-doc-expanded">
      <div className="fn-doc-expanded-head">
        <b>{doc.title}</b>
        <button type="button" className="btn xs ghost" onClick={onClose}>✕</button>
      </div>
      <div className="notes-doc-editor" onContextMenu={handleContextMenu}>
        <textarea
          className="note-form-field notes-doc-body"
          value={body}
          placeholder={"to do:\n- ir de compras\n- …"}
          rows={10}
          onChange={(e) => updateDocContent(doc.id, e.target.value)}
        />
        <span className="notes-doc-editor-hint">Clic derecho con texto seleccionado → crear nodo</span>
      </div>
      {selectionModal && (
        <NodeFromSelectionModal
          query={selectionModal.query}
          onClose={() => setSelectionModal(null)}
          onSave={({ title, dataType, content }) => {
            addNodeFromDoc(title, dataType, content, docId, selectionModal.query, true);
            setSelectionModal(null);
          }}
        />
      )}
    </div>
  );
}
