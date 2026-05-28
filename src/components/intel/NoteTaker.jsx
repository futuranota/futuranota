import { useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";

const NOTE_PANEL_ICON = "/uploads/botones/PencilCircle.svg";

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
  const canSave = Boolean(nodeId && node);
  const hasNotes = notes.trim().length > 0;
  const saveEnabled = hasNotes && !saving;

  const keepTextareaFocus = (e) => {
    if (
      !e.target.closest(".note-taker__input")
      && !e.target.closest(".note-taker__save")
    ) {
      e.preventDefault();
    }
  };

  const handleSave = async () => {
    if (!saveEnabled) return;
    if (!canSave) {
      showToast("Run search from a node to save notes", "info");
      return;
    }
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
    <section
      className="note-taker"
      aria-label="Notes"
      onMouseDown={keepTextareaFocus}
    >
      <header className="note-taker__header">
        <img className="note-taker__icon" src={NOTE_PANEL_ICON} alt="" aria-hidden />
        <span className="note-taker__label" title={label}>
          {label}
        </span>
      </header>
      <textarea
        className="note-taker__input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes panel..."
        spellCheck
      />
      <div className="note-taker__footer">
        <button
          type="button"
          className="note-taker__save"
          disabled={!saveEnabled}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save to Node"}
        </button>
      </div>
    </section>
  );
}
