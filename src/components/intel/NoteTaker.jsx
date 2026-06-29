import { useCallback, useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { getBlockQueryText } from "../../lib/docNodeSync.js";
import {
  appendNodeWritingBlockFromSlash,
  createEmptyTextBlock,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  nodeWritingBlocksHaveContent,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../../lib/nodeInlineContent.js";
import {
  getVideoWritingBody,
  mergeVideoNodeContent,
} from "../../lib/videoEmbed.js";
import { DocSlashCommandPicker } from "../docs/blocks/DocSlashCommandPicker.jsx";
import { NodeWritingBlockStack } from "../nodes/NodeWritingBlockStack.jsx";
import {
  isNodeSlashCommandEnabled,
  NODE_SLASH_COMMANDS,
  parseNodeSlashQuery,
} from "../../lib/docBlockSlash.js";
import { DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";

const NOTE_PANEL_ICON = "/uploads/botones/PencilCircle.svg";
const UNTITLED_LABEL = "Untitled";
const UNTITLED_NODE_TITLE = "Untitled query";
const SAVE_MIN_MS = 450;

function readPanelDraft(node, inlineWritingEnabled) {
  if (!node) {
    return parseNodeWritingBody("");
  }

  if (node.dataType === NODE_DATA_TYPES.VIDEO) {
    return getVideoWritingBody(node.content);
  }

  if (inlineWritingEnabled && node.dataType === NODE_DATA_TYPES.TEXT) {
    return parseNodeWritingBody(node.content);
  }

  if (node.dataType === NODE_DATA_TYPES.TEXT && typeof node.content === "string") {
    return parseNodeWritingBody(node.content);
  }

  return parseNodeWritingBody("");
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
  const [writingBody, setWritingBody] = useState(() => initialDraft);
  const [writingFocusTarget, setWritingFocusTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResolvedNodeId(nodeIdProp);
  }, [nodeIdProp]);

  useEffect(() => {
    setWritingBody(readPanelDraft(node, inlineTodosEnabled));
    setWritingFocusTarget(null);
  }, [inlineTodosEnabled, resolvedNodeId, node?.id, node?.content, node?.dataType]);

  const label = node
    ? ((node.sourceQuery || node.title || UNTITLED_LABEL).trim() || UNTITLED_LABEL)
    : UNTITLED_LABEL;
  const hasContent = nodeWritingBlocksHaveContent(writingBody.blocks);
  const saveEnabled = hasContent && !saving;
  const showInlineWritingTools = inlineTodosEnabled;

  const appendBlockFromPicker = useCallback((alias) => {
    const parsed = parseNodeSlashQuery(alias);
    if (!parsed) return;
    const normalized = normalizeWritingBlocks(writingBody.blocks);
    const { blocks: nextBlocks, insertedIndex } = appendNodeWritingBlockFromSlash(
      normalized,
      parsed,
    );
    setWritingBody({ blocks: nextBlocks });
    if (insertedIndex < 0) return;
    if (parsed.type === DOC_BLOCK_TYPES.TODO) {
      const todoBlock = nextBlocks[insertedIndex];
      setWritingFocusTarget({
        blockIndex: insertedIndex,
        itemId: todoBlock?.items?.[0]?.id ?? null,
      });
    } else if (parsed.type === DOC_BLOCK_TYPES.CODE) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusCode: true });
    } else {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusH1: true });
    }
  }, [writingBody.blocks]);

  const createIntelNode = useCallback(
    (draftBody) => {
      const serialized = serializeNodeWritingBody(draftBody);
      const plainText = draftBody.blocks
        ?.filter((block) => block.type === NODE_BLOCK_TYPES.TEXT)
        .map((block) => block.text)
        .join("\n\n")
        .trim() || "";
      const textPayload = inlineTodosEnabled ? serialized : plainText;

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
      draftBody,
      {
        allowCreate = false,
        closeAfter = false,
      } = {},
    ) => {
      const serialized = serializeNodeWritingBody(draftBody);
      if (!serialized) return false;

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
          targetNodeId = createIntelNode(draftBody);
          liveNode = useNodesStore.getState().nodes[targetNodeId];
          if (!liveNode) {
            showToast("No se pudo guardar", "error");
            return false;
          }
        } else if (liveNode.dataType === NODE_DATA_TYPES.VIDEO) {
          updateNode(targetNodeId, {
            content: mergeVideoNodeContent(liveNode.content, { writing: serialized }),
          });
        } else if (inlineTodosEnabled) {
          updateNode(targetNodeId, { content: serialized });
        } else {
          const plainText = draftBody.blocks
            ?.filter((block) => block.type === NODE_BLOCK_TYPES.TEXT)
            .map((block) => block.text)
            .join("\n\n")
            .trim() || "";
          updateNode(targetNodeId, { content: plainText });
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
      updateNode,
    ],
  );

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!saveEnabled) return;
    persistNotes(writingBody, { allowCreate: true, closeAfter: true });
  };

  const keepTextareaFocus = (e) => {
    if (
      e.target.closest(".doc-todo-plan")
      || e.target.closest(".node-writing-block-stack__h1")
      || e.target.closest(".node-writing-block-stack__code")
      || e.target.closest(".doc-code-block")
      || e.target.closest(".node-writing-text-field")
      || e.target.closest(".note-taker__writing-stack")
      || e.target.closest(".note-taker__save")
      || e.target.closest(".note-taker__content-box")
      || e.target.closest(".note-taker__content-scroll")
      || e.target.closest(".doc-slash-command-picker")
    ) {
      return;
    }
    e.preventDefault();
  };

  return (
    <section
      className={
        "note-taker"
        + (showInlineWritingTools ? " note-taker--inline-todos" : "")
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
        {showInlineWritingTools ? (
          <div className="note-taker__content-box">
            <div className="note-taker__content-scroll">
              <NodeWritingBlockStack
                className="note-taker__writing-stack"
                blocks={writingBody.blocks}
                onBlocksChange={(blocks) => setWritingBody({ blocks })}
                focusTarget={writingFocusTarget}
                onFocusTargetChange={setWritingFocusTarget}
                slashEnabled
                textPlaceholder="Escribe aquí, o /title, /todo o /code"
              />
            </div>
            <DocSlashCommandPicker
              variant="pad"
              commands={NODE_SLASH_COMMANDS}
              onSelectCommand={appendBlockFromPicker}
              isCommandEnabled={isNodeSlashCommandEnabled}
            />
          </div>
        ) : (
          <textarea
            className="note-taker__input"
            value={
              writingBody.blocks?.find((block) => block.type === NODE_BLOCK_TYPES.TEXT)?.text || ""
            }
            onChange={(e) => setWritingBody({
              blocks: [{ ...createEmptyTextBlock(e.target.value) }],
            })}
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
