import { useEffect, useState } from "react";
import { DATA_TYPE_ICON_ASSETS } from "../../lib/nodeDataTypes.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";

const DEFAULT_NODE_ICON = "/uploads/botones/node.svg";

function initialNotes(node) {
  if (!node) return "";
  if (node.dataType === "text" && typeof node.content === "string") {
    return node.content;
  }
  return "";
}

export function NoteTaker({ searchQuery = "", nodeId = null }) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] : null));
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const showToast = useUIStateStore((s) => s.showToast);

  const [notes, setNotes] = useState(() => initialNotes(node));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(initialNotes(node));
  }, [nodeId]);

  const label = (searchQuery || node?.sourceQuery || node?.title || "Untitled").trim();
  const iconSrc = DATA_TYPE_ICON_ASSETS[node?.dataType] || DEFAULT_NODE_ICON;
  const canSave = Boolean(nodeId && node);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      updateNode(nodeId, { content: notes.trim() });
      if (node.parentDocId) {
        syncNodeToParentDoc(nodeId, node.parentDocId);
      }
      showToast("Saved to node", "success");
    } catch {
      showToast("Could not save notes", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="note-taker" aria-label="Notes">
      <header className="note-taker__header">
        <img className="note-taker__icon" src={iconSrc} alt="" aria-hidden />
        <span className="note-taker__label" title={label}>
          {label}
        </span>
      </header>
      <textarea
        className="note-taker__input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Take notes while you read…"
        spellCheck
      />
      <div className="note-taker__footer">
        {!canSave ? (
          <p className="note-taker__hint mute">
            Run search from a node to save notes back to it.
          </p>
        ) : null}
        <button
          type="button"
          className="btn sm primary note-taker__save"
          disabled={!canSave || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save to Node"}
        </button>
      </div>
    </section>
  );
}
