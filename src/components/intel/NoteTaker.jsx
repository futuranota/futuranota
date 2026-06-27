import { useCallback, useEffect, useRef, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  getVideoNodeNotes,
  mergeVideoNodeContent,
} from "../../lib/videoEmbed.js";

const NOTE_PANEL_ICON = "/uploads/botones/PencilCircle.svg";
const AUTO_SAVE_MS = 700;

function initialNotes(node) {
  if (!node) return "";
  if (node.dataType === NODE_DATA_TYPES.VIDEO) {
    return getVideoNodeNotes(node.content);
  }
  if (node.dataType === "text" && typeof node.content === "string") {
    return node.content;
  }
  return "";
}

export function NoteTaker({ searchQuery = "", nodeId = null, onClose }) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] : null));
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const showToast = useUIStateStore((s) => s.showToast);

  const [notes, setNotes] = useState(() => initialNotes(node));
  const [saving, setSaving] = useState(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    setNotes(initialNotes(node));
  }, [nodeId, node?.id, node?.content, node?.dataType]);

  const label = (searchQuery || node?.sourceQuery || node?.title || "Untitled").trim();
  const canSave = Boolean(nodeId && node);
  const hasNotes = notes.trim().length > 0;
  const saveEnabled = hasNotes && !saving;

  const persistNotes = useCallback(
    async (text, { silent = false, closeAfter = false } = {}) => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      const liveNode = nodeId ? useNodesStore.getState().nodes[nodeId] : null;
      if (!nodeId || !liveNode) {
        if (!silent) showToast("Run search from a node to save notes", "info");
        return false;
      }

      setSaving(true);
      try {
        if (liveNode.dataType === NODE_DATA_TYPES.VIDEO) {
          updateNode(nodeId, {
            content: mergeVideoNodeContent(liveNode.content, { notes: trimmed }),
          });
        } else {
          updateNode(nodeId, { content: trimmed });
        }
        if (liveNode.parentDocId) {
          syncNodeToParentDoc(nodeId, liveNode.parentDocId);
        }
        if (!silent) showToast("Saved to node", "success");
        if (closeAfter) onClose?.();
        return true;
      } catch {
        if (!silent) showToast("Could not save notes", "error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [nodeId, updateNode, syncNodeToParentDoc, showToast, onClose],
  );

  useEffect(() => {
    if (!canSave || !notes.trim()) return undefined;
    const timer = window.setTimeout(() => {
      persistNotes(notes, { silent: true });
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [notes, canSave, persistNotes]);

  useEffect(() => {
    return () => {
      const trimmed = notesRef.current.trim();
      if (!nodeId || !trimmed) return;
      const liveNode = useNodesStore.getState().nodes[nodeId];
      if (!liveNode) return;
      if (liveNode.dataType === NODE_DATA_TYPES.VIDEO) {
        useNodesStore.getState().updateNode(nodeId, {
          content: mergeVideoNodeContent(liveNode.content, { notes: trimmed }),
        });
      } else {
        useNodesStore.getState().updateNode(nodeId, { content: trimmed });
      }
      if (liveNode.parentDocId) {
        useNodesStore.getState().syncNodeToParentDoc(nodeId, liveNode.parentDocId);
      }
    };
  }, [nodeId]);

  const keepTextareaFocus = (e) => {
    if (
      !e.target.closest(".note-taker__input")
      && !e.target.closest(".note-taker__save")
    ) {
      e.preventDefault();
    }
  };

  const handleSave = () => {
    if (!saveEnabled) return;
    persistNotes(notes, { closeAfter: true });
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
