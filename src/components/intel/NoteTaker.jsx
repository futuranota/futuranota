import { useCallback, useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { getBlockQueryText } from "../../lib/docNodeSync.js";
import {
  createInlineTodoBlock,
  inlineTodoBlocksHaveContent,
  normalizeInlineTodoBlocks,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../../lib/nodeInlineContent.js";
import {
  getVideoNodeNotes,
  getVideoNodeTodoBlocks,
  mergeVideoNodeContent,
} from "../../lib/videoEmbed.js";
import { DocSlashCommandPicker } from "../docs/blocks/DocSlashCommandPicker.jsx";
import { NodeInlineTodoStack } from "../nodes/NodeInlineTodoStack.jsx";
import {
  isNodeSlashCommandEnabled,
  NODE_SLASH_COMMANDS,
  parseNodeSlashQuery,
  splitBodyForSlash,
} from "../../lib/docBlockSlash.js";

const NOTE_PANEL_ICON = "/uploads/botones/PencilCircle.svg";
const UNTITLED_LABEL = "Untitled";
const UNTITLED_NODE_TITLE = "Untitled query";
const SAVE_MIN_MS = 450;

function readPanelDraft(node, inlineTodosEnabled) {
  if (!node) {
    return { notes: "", todoBlocks: [] };
  }

  if (node.dataType === NODE_DATA_TYPES.VIDEO) {
    return {
      notes: getVideoNodeNotes(node.content),
      todoBlocks: getVideoNodeTodoBlocks(node.content),
    };
  }

  if (inlineTodosEnabled && node.dataType === NODE_DATA_TYPES.TEXT) {
    const body = parseNodeWritingBody(node.content);
    return {
      notes: body.text,
      todoBlocks: body.todoBlocks,
    };
  }

  if (node.dataType === NODE_DATA_TYPES.TEXT && typeof node.content === "string") {
    return { notes: node.content, todoBlocks: [] };
  }

  return { notes: "", todoBlocks: [] };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function NoteTaker({
  nodeId: nodeIdProp = null,
  parentDocId = null,
  blockIndex = null,
  onClose,
  inlineTodosEnabled = false,
}) {
  const addNode = useNodesStore((s) => s.addNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const showToast = useUIStateStore((s) => s.showToast);

  const [resolvedNodeId, setResolvedNodeId] = useState(nodeIdProp);
  const node = useNodesStore((s) => (resolvedNodeId ? s.nodes[resolvedNodeId] : null));

  const initialDraft = readPanelDraft(node, inlineTodosEnabled);
  const [notes, setNotes] = useState(() => initialDraft.notes);
  const [todoBlocks, setTodoBlocks] = useState(() => initialDraft.todoBlocks);
  const [todoFocusTarget, setTodoFocusTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResolvedNodeId(nodeIdProp);
  }, [nodeIdProp]);

  useEffect(() => {
    const draft = readPanelDraft(node, inlineTodosEnabled);
    setNotes(draft.notes);
    setTodoBlocks(draft.todoBlocks);
    setTodoFocusTarget(null);
  }, [inlineTodosEnabled, resolvedNodeId, node?.id, node?.content, node?.dataType]);

  const label = node
    ? ((node.sourceQuery || node.title || UNTITLED_LABEL).trim() || UNTITLED_LABEL)
    : UNTITLED_LABEL;
  const hasNotes = notes.trim().length > 0;
  const hasTodoContent = inlineTodoBlocksHaveContent(todoBlocks);
  const saveEnabled = (hasNotes || hasTodoContent) && !saving;
  const showInlineTodoTools = inlineTodosEnabled;

  const addInlineTodoBlock = useCallback(() => {
    setTodoBlocks((prev) => {
      const nextBlock = createInlineTodoBlock();
      setTodoFocusTarget({ blockIndex: prev.length, itemId: nextBlock.items[0]?.id ?? null });
      return [...prev, nextBlock];
    });
  }, []);

  const createIntelNode = useCallback(
    (draftNotes, draftTodos = []) => {
      const trimmedNotes = draftNotes.trim();
      const normalizedTodos = normalizeInlineTodoBlocks(draftTodos);
      const textPayload = inlineTodosEnabled
        ? serializeNodeWritingBody({ text: trimmedNotes, todoBlocks: normalizedTodos })
        : trimmedNotes;

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
            content: textPayload,
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

      const newId = addNode(nodeTitle, NODE_DATA_TYPES.TEXT, textPayload, null, {
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
      inlineTodosEnabled,
      parentDocId,
      resolvedNodeId,
      syncNodeToParentDoc,
    ],
  );

  const persistNotes = useCallback(
    async (
      text,
      {
        allowCreate = false,
        closeAfter = false,
        todoSnapshot = todoBlocks,
      } = {},
    ) => {
      const trimmed = text.trim();
      const normalizedTodos = normalizeInlineTodoBlocks(todoSnapshot);
      const hasPersistableTodo = inlineTodoBlocksHaveContent(normalizedTodos);

      if (!trimmed && !hasPersistableTodo) return false;

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
          targetNodeId = createIntelNode(trimmed, normalizedTodos);
          liveNode = useNodesStore.getState().nodes[targetNodeId];
          if (!liveNode) {
            showToast("No se pudo guardar", "error");
            return false;
          }
        } else if (liveNode.dataType === NODE_DATA_TYPES.VIDEO) {
          updateNode(targetNodeId, {
            content: mergeVideoNodeContent(liveNode.content, {
              notes: trimmed,
              todoBlocks: hasPersistableTodo ? normalizedTodos : [],
            }),
          });
        } else if (inlineTodosEnabled) {
          updateNode(targetNodeId, {
            content: serializeNodeWritingBody({
              text: trimmed,
              todoBlocks: normalizedTodos,
            }),
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
      inlineTodosEnabled,
      onClose,
      parentDocId,
      resolvedNodeId,
      showToast,
      syncNodeToParentDoc,
      todoBlocks,
      updateNode,
    ],
  );

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!saveEnabled) return;
    persistNotes(notes, { allowCreate: true, closeAfter: true, todoSnapshot: todoBlocks });
  };

  const confirmSlashInNotes = useCallback(() => {
    const { prefix, slash } = splitBodyForSlash(notes);
    if (!slash || !parseNodeSlashQuery(slash.slice(1))) return false;
    setNotes(prefix);
    addInlineTodoBlock();
    return true;
  }, [addInlineTodoBlock, notes]);

  const handleNotesKeyDown = (e) => {
    if (!showInlineTodoTools) return;
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const { slash } = splitBodyForSlash(notes);
    if (!slash || !parseNodeSlashQuery(slash.slice(1))) return;
    e.preventDefault();
    confirmSlashInNotes();
  };

  const keepTextareaFocus = (e) => {
    if (
      !e.target.closest(".note-taker__input")
      && !e.target.closest(".note-taker__save")
      && !e.target.closest(".note-taker__content-box")
      && !e.target.closest(".note-taker__content-scroll")
      && !e.target.closest(".doc-slash-command-picker")
    ) {
      e.preventDefault();
    }
  };

  return (
    <section
      className={
        "note-taker"
        + (showInlineTodoTools ? " note-taker--inline-todos" : "")
      }
      aria-label="Notes"
      onMouseDown={keepTextareaFocus}
    >
      <header className="note-taker__header">
        <img className="note-taker__icon" src={NOTE_PANEL_ICON} alt="" aria-hidden />
        <span className="note-taker__label" title={label}>
          {label}
        </span>
      </header>
      <div className="note-taker__input-wrap">
        {showInlineTodoTools ? (
          <div className="note-taker__content-box">
            <div className="note-taker__content-scroll">
              {todoBlocks.length ? (
                <NodeInlineTodoStack
                  className="note-taker__todo-stack"
                  todoBlocks={todoBlocks}
                  onTodoBlocksChange={setTodoBlocks}
                  focusTarget={todoFocusTarget}
                  onFocusTargetChange={setTodoFocusTarget}
                />
              ) : null}
              <textarea
                className="note-taker__input note-taker__input--embedded"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={handleNotesKeyDown}
                placeholder="Escribe aquí, o /todo para añadir lista"
                spellCheck
                disabled={saving}
              />
            </div>
            <DocSlashCommandPicker
              variant="pad"
              commands={NODE_SLASH_COMMANDS}
              onSelectCommand={addInlineTodoBlock}
              isCommandEnabled={isNodeSlashCommandEnabled}
            />
          </div>
        ) : (
          <textarea
            className="note-taker__input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Untitled"
            spellCheck
            disabled={saving}
          />
        )}
      </div>
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
