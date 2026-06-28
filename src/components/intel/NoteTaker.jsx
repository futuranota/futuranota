import { useCallback, useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { getBlockQueryText } from "../../lib/docNodeSync.js";
import {
  getVideoNodeNotes,
  mergeVideoNodeContent,
} from "../../lib/videoEmbed.js";

const NOTE_PANEL_ICON = "/uploads/botones/PencilCircle.svg";
const UNTITLED_LABEL = "Untitled";
const UNTITLED_NODE_TITLE = "Untitled query";
const SAVE_MIN_MS = 450;

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

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function NoteTaker({
  nodeId: nodeIdProp = null,
  parentDocId = null,
  blockIndex = null,
  onClose,
}) {
  const addNode = useNodesStore((s) => s.addNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const showToast = useUIStateStore((s) => s.showToast);

  const [resolvedNodeId, setResolvedNodeId] = useState(nodeIdProp);
  const node = useNodesStore((s) => (resolvedNodeId ? s.nodes[resolvedNodeId] : null));

  const [notes, setNotes] = useState(() => initialNotes(node));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResolvedNodeId(nodeIdProp);
  }, [nodeIdProp]);

  useEffect(() => {
    setNotes(initialNotes(node));
  }, [resolvedNodeId, node?.id, node?.content, node?.dataType]);

  const label = node
    ? ((node.sourceQuery || node.title || UNTITLED_LABEL).trim() || UNTITLED_LABEL)
    : UNTITLED_LABEL;
  const hasNotes = notes.trim().length > 0;
  const saveEnabled = hasNotes && !saving;

  const createIntelNode = useCallback(
    (notesText) => {
      const trimmedNotes = notesText.trim();

      if (parentDocId && typeof blockIndex === "number") {
        const doc = useDocsStore.getState().getDoc(parentDocId);
        const block = doc?.blocks?.[blockIndex];
        if (block?.id) {
          const queryText = getBlockQueryText(block) || UNTITLED_NODE_TITLE;
          const newId = createOrUpdateNodeFromDocBlock({
            nodeId: resolvedNodeId || null,
            docId: parentDocId,
            blockId: block.id,
            query: queryText,
            content: trimmedNotes,
            dataType: NODE_DATA_TYPES.TEXT,
          });
          setResolvedNodeId(newId);
          useUIStateStore.getState().patchIntelSearchNodeId(newId);
          syncNodeToParentDoc(newId, parentDocId);
          return newId;
        }
      }

      const linkedNode = resolvedNodeId
        ? useNodesStore.getState().nodes[resolvedNodeId]
        : null;
      const nodeTitle = linkedNode
        ? ((linkedNode.sourceQuery || linkedNode.title || UNTITLED_NODE_TITLE).trim()
          || UNTITLED_NODE_TITLE)
        : UNTITLED_NODE_TITLE;

      const newId = addNode(nodeTitle, NODE_DATA_TYPES.TEXT, trimmedNotes, null, {
        sourceQuery: nodeTitle,
      });
      setResolvedNodeId(newId);
      useUIStateStore.getState().patchIntelSearchNodeId(newId);
      return newId;
    },
    [
      addNode,
      blockIndex,
      createOrUpdateNodeFromDocBlock,
      parentDocId,
      resolvedNodeId,
      syncNodeToParentDoc,
    ],
  );

  const persistNotes = useCallback(
    async (text, { allowCreate = false, closeAfter = false } = {}) => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      const startedAt = Date.now();
      setSaving(true);

      try {
        let targetNodeId = resolvedNodeId;
        let liveNode = targetNodeId ? useNodesStore.getState().nodes[targetNodeId] : null;

        if (!liveNode) {
          if (!allowCreate) {
            showToast("Escribe texto y pulsa save", "info");
            return false;
          }
          targetNodeId = createIntelNode(trimmed);
          liveNode = useNodesStore.getState().nodes[targetNodeId];
          if (!liveNode) {
            showToast("No se pudo guardar", "error");
            return false;
          }
        }

        if (liveNode.dataType === NODE_DATA_TYPES.VIDEO) {
          updateNode(targetNodeId, {
            content: mergeVideoNodeContent(liveNode.content, { notes: trimmed }),
          });
        } else {
          updateNode(targetNodeId, { content: trimmed });
        }

        const parentId = liveNode.parentDocId || parentDocId || null;
        if (parentId) {
          syncNodeToParentDoc(targetNodeId, parentId);
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed < SAVE_MIN_MS) {
          await wait(SAVE_MIN_MS - elapsed);
        }

        showToast(parentId ? "Guardado en el documento" : "Guardado en NODES", "success");
        if (closeAfter) onClose?.();
        return true;
      } catch {
        showToast("No se pudo guardar", "error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      createIntelNode,
      onClose,
      parentDocId,
      resolvedNodeId,
      showToast,
      syncNodeToParentDoc,
      updateNode,
    ],
  );

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!saveEnabled) return;
    persistNotes(notes, { allowCreate: true, closeAfter: true });
  };

  const keepTextareaFocus = (e) => {
    if (
      !e.target.closest(".note-taker__input")
      && !e.target.closest(".note-taker__save")
    ) {
      e.preventDefault();
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
        placeholder="Untitled"
        spellCheck
        disabled={saving}
      />
      <div className="note-taker__footer">
        <button
          type="button"
          className={
            "note-taker__save"
            + (saving ? " note-taker__save--loading" : "")
          }
          disabled={!saveEnabled}
          aria-busy={saving}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "save"}
        </button>
      </div>
    </section>
  );
}
