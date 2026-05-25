import { useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { Modal } from "../shared/Modal.jsx";
import { mockSearch } from "../../api/searchMock.js";
import { injectNodeAnswerIntoDocBody } from "../../lib/sync.js";

const PROVIDERS = [
  { id: "claude", label: "Claude" },
  { id: "groq", label: "Groq" },
  { id: "gemini", label: "Gemini" },
  { id: "google", label: "Google" },
];

export function NodeSearchModal({ nodeId, onClose }) {
  const node = useNodesStore((s) => s.nodes[nodeId]);
  const updateNode = useNodesStore((s) => s.updateNode);
  const doc = useDocsStore((s) => (node?.parentDocId ? s.docs[node.parentDocId] : null));
  const updateDocContent = useDocsStore((s) => s.updateDocContent);
  const object = useObjectsStore((s) =>
    doc?.parentObjectId ? s.objects[doc.parentObjectId] : null,
  );

  const [provider, setProvider] = useState("claude");
  const [query, setQuery] = useState(node?.title || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [inserted, setInserted] = useState(false);

  if (!node) return null;

  const objectContext = object?.name || null;

  const handleSearch = async () => {
    setLoading(true);
    setResult(null);
    setInserted(false);
    try {
      const response = await mockSearch({ query, provider, objectContext });
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!result) return;
    updateNode(nodeId, { content: result });
    if (node.parentDocId && doc) {
      const currentBody = doc.body || doc.content || "";
      const newBody = injectNodeAnswerIntoDocBody(currentBody, { query }, result);
      updateDocContent(node.parentDocId, newBody);
    }
    setInserted(true);
    setTimeout(onClose, 600);
  };

  return (
    <Modal onClose={onClose} title="BUSCAR">
      {objectContext && (
        <div className="search-context-badge">
          <span className="search-context-icon">◉</span>
          <span className="search-context-label">{objectContext}</span>
        </div>
      )}

      <div className="search-provider-tabs">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={"btn xs " + (provider === p.id ? "solid" : "ghost")}
            onClick={() => setProvider(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="search-query-wrap">
        <textarea
          className="note-form-field search-query-input"
          value={query}
          rows={2}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Query de búsqueda..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch();
          }}
        />
        <button
          type="button"
          className={"btn solid search-btn" + (loading ? " search-btn-loading" : "")}
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? "···" : "⌕ Buscar"}
        </button>
      </div>

      {result && (
        <div className="search-result-wrap">
          <pre className="search-result-text">{result}</pre>
          <button
            type="button"
            className={"btn solid search-insert-btn" + (inserted ? " search-insert-ok" : "")}
            onClick={handleInsert}
            disabled={inserted}
          >
            {inserted ? "✓ Guardado" : "↓ Insertar en nodo"}
          </button>
        </div>
      )}
    </Modal>
  );
}
