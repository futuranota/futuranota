import { useCallback, useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { getBlockQueryText, blockDataType } from "../../lib/docNodeSync.js";
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
  buildVideoNodeContent,
} from "../../lib/videoEmbed.js";
import { DocSlashCommandPicker } from "../docs/blocks/DocSlashCommandPicker.jsx";
import { NodeWritingBlockStack } from "../nodes/NodeWritingBlockStack.jsx";
import {
  isNodeSlashCommandEnabled,
  NODE_SLASH_COMMANDS,
  parseNodeSlashQuery,
} from "../../lib/docBlockSlash.js";
import { DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";
import { ContentTextSizeControls } from "../docs/ContentTextSizeControls.jsx";
import { useDocTextTypography } from "../../hooks/useDocTextTypography.js";

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

  if (node.dataType === NODE_DATA_TYPES.TEXT) {
    return parseNodeWritingBody(node.content);
  }

  if (inlineWritingEnabled) {
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
  companyObjectId: companyObjectIdProp = null,
  onClose,
  inlineTodosEnabled = false,
  titleEditable = false,
  fixedTitle = null,
  draftTitle,
  onDraftTitleChange,
  onDraftTitleBlur,
}) {
  const addNode = useNodesStore((s) => s.addNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const showToast = useUIStateStore((s) => s.showToast);
  const activeCorpusObjectId = useUIStateStore(
    (s) => s.selectedObjectId || s.filterObjectId || null,
  );

  const [resolvedNodeId, setResolvedNodeId] = useState(nodeIdProp);
  const node = useNodesStore((s) => (resolvedNodeId ? s.nodes[resolvedNodeId] : null));

  const initialDraft = readPanelDraft(node, inlineTodosEnabled);
  const [writingBody, setWritingBody] = useState(() => initialDraft);
  const [writingFocusTarget, setWritingFocusTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const typographyStorageKey = resolvedNodeId ? `node:${resolvedNodeId}` : "note-taker";
  const { typographyId, setTypographyId, typographyStyle } = useDocTextTypography(typographyStorageKey);
  const parentDoc = useDocsStore((s) => (parentDocId ? s.docs[parentDocId] : null));
  const nodeLinkedDoc = useDocsStore((s) => {
    const docId = node?.parentDocId;
    return docId ? s.docs[docId] : null;
  });
  const companyObjectId = companyObjectIdProp
    ?? parentDoc?.parentObjectId
    ?? nodeLinkedDoc?.parentObjectId
    ?? activeCorpusObjectId
    ?? null;

  useEffect(() => {
    setResolvedNodeId(nodeIdProp);
  }, [nodeIdProp]);

  useEffect(() => {
    if (nodeIdProp || resolvedNodeId) return;
    if (!parentDocId || typeof blockIndex !== "number") return;
    const doc = useDocsStore.getState().getDoc(parentDocId);
    const blockNodeId = doc?.blocks?.[blockIndex]?.nodeId;
    if (blockNodeId) setResolvedNodeId(blockNodeId);
  }, [nodeIdProp, resolvedNodeId, parentDocId, blockIndex]);

  const resolveTargetNodeId = useCallback(() => {
    if (resolvedNodeId) return resolvedNodeId;
    if (nodeIdProp) return nodeIdProp;
    if (!parentDocId || typeof blockIndex !== "number") return null;
    const doc = useDocsStore.getState().getDoc(parentDocId);
    return doc?.blocks?.[blockIndex]?.nodeId || null;
  }, [blockIndex, nodeIdProp, parentDocId, resolvedNodeId]);

  const buildNodeContentPayload = useCallback((draftBody, dataType, existingNode = null) => {
    const serialized = serializeNodeWritingBody(draftBody);
    const hasStructuredContent = Boolean(serialized);
    const plainText = draftBody.blocks
      ?.filter((block) => block.type === NODE_BLOCK_TYPES.TEXT)
      .map((block) => block.text)
      .join("\n\n")
      .trim() || "";
    const textPayload = hasStructuredContent || inlineTodosEnabled || dataType === NODE_DATA_TYPES.TEXT
      ? serialized
      : plainText;

    if (dataType === NODE_DATA_TYPES.VIDEO) {
      const base = existingNode?.dataType === NODE_DATA_TYPES.VIDEO && existingNode.content
        ? existingNode.content
        : buildVideoNodeContent(null);
      return hasStructuredContent
        ? mergeVideoNodeContent(base, { writing: serialized })
        : mergeVideoNodeContent(base, { notes: plainText });
    }

    return textPayload;
  }, [inlineTodosEnabled]);

  // Sync draft when the panel target identity changes — not on every content
  // mutation (e.g. Load embed), which would wipe in-progress notes.
  useEffect(() => {
    setWritingBody(readPanelDraft(node, inlineTodosEnabled));
    setWritingFocusTarget(null);
  }, [inlineTodosEnabled, resolvedNodeId, node?.id, node?.dataType]);

  const label = node
    ? ((node.sourceQuery || node.title || UNTITLED_LABEL).trim() || UNTITLED_LABEL)
    : UNTITLED_LABEL;
  const resolvedFixedTitle = typeof fixedTitle === "string" ? fixedTitle.trim() : "";
  const displayTitle = resolvedFixedTitle
    || (titleEditable && draftTitle !== undefined ? draftTitle : label);
  const resolvedDraftTitle = titleEditable && draftTitle !== undefined
    ? draftTitle
    : displayTitle;
  const hasContent = nodeWritingBlocksHaveContent(writingBody.blocks);
  const saveEnabled = hasContent && !saving;
  const showInlineWritingTools = inlineTodosEnabled || node?.dataType === NODE_DATA_TYPES.TEXT;

  const handleWritingBlocksChange = useCallback((blocks) => {
    const prevBlocks = writingBody.blocks;
    setWritingBody({ blocks });

    if (!companyObjectId) return;
    const vaultTypes = [NODE_BLOCK_TYPES.LINK_VAULT, NODE_BLOCK_TYPES.PASSWORD_VAULT];
    const countVaults = (list) => list?.filter((block) => vaultTypes.includes(block.type)).length ?? 0;
    if (countVaults(prevBlocks) <= countVaults(blocks)) return;

    const targetNodeId = resolveTargetNodeId();
    if (!targetNodeId) return;
    const liveNode = useNodesStore.getState().nodes[targetNodeId];
    if (!liveNode) return;

    const nextContent = liveNode.dataType === NODE_DATA_TYPES.VIDEO
      ? buildNodeContentPayload({ blocks }, NODE_DATA_TYPES.VIDEO, liveNode)
      : serializeNodeWritingBody({ blocks });
    updateNode(targetNodeId, { content: nextContent });
  }, [
    buildNodeContentPayload,
    companyObjectId,
    resolveTargetNodeId,
    updateNode,
    writingBody.blocks,
  ]);

  const appendBlockFromPicker = useCallback((alias) => {
    const parsed = parseNodeSlashQuery(alias);
    if (!parsed) return;
    const normalized = normalizeWritingBlocks(writingBody.blocks);
    const { blocks: nextBlocks, insertedIndex, reusedAgent, focusText } = appendNodeWritingBlockFromSlash(
      normalized,
      parsed,
    );
    setWritingBody({ blocks: nextBlocks });
    if (insertedIndex < 0) return;
    if (focusText) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusText: true });
      return;
    }
    if (reusedAgent) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusAgent: true });
      return;
    }
    if (parsed.type === DOC_BLOCK_TYPES.TODO) {
      const todoBlock = nextBlocks[insertedIndex];
      setWritingFocusTarget({
        blockIndex: insertedIndex,
        itemId: todoBlock?.items?.[0]?.id ?? null,
      });
    } else if (parsed.type === DOC_BLOCK_TYPES.CODE) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusCode: true });
    } else if (
      parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
      || parsed.type === DOC_BLOCK_TYPES.LINK_VAULT
    ) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusVault: true });
    } else if (parsed.type === DOC_BLOCK_TYPES.AGENT) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusAgent: true });
    } else if (
      parsed.type === DOC_BLOCK_TYPES.H1
      || parsed.type === DOC_BLOCK_TYPES.H2
      || parsed.type === DOC_BLOCK_TYPES.H3
    ) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusHeading: true });
    }
  }, [writingBody.blocks]);

  const createIntelNode = useCallback(
    (draftBody) => {
      if (parentDocId && typeof blockIndex === "number") {
        const doc = useDocsStore.getState().getDoc(parentDocId);
        const block = doc?.blocks?.[blockIndex];
        if (block?.id) {
          const queryText = getBlockQueryText(block) || UNTITLED_NODE_TITLE;
          const existingNodeId = resolveTargetNodeId() || block.nodeId || null;
          const existingNode = existingNodeId
            ? useNodesStore.getState().nodes[existingNodeId]
            : null;
          const dataType = blockDataType(block, doc.blocks, blockIndex);
          const nodeContent = buildNodeContentPayload(draftBody, dataType, existingNode);
          const newId = createOrUpdateNodeFromDocBlock({
            nodeId: existingNodeId,
            docId: parentDocId,
            blockId: block.id,
            query: queryText,
            content: nodeContent,
            dataType,
          });
          setResolvedNodeId(newId);
          useUIStateStore.getState().patchIntelSearchNodeId(newId);
          syncNodeToParentDoc(newId, parentDocId);
          return newId;
        }
      }

      const linkedNodeId = resolveTargetNodeId();
      const linkedNode = linkedNodeId
        ? useNodesStore.getState().nodes[linkedNodeId]
        : null;
      const nodeTitle = titleEditable
        ? ((draftTitle || "").trim() || UNTITLED_NODE_TITLE)
        : resolvedFixedTitle
          || (linkedNode
            ? ((linkedNode.sourceQuery || linkedNode.title || UNTITLED_NODE_TITLE).trim()
              || UNTITLED_NODE_TITLE)
            : UNTITLED_NODE_TITLE);
      const dataType = linkedNode?.dataType || NODE_DATA_TYPES.TEXT;
      const nodeContent = buildNodeContentPayload(draftBody, dataType, linkedNode);

      // Parentless YouTube/Intel notes belong in Independent Documents — need corpus objectId.
      const corpusObjectId = companyObjectId || linkedNode?.objectId || null;
      const newId = addNode(
        nodeTitle,
        dataType,
        nodeContent,
        parentDocId || null,
        {
          sourceQuery: nodeTitle,
          sourceBlockId: linkedNode?.sourceBlockId || undefined,
          objectId: corpusObjectId,
        },
      );
      setResolvedNodeId(newId);
      useUIStateStore.getState().patchIntelSearchNodeId(newId);
      if (parentDocId) {
        syncNodeToParentDoc(newId, parentDocId);
      }
      return newId;
    },
    [
      addNode,
      blockIndex,
      buildNodeContentPayload,
      companyObjectId,
      createOrUpdateNodeFromDocBlock,
      parentDocId,
      resolveTargetNodeId,
      syncNodeToParentDoc,
      draftTitle,
      fixedTitle,
      titleEditable,
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
      const hasStructuredContent = Boolean(serialized);
      if (!hasStructuredContent && !nodeWritingBlocksHaveContent(draftBody.blocks)) {
        return false;
      }

      const startedAt = Date.now();
      setSaving(true);

      try {
        let targetNodeId = resolveTargetNodeId();
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
        } else {
          const trimmedTitle = titleEditable
            ? ((draftTitle || "").trim() || UNTITLED_NODE_TITLE)
            : resolvedFixedTitle
              ? resolvedFixedTitle
              : null;
          if (trimmedTitle && trimmedTitle !== (liveNode.sourceQuery || liveNode.title)) {
            updateNode(targetNodeId, {
              title: trimmedTitle,
              sourceQuery: trimmedTitle,
            });
            liveNode = { ...liveNode, title: trimmedTitle, sourceQuery: trimmedTitle };
          }
        }

        const plainText = draftBody.blocks
          ?.filter((block) => block.type === NODE_BLOCK_TYPES.TEXT)
          .map((block) => block.text)
          .join("\n\n")
          .trim() || "";
        const contentPayload = hasStructuredContent ? serialized : plainText;
        const dataType = liveNode.dataType || NODE_DATA_TYPES.TEXT;
        const nextContent = dataType === NODE_DATA_TYPES.VIDEO
          ? buildNodeContentPayload(draftBody, NODE_DATA_TYPES.VIDEO, liveNode)
          : contentPayload;

        const parentId = liveNode.parentDocId || parentDocId || null;
        const corpusObjectId = companyObjectId || liveNode.objectId || null;

        updateNode(targetNodeId, {
          content: nextContent,
          ...(parentDocId && !liveNode.parentDocId
            ? { parentDocId, linkedToDoc: true }
            : {}),
          // Keep parentless notes scoped so they appear under Independent Documents.
          ...(!parentId && corpusObjectId && liveNode.objectId !== corpusObjectId
            ? { objectId: corpusObjectId }
            : {}),
        });

        if (parentId) {
          syncNodeToParentDoc(targetNodeId, parentId);
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed < SAVE_MIN_MS) {
          await wait(SAVE_MIN_MS - elapsed);
        }

        showToast(
          parentId ? "Guardado en el documento" : "Guardado en Independent Documents",
          "success",
        );
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
      buildNodeContentPayload,
      companyObjectId,
      createIntelNode,
      draftTitle,
      fixedTitle,
      inlineTodosEnabled,
      onClose,
      parentDocId,
      resolveTargetNodeId,
      showToast,
      syncNodeToParentDoc,
      titleEditable,
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
      || e.target.closest(".node-writing-block-stack__h2")
      || e.target.closest(".node-writing-block-stack__h3")
      || e.target.closest(".node-writing-block-stack__code")
      || e.target.closest(".node-writing-block-stack__agent")
      || e.target.closest(".node-writing-block-stack__vault")
      || e.target.closest(".doc-agent-cell")
      || e.target.closest(".doc-code-block")
      || e.target.closest(".doc-vault-block")
      || e.target.closest(".node-writing-text-field")
      || e.target.closest(".note-taker__input")
      || e.target.closest(".note-taker__writing-stack")
      || e.target.closest(".note-taker__save")
      || e.target.closest(".note-taker__content-box")
      || e.target.closest(".note-taker__content-scroll")
      || e.target.closest(".note-taker__title-input")
      || e.target.closest(".doc-linked-node-actions")
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
        {titleEditable ? (
          <input
            type="text"
            className="note-taker__title-input"
            value={resolvedDraftTitle}
            placeholder={UNTITLED_LABEL}
            spellCheck={false}
            disabled={saving}
            onChange={(e) => onDraftTitleChange?.(e.target.value)}
            onBlur={() => onDraftTitleBlur?.()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label="Note title"
          />
        ) : (
          <span className="note-taker__label" title={displayTitle}>
            {displayTitle || UNTITLED_LABEL}
          </span>
        )}
      </header>
      <div className="note-taker__input-wrap">
        {showInlineWritingTools ? (
          <div className="note-taker__content-box" style={typographyStyle}>
            <div className="note-taker__content-scroll">
              <NodeWritingBlockStack
                className="note-taker__writing-stack"
                blocks={writingBody.blocks}
                onBlocksChange={handleWritingBlocksChange}
                focusTarget={writingFocusTarget}
                onFocusTargetChange={setWritingFocusTarget}
                contentFocusMode
                slashEnabled
                textPlaceholder="Escribe aquí o /macronodo"
                companyObjectId={companyObjectId}
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
        {showInlineWritingTools ? (
          <ContentTextSizeControls
            typographyId={typographyId}
            onTypographyChange={setTypographyId}
          />
        ) : (
          <span aria-hidden />
        )}
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
