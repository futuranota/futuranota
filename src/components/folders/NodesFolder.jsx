import { useState } from "react";
import { useNodesStore, useDocsStore, useCanvasStore, useUIStateStore } from "../../stores/index.js";
import { NodeCard } from "../nodes/NodeCard.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";
import { Modal } from "../shared/Modal.jsx";
import { DATA_TYPE_LABELS } from "../../lib/nodeDataTypes.js";

function getNodeDisplayTitle(node) {
  return (node.sourceQuery || node.title || "Untitled query").trim() || "Untitled query";
}

export function NodesFolder() {
  const nodes = useNodesStore((s) => s.nodes);
  const docs = useDocsStore((s) => s.docs);
  const addNode = useNodesStore((s) => s.addNode);
  const deleteNode = useNodesStore((s) => s.deleteNode);
  const addCanvasNode = useCanvasStore((s) => s.addCanvasNode);
  const getCanvasNodesByNodeId = useCanvasStore((s) => s.getCanvasNodesByNodeId);
  const expandedNodeId = useUIStateStore((s) => s.expandedNodeId);
  const setExpandedNode = useUIStateStore((s) => s.setExpandedNode);

  const [showForm, setShowForm] = useState(false);

  const looseNodes = Object.values(nodes);

  return (
    <section className="folder nodes-folder notes-folder">
      <div className="notes-folder-head">
        <h2 className="notes-folder-title">📝 NODES</h2>
      </div>

      <div className="fn-folder-list">
        {looseNodes.length === 0 && (
          <p className="notes-folder-empty">Crea nodos desde un doc o con el botón abajo.</p>
        )}
        {looseNodes.map((node) => {
          const parentDoc = node.parentDocId ? docs[node.parentDocId] : null;
          const onCanvas = (node.canvasConnections?.length > 0)
            || getCanvasNodesByNodeId(node.id).length > 0;
          const subtitle = [
            DATA_TYPE_LABELS[node.dataType],
            parentDoc ? `doc: ${parentDoc.title}` : "suelto",
            onCanvas ? "en canvas" : null,
          ].filter(Boolean).join(" · ");

          return (
            <div key={node.id} className="fn-node-row">
              <NodeCard
                node={{ ...node, title: getNodeDisplayTitle(node) }}
                subtitle={subtitle}
                active={expandedNodeId === node.id}
                onClick={() => setExpandedNode(expandedNodeId === node.id ? null : node.id)}
              />
              <div className="fn-node-row-actions">
                {!onCanvas && (
                  <button type="button" className="btn xs ghost" onClick={() => addCanvasNode(node.id)}>
                    Canvas
                  </button>
                )}
                <button
                  type="button"
                  className="icon-del-btn notes-folder-del"
                  title="Eliminar"
                  onClick={() => deleteNode(node.id)}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn xs solid fn-btn-add" onClick={() => setShowForm(true)}>
        + Crear nodo
      </button>

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <NodeForm
            onSubmit={({ title, dataType, content }) => {
              addNode(title, dataType, content, null);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </section>
  );
}
