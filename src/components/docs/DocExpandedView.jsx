import { useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { Modal } from "../shared/Modal.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";

function parseH1Lines(body) {
  return (body || "")
    .split("\n")
    .filter((line) => line.startsWith("# "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

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
  const nodes = useNodesStore((s) => s.nodes);
  const [selectionModal, setSelectionModal] = useState(null);

  if (!doc) return null;

  const body = doc.body ?? doc.content ?? "";
  const h1Lines = parseH1Lines(body);

  const existingNodeTitles = new Set(
    Object.values(nodes)
      .filter((n) => n.parentDocId === docId)
      .map((n) => n.title),
  );

  const handleContextMenu = (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (!text) return;
    setSelectionModal({ query: text });
  };

  const handleExtractH1 = (title) => {
    addNodeFromDoc(title, "text", "", docId, title, false);
  };

  return (
    <div className="fn-doc-expanded">
      <div className="fn-doc-expanded-head">
        <b>{doc.title}</b>
        <button type="button" className="btn xs ghost" onClick={onClose}>✕</button>
      </div>

      {h1Lines.length > 0 && (
        <div className="doc-h1-panel">
          <span className="doc-h1-panel-label">H1 detectados</span>
          <div className="doc-h1-list">
            {h1Lines.map((title) => {
              const alreadyExtracted = existingNodeTitles.has(title);
              return (
                <div key={title} className="doc-h1-row">
                  <span className="doc-h1-text"># {title}</span>
                  <button
                    type="button"
                    className={"btn xs " + (alreadyExtracted ? "ghost doc-h1-done" : "ghost")}
                    onClick={() => !alreadyExtracted && handleExtractH1(title)}
                    disabled={alreadyExtracted}
                    title={alreadyExtracted ? "Ya extraído como nodo" : "Extraer como nodo"}
                  >
                    {alreadyExtracted ? "✓" : "→ nodo"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="notes-doc-editor" onContextMenu={handleContextMenu}>
        <textarea
          className="note-form-field notes-doc-body"
          value={body}
          placeholder={"# Mi pregunta sobre el objeto\n\nEscribe aquí tu investigación...\n\n# Otra pregunta\n\nMás contenido..."}
          rows={10}
          onChange={(e) => updateDocContent(doc.id, e.target.value)}
        />
        <span className="notes-doc-editor-hint">
          Líneas con <code># Título</code> se detectan como H1 · Clic derecho → crear nodo
        </span>
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
