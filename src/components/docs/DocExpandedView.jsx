import { useState, useEffect } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { Modal } from "../shared/Modal.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";
import { dateInputFromIso, isoFromDateInput } from "../../lib/docDates.js";
import { DocDocumentBox } from "./DocDocumentBox.jsx";

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
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const addNodeFromDoc = useNodesStore((s) => s.addNodeFromDoc);
  const [selectionModal, setSelectionModal] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftCreatedDate, setDraftCreatedDate] = useState("");

  useEffect(() => {
    const d = useDocsStore.getState().docs[docId];
    if (!d) return;
    setDraftTitle(d.title ?? "");
    setDraftBody(d.body ?? d.content ?? "");
    setDraftCreatedDate(dateInputFromIso(d.createdAt));
  }, [docId]);

  if (!doc) return null;

  const handleSave = () => {
    const title = draftTitle.trim() || "New document";
    updateDoc(doc.id, {
      title,
      content: draftBody,
      body: draftBody,
      createdAt: isoFromDateInput(draftCreatedDate),
    });
    onClose();
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (!text) return;
    setSelectionModal({ query: text });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        <DocDocumentBox
          title={draftTitle}
          onTitleChange={setDraftTitle}
          body={draftBody}
          onBodyChange={setDraftBody}
          createdDate={draftCreatedDate}
          onCreatedDateChange={setDraftCreatedDate}
          onDelete={onClose}
          onSave={handleSave}
          onCloseExpand={onClose}
        />
      </div>
      <span className="notes-doc-editor-hint">Clic derecho con texto seleccionado → crear nodo</span>
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
    </>
  );
}
