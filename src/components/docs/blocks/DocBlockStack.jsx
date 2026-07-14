import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  Fragment,
  forwardRef,
} from "react";
import {
  convertImageLayoutBlock,
  createDocBlock,
  createTodoItem,
  applyTodoSlashToImageSplit,
  DOC_BLOCK_TYPES,
  IMAGE_SPLIT_BODY_MODE,
  ensureEmptyTextBlockAfter,
  ensureWritableDocTail,
  hasProductCardBlock,
  h1HasVideoEmbedSibling,
  insertBlockAfter,
  isEmptyTextBlock,
  normalizeDocBlocks,
  normalizeDocBlock,
  removeBlockAt,
  removeEmbedVideoPairAt,
  removeEmbedVideoPairFromVideoIndex,
  replaceBlockFromSlashInLinkable,
  replaceBlocksFromSlashInText,
  replaceBlocksFromSlashInMoodboardBody,
  replaceBlocksFromSlashWithEmbedVideo,
  stepEntryHasContent,
  updateBlockAt,
} from "../../../lib/docBlocks.js";
import {
  createDocBlockFromSlash,
  DOCUMENT_SLASH_COMMANDS,
  DOCUMENT_SLASH_GHOST_HINTS,
  IMAGE_CARD_BODY_SLASH_COMMANDS,
  IMAGE_CARD_BODY_SLASH_GHOST_HINTS,
  parseSlashQueryFromCommands,
  splitBodyForSlash,
} from "../../../lib/docBlockSlash.js";
import { getH1IndexForTextBlock, ensureContinuationAfterLinkedOwner, getLinkedContinuationTextIndex, getLinkedOwnerForContinuationSlot, getLinkedOwnerIndexForTextBlock, getOwnedTextBlockIndices, getOwningScheduleBlockIndexForText, getWritableTextIndexBelowLinkedOwner, isDocBlockLinkedToNode, isLinkedOwnerContinuationSlot, isPrimaryAnswerTextForLinkedOwner, isTextHiddenByLinkedMacroNode, removeLinkedOwnerBundleFromBlocks } from "../../../lib/docNodeSync.js";
import { isNoNodeLinkMode, NO_NODE_LINK_COLOR_ID, resolveBlockNodeLinkColor } from "../../../lib/docNodeLinkColors.js";
import {
  buildDetachedWidgetEmbedded,
  captureDocBlockWidgetSnapshot,
  isEmbeddableWidgetBlock,
  WIDGET_SNAPSHOT_KIND,
} from "../../../lib/captureWidgetSnapshot.js";
import { scrollTextareaCaretIntoCameraView } from "../../../lib/textareaSelectionRect.js";
import { tryDocSelectAllKeyDown, requestDocSelectAll } from "../../../lib/docSelectAll.js";
import {
  replaceProseSegmentInBlocks,
} from "../../../lib/docProseUnified.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { useConfirmStore } from "../../../stores/confirmStore.js";
import { useNodesStore } from "../../../stores/nodesStore.js";
import { useDocsStore } from "../../../stores/docsStore.js";
import { queueUrlTableEntry } from "../../../lib/urlTableSession.js";
import { queuePasswordTableEntry } from "../../../lib/passwordTableSession.js";
import { H1BlockView } from "./H1BlockView.jsx";
import { H2BlockView } from "./H2BlockView.jsx";
import { H3BlockView } from "./H3BlockView.jsx";
import { TextBlockView } from "./TextBlockView.jsx";
import { LinkedMacronodeDescription } from "../LinkedMacronodeDescription.jsx";

function findLastDocVaultBlockIndex(blocks, blockType) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type === blockType) return index;
  }
  return -1;
}

function ensureLinkedMacroContinuationSlots(blocks) {
  let next = normalizeDocBlocks(blocks);
  let changed = false;
  for (let i = 0; i < next.length; i++) {
    const block = next[i];
    if (
      (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO)
      && isDocBlockLinkedToNode(block)
    ) {
      const ensured = ensureContinuationAfterLinkedOwner(next, i);
      if (ensured !== next) {
        next = ensured;
        changed = true;
      }
    }
  }
  return changed ? next : blocks;
}
import { DocTodoPlanBlockView } from "./DocTodoPlanBlockView.jsx";
import { DateBlockView } from "./DateBlockView.jsx";
import { MetricBlockView } from "./MetricBlockView.jsx";
import { ProductCardBlockView } from "./ProductCardBlockView.jsx";
import { VideoEmbedBlockView } from "./VideoEmbedBlockView.jsx";
import { ImageBlockView } from "./ImageBlockView.jsx";
import { ImageSplitBlockView } from "./ImageSplitBlockView.jsx";
import { MoodboardBlockView } from "./MoodboardBlockView.jsx";
import { BannerBlockView } from "./BannerBlockView.jsx";
import { CodeBlockView } from "./CodeBlockView.jsx";
import { PasswordVaultBlockView } from "./PasswordVaultBlockView.jsx";
import { LinkVaultBlockView } from "./LinkVaultBlockView.jsx";
import { AgentBlockView } from "./AgentBlockView.jsx";
import { StepSequenceBlockView } from "./StepSequenceBlockView.jsx";

const UNLINK_H1_PATCH = {
  nodeId: undefined,
  queryEnabled: false,
  nodeLinkColor: NO_NODE_LINK_COLOR_ID,
  anchorFromNode: false,
  anchorDate: "",
  anchorTime: "",
  sourceQuery: undefined,
};

function focusTextInputWithCamera(input, caretPos) {
  if (!input || !("focus" in input)) return;
  const isAlreadyFocused = document.activeElement === input;
  input.focus({ preventScroll: true });
  if (!("setSelectionRange" in input)) return;
  if (caretPos != null) {
    input.setSelectionRange(caretPos, caretPos);
    return;
  }
  if (!isAlreadyFocused) {
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }
}

function scrollCaretAfterNewline(blockId) {
  requestAnimationFrame(() => {
    const textarea = document.querySelector(`[data-block-id="${blockId}"] textarea`);
    if (textarea instanceof HTMLTextAreaElement) {
      scrollTextareaCaretIntoCameraView(textarea, { behavior: "instant" });
    }
  });
}

export const DocBlockStack = forwardRef(function DocBlockStack({
  blocks,
  onBlocksChange,
  focusBlockId = null,
  onFocusBlock,
  bodyPlaceholder,
  onBodyKeyDown,
  onEnterNewLine,
  onOpenNodeForBlock,
  onOpenNodeForH1,
  onAnswerBelowH1Change,
  onBlockAnchorChange,
  docCreatedDate = "",
  onInsertProductToCanvas,
  onEnsureNodeForBlock,
  onVideoEmbedSync,
  onVideoEmbedH1TitleChange,
  onDetachFromNode,
  continuationPlaceholder = "Keep writing, or type / for a new block",
  reportPresentation = null,
  onReportAnimationComplete = null,
  onSavedStepSequenceRemoved = null,
  companyObjectId = null,
  slashCommands = DOCUMENT_SLASH_COMMANDS,
  slashGhostHints = DOCUMENT_SLASH_GHOST_HINTS,
}, ref) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const [todoFocusItemId, setTodoFocusItemId] = useState(null);
  const [collapsedContentByBlockId, setCollapsedContentByBlockId] = useState({});
  const [collapsedPadWriteByOwnerId, setCollapsedPadWriteByOwnerId] = useState({});
  const updateNode = useNodesStore((s) => s.updateNode);
  const getNode = useNodesStore((s) => s.getNode);
  const addNodeToDoc = useDocsStore((s) => s.addNodeToDoc);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const openNode = onOpenNodeForBlock || onOpenNodeForH1;
  const blocksRef = useRef(blocks);
  const stackRef = useRef(null);
  const slashCommandsRef = useRef(slashCommands);

  useLayoutEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useLayoutEffect(() => {
    slashCommandsRef.current = slashCommands;
  }, [slashCommands]);

  const parseScopedSlash = useCallback((query) => (
    parseSlashQueryFromCommands(query, slashCommandsRef.current)
  ), []);

  const resyncAllTextHeights = useCallback(() => {
    const root = stackRef.current;
    if (!root) return;
    root.querySelectorAll("textarea").forEach((textarea) => {
      textarea.style.height = "auto";
      const minH = textarea.classList.contains("doc-h1-block__input--multiline") ? 22 : 28;
      const next = Math.max(textarea.scrollHeight, minH);
      if (Math.abs(textarea.offsetHeight - next) > 1) {
        textarea.style.height = `${next}px`;
      }
      textarea.style.overflowY = textarea.scrollHeight > next + 1 ? "auto" : "hidden";
    });
  }, []);

  const blocksStructureKey = blocks.map((b) => `${b.id}:${b.type}`).join("|");
  const linkedOwnersKey = blocks
    .map((b) => `${b.id}:${Boolean(b.nodeId)}:${Boolean(b.queryEnabled)}:${b.nodeLinkColor ?? ""}`)
    .join("|");

  const isCollapsedPadWriteBlock = (blockId) => {
    if (!blockId) return false;
    for (const [ownerId, entry] of Object.entries(collapsedPadWriteByOwnerId)) {
      if (entry?.blockId === blockId && collapsedContentByBlockId[ownerId]) return true;
    }
    return false;
  };

  const resolveBlockById = (blockId) => {
    if (isCollapsedPadWriteBlock(blockId)) {
      return blocksRef.current.find((b) => b.id === blockId)
        ?? blocks.find((b) => b.id === blockId)
        ?? null;
    }
    return blocks.find((b) => b.id === blockId)
      ?? blocksRef.current.find((b) => b.id === blockId)
      ?? null;
  };

  const resolveBlockIndexById = (blockId) => {
    if (isCollapsedPadWriteBlock(blockId)) {
      const refIndex = blocksRef.current.findIndex((b) => b.id === blockId);
      if (refIndex >= 0) return refIndex;
    }
    const propsIndex = blocks.findIndex((b) => b.id === blockId);
    if (propsIndex >= 0) return propsIndex;
    return blocksRef.current.findIndex((b) => b.id === blockId);
  };

  const clearCollapsedPadWrite = (ownerId) => {
    setCollapsedPadWriteByOwnerId((prev) => {
      if (!prev[ownerId]) return prev;
      const next = { ...prev };
      delete next[ownerId];
      return next;
    });
  };

  const blockLinkColor = (block) => resolveBlockNodeLinkColor(block);
  const blockLinksEnabled = (block) => !isNoNodeLinkMode(blockLinkColor(block));

  /** Macronode title edits in the folder push immediately to the linked node (+ left panel). */
  const syncLinkedBlockTitleToNode = (block, nextTitle) => {
    if (!isDocBlockLinkedToNode(block) || !block.nodeId) return;
    const title = String(nextTitle ?? "").trim() || "Untitled query";
    useNodesStore.getState().updateNode(block.nodeId, {
      title,
      sourceQuery: title,
    });
  };

  const isMarketingGuideReport = reportPresentation?.kind === "marketing-guide-v1";
  const isSocialHypeReport = reportPresentation?.kind === "social-hype-v1";
  const isAnalystReport = reportPresentation?.kind === "analyst-strategic-v2"
    || isMarketingGuideReport
    || isSocialHypeReport;
  const shouldAnimateReport = Boolean(reportPresentation?.animateOnOpen) && !isMarketingGuideReport;

  const showScheduleForBlock = () => false;

  const isContentExpanded = (blockId) => !collapsedContentByBlockId[blockId];

  const toggleBlockContent = (blockId) => {
    const willCollapse = !collapsedContentByBlockId[blockId];

    setCollapsedContentByBlockId((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));

    clearCollapsedPadWrite(blockId);

    if (!willCollapse) {
      const ownerIndex = blocksRef.current.findIndex((b) => b.id === blockId);
      if (ownerIndex >= 0 && blocksRef.current[ownerIndex]?.type === DOC_BLOCK_TYPES.H1) {
        const owned = getOwnedTextBlockIndices(blocksRef.current, ownerIndex);
        if (owned[0] >= 0) {
          onAnswerBelowH1Change?.(
            ownerIndex,
            blocksRef.current[owned[0]]?.text || "",
          );
        }
      }
      if (ownerIndex >= 0) {
        resyncOwnedTextHeights(ownerIndex);
      }
    }

    requestContentGrow();
  };

  const insertSlashCommandForOwner = (ownerIndex, alias) => {
    const parsed = parseScopedSlash(alias);
    if (!parsed || !canInsertSlashBlock(parsed)) return;

    const ownerBlock = blocksRef.current[ownerIndex];
    if (!ownerBlock) return;

    const padEntry = collapsedPadWriteByOwnerId[ownerBlock.id];
    let blockIndex = padEntry?.blockId
      ? blocksRef.current.findIndex((b) => b.id === padEntry.blockId)
      : -1;

    if (blockIndex < 0) {
      let current = blocksRef.current;
      if (isDocBlockLinkedToNode(ownerBlock)) {
        const ensured = ensureContinuationAfterLinkedOwner(current, ownerIndex);
        if (ensured !== current) {
          current = ensured;
          setBlocks(ensured);
        }
        blockIndex = getWritableTextIndexBelowLinkedOwner(current, ownerIndex);
      } else {
        const owned = getOwnedTextBlockIndices(current, ownerIndex);
        const insertAfterIndex = owned.length > 0 ? owned[owned.length - 1] : ownerIndex;
        const nextBlock = current[insertAfterIndex + 1];
        if (isEmptyTextBlock(nextBlock)) {
          blockIndex = insertAfterIndex + 1;
        } else {
          const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
          const inserted = insertBlockAfter(current, insertAfterIndex, textBlock);
          setBlocks(inserted);
          blockIndex = insertAfterIndex + 1;
        }
      }
    }

    const block = blocksRef.current[blockIndex];
    if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return;

    clearCollapsedPadWrite(ownerBlock.id);
    insertSlashFromText(blockIndex, block.text || "", parsed);
  };

  const insertSlashCommandAtFocus = (alias) => {
    const parsed = parseScopedSlash(alias);
    if (!parsed || !canInsertSlashBlock(parsed)) return;

    if (parsed.focusTextBlock) {
      let next = ensureWritableDocTail(blocksRef.current);
      setBlocks(next);
      const textBlock = next[next.length - 1];
      if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
        onFocusBlock?.(textBlock.id);
        focusBlockCaret(textBlock.id, 0);
        requestContentGrow();
      }
      return;
    }

    for (const [ownerId, entry] of Object.entries(collapsedPadWriteByOwnerId)) {
      if (!collapsedContentByBlockId[ownerId] || !entry?.blockId) continue;
      const ownerIndex = blocksRef.current.findIndex((b) => b.id === ownerId);
      if (ownerIndex >= 0) {
        insertSlashCommandForOwner(ownerIndex, alias);
        return;
      }
    }

    const current = blocksRef.current;
    let blockIndex = focusBlockId
      ? current.findIndex((b) => b.id === focusBlockId)
      : -1;

    if (blockIndex >= 0) {
      const focused = current[blockIndex];
      if (focused.type === DOC_BLOCK_TYPES.TEXT) {
        if (isTextHiddenByParentCollapse(blockIndex)) {
          const ownerIndex = getOwningScheduleBlockIndexForText(current, blockIndex);
          if (ownerIndex >= 0) {
            insertSlashCommandForOwner(ownerIndex, alias);
            return;
          }
        }
        insertSlashFromText(blockIndex, focused.text || "", parsed);
        return;
      }

      if (
        focused.type === DOC_BLOCK_TYPES.H1
        || focused.type === DOC_BLOCK_TYPES.H2
        || focused.type === DOC_BLOCK_TYPES.H3
        || focused.type === DOC_BLOCK_TYPES.TODO
        || focused.type === DOC_BLOCK_TYPES.DATE
        || focused.type === DOC_BLOCK_TYPES.METRIC
      ) {
        if (
          (focused.type === DOC_BLOCK_TYPES.H1 || focused.type === DOC_BLOCK_TYPES.TODO)
          && isDocBlockLinkedToNode(focused)
        ) {
          insertSlashCommandForOwner(blockIndex, alias);
          return;
        }

        const owned = focused.type === DOC_BLOCK_TYPES.H1 || focused.type === DOC_BLOCK_TYPES.TODO
          ? getOwnedTextBlockIndices(current, blockIndex)
          : [];
        const insertAfterIndex = owned.length > 0 ? owned[owned.length - 1] : blockIndex;
        const nextBlock = current[insertAfterIndex + 1];
        let targetIndex = insertAfterIndex + 1;
        if (!isEmptyTextBlock(nextBlock)) {
          const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
          const inserted = insertBlockAfter(current, insertAfterIndex, textBlock);
          setBlocks(inserted);
          targetIndex = insertAfterIndex + 1;
        }
        insertSlashFromText(
          targetIndex,
          blocksRef.current[targetIndex]?.text || "",
          parsed,
        );
        return;
      }
    }

    let targetIndex = current.length - 1;
    if (targetIndex < 0) return;

    if (!isEmptyTextBlock(current[targetIndex])) {
      const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
      const inserted = insertBlockAfter(current, targetIndex, textBlock);
      setBlocks(inserted);
      targetIndex += 1;
    }

    insertSlashFromText(
      targetIndex,
      blocksRef.current[targetIndex]?.text || "",
      parsed,
    );
  };

  const isTextHiddenByParentCollapse = (index) => {
    const blocksList = blocksRef.current;
    const ownerIndex = getOwningScheduleBlockIndexForText(blocksList, index);
    if (ownerIndex < 0) return false;
    const ownerBlock = blocksList[ownerIndex];
    if (!showScheduleForBlock(ownerBlock)) return false;
    return Boolean(collapsedContentByBlockId[ownerBlock.id]);
  };

  const focusPadTextarea = (blockId, caretPos = 0) => {
    const attempt = (tries = 0) => {
      requestAnimationFrame(() => {
        const input = document.querySelector(
          `[data-collapsed-write-field="${blockId}"] textarea`,
        );
        if (!input && tries < 12) {
          attempt(tries + 1);
          return;
        }
        if (!input || !("focus" in input)) {
          return;
        }
        focusTextInputWithCamera(input, caretPos);
      });
    };
    attempt();
  };

  const focusBlockCaret = (blockId, caretPos = null) => {
    if (!blockId) return;
    if (isCollapsedPadWriteBlock(blockId)) {
      focusPadTextarea(blockId, caretPos ?? 0);
      return;
    }
    const attempt = (tries = 0) => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${blockId}"]`);
        const input = el?.querySelector("input:not([type='checkbox']), textarea");
        if (!input && tries < 12) {
          attempt(tries + 1);
          return;
        }
        if (!input || !("focus" in input)) {
          return;
        }
        focusTextInputWithCamera(input, caretPos);
      });
    };
    attempt();
  };

  const isAtInputStart = (e) =>
    e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0;

  const syncAnswerBelowH1 = (blocksList, textBlockIndex, text) => {
    if (!isPrimaryAnswerTextForLinkedOwner(blocksList, textBlockIndex)) return;
    const h1Index = getH1IndexForTextBlock(blocksList, textBlockIndex);
    if (h1Index >= 0) onAnswerBelowH1Change?.(h1Index, text);
  };

  useLayoutEffect(() => {
    const current = blocksRef.current;
    let next = current;
    let changed = false;

    for (let i = 0; i < next.length; i++) {
      const block = next[i];
      if (
        (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO)
        && isDocBlockLinkedToNode(block)
      ) {
        const ensured = ensureContinuationAfterLinkedOwner(next, i);
        if (ensured !== next) {
          next = ensured;
          changed = true;
        }
      }
    }

    if (changed) setBlocks(next);
  }, [linkedOwnersKey, blocksStructureKey]);

  const requestContentGrow = () => {
    onEnterNewLine?.();
  };

  const resyncOwnedTextHeights = (ownerIndex) => {
    const owned = getOwnedTextBlockIndices(blocksRef.current, ownerIndex);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        owned.forEach((textIndex) => {
          const blockId = blocksRef.current[textIndex]?.id;
          if (!blockId) return;
          const textarea = document.querySelector(
            `[data-block-id="${blockId}"] textarea`,
          );
          if (!textarea) return;
          textarea.style.height = "auto";
          textarea.style.height = `${Math.max(textarea.scrollHeight, 28)}px`;
          textarea.style.overflowY = "hidden";
        });
      });
    });
  };

  useEffect(() => {
    if (!focusBlockId) return;
    if (isCollapsedPadWriteBlock(focusBlockId)) {
      focusPadTextarea(focusBlockId);
      return;
    }
    const currentBlocks = blocksRef.current;
    const focusIndex = currentBlocks.findIndex((b) => b.id === focusBlockId);
    if (focusIndex >= 0 && isTextHiddenByParentCollapse(focusIndex)) {
      return;
    }
    focusBlockCaret(focusBlockId);
  }, [focusBlockId, collapsedContentByBlockId, collapsedPadWriteByOwnerId]);

  useLayoutEffect(() => {
    Object.entries(collapsedPadWriteByOwnerId).forEach(([ownerId, entry]) => {
      if (!collapsedContentByBlockId[ownerId] || focusBlockId !== entry?.blockId) return;
      focusPadTextarea(entry.blockId);
    });
  }, [collapsedPadWriteByOwnerId, collapsedContentByBlockId, focusBlockId, blocks.length]);

  useLayoutEffect(() => {
    requestContentGrow();
  }, [collapsedContentByBlockId, collapsedPadWriteByOwnerId]);

  useLayoutEffect(() => {
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(resyncAllTextHeights);
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [blocksStructureKey, collapsedContentByBlockId, collapsedPadWriteByOwnerId, resyncAllTextHeights]);

  const setBlocks = (next) => {
    const merged = ensureLinkedMacroContinuationSlots(normalizeDocBlocks(next));
    blocksRef.current = merged;
    onBlocksChange?.(merged);
  };

  const updateAt = (index, patch) => {
    setBlocks(updateBlockAt(blocksRef.current, index, patch));
  };

  const handleRemoveEmbeddedBlock = useCallback(async (blockIndex) => {
    const current = blocksRef.current;
    const block = current[blockIndex];
    if (!isEmbeddableWidgetBlock(block)) return;

    const h1Index = getH1IndexForTextBlock(current, blockIndex);
    const h1 = h1Index >= 0 ? current[h1Index] : null;
    const nodeId = block.embedded?.linkedNodeId || h1?.nodeId || null;

    const snapshotSrc = await captureDocBlockWidgetSnapshot(block.id);

    if (nodeId) {
      const node = getNode(nodeId);
      const folderId = node?.parentDocId || null;
      // Drop the widget layers/link from the body, but keep the document in the folder panel.
      updateNode(nodeId, {
        ...(folderId ? { parentDocId: folderId, linkedToDoc: true } : {}),
        sourceBlockId: undefined,
        sourceTextBlockId: undefined,
      });
      if (folderId) {
        addNodeToDoc(folderId, nodeId);
      }
    }

    const nextEmbedded = buildDetachedWidgetEmbedded(block, snapshotSrc);

    let next = current.map((b, i) => {
      if (i === h1Index && h1Index >= 0) {
        return normalizeDocBlock({ ...b, ...UNLINK_H1_PATCH });
      }
      if (i === blockIndex) {
        return normalizeDocBlock({
          ...b,
          text: b.text || "",
          embedded: nextEmbedded,
        });
      }
      return b;
    });

    next = ensureWritableDocTail(next);
    setBlocks(next);
    onFocusBlock?.(block.id);
  }, [getNode, updateNode, addNodeToDoc, onFocusBlock]);

  const handleRemoveWidgetSnapshot = useCallback((blockIndex) => {
    const current = blocksRef.current;
    const block = current[blockIndex];
    if (block?.embedded?.kind !== WIDGET_SNAPSHOT_KIND) return;

    let next = removeBlockAt(current, blockIndex);
    next = ensureWritableDocTail(next);
    setBlocks(next);
    const focusId = next[Math.min(blockIndex, next.length - 1)]?.id;
    if (focusId) {
      onFocusBlock?.(focusId);
      focusBlockCaret(focusId);
    }
  }, [onFocusBlock]);

  const handleEditEmbeddedAsText = useCallback((blockIndex) => {
    const block = blocksRef.current[blockIndex];
    if (!block) return;
    const text = block.text || "";
    updateAt(blockIndex, { embedded: null, text });
    onFocusBlock?.(block.id);
    requestAnimationFrame(() => focusBlockCaret(block.id, text.length));
  }, [onFocusBlock]);

  const removeEmbedVideoSection = (videoIndex) => {
    const h1Index = videoIndex - 1;
    let next = removeEmbedVideoPairFromVideoIndex(blocksRef.current, videoIndex);
    if (!next.length) {
      next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
    }
    setBlocks(next);
    const focusIndex = Math.max(0, h1Index - 1);
    const focusId = next[focusIndex]?.id;
    if (focusId) {
      onFocusBlock?.(focusId);
      focusBlockCaret(focusId);
    }
  };

  const confirmDeleteCommandBlock = useCallback(async (messageKey) => (
    askConfirm({
      title: t("doc.blockDelete.title"),
      message: t(messageKey),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    })
  ), [askConfirm, t]);

  const removeCommandBlockAt = useCallback((index, { grow = false } = {}) => {
    let next = removeBlockAt(blocksRef.current, index);
    if (!next.length) {
      next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
    }
    setBlocks(next);
    const focusIndex = Math.min(index, next.length - 1);
    onFocusBlock?.(next[focusIndex]?.id);
    if (grow) requestContentGrow();
  }, [onFocusBlock]);

  const finalizeSlashInsert = (nextBlocks, newBlockId, focusBlockId = newBlockId) => {
    const newIndex = nextBlocks.findIndex((b) => b.id === newBlockId);
    const next = newIndex >= 0
      ? ensureEmptyTextBlockAfter(nextBlocks, newIndex)
      : nextBlocks;
    setBlocks(next);
    onFocusBlock?.(focusBlockId);
    focusBlockCaret(focusBlockId, 0);
    requestContentGrow();
    return newBlockId;
  };

  const finalizeEmbedVideoSlashInsert = (nextBlocks) => {
    const videoIndex = nextBlocks.findIndex(
      (b, i) => b.type === DOC_BLOCK_TYPES.VIDEO_EMBED
        && nextBlocks[i - 1]?.type === DOC_BLOCK_TYPES.H1,
    );
    if (videoIndex < 0) return null;
    const h1Block = nextBlocks[videoIndex - 1];
    const next = ensureEmptyTextBlockAfter(nextBlocks, videoIndex);
    setBlocks(next);
    onFocusBlock?.(h1Block.id);
    focusBlockCaret(h1Block.id, 0);
    requestContentGrow();
    return h1Block.id;
  };

  const insertSlashFromText = (blockIndex, textValue, parsed) => {
    if (isTextHiddenByLinkedMacroNode(blocksRef.current, blockIndex)) {
      const ownerIndex = getOwningScheduleBlockIndexForText(blocksRef.current, blockIndex);
      const ownerBlock = ownerIndex >= 0 ? blocksRef.current[ownerIndex] : null;
      if (ownerBlock && isDocBlockLinkedToNode(ownerBlock)) {
        let current = blocksRef.current;
        const ensured = ensureContinuationAfterLinkedOwner(current, ownerIndex);
        if (ensured !== current) {
          current = ensured;
          setBlocks(ensured);
        }
        const writableIndex = getWritableTextIndexBelowLinkedOwner(current, ownerIndex);
        const writableBlock = blocksRef.current[writableIndex];
        if (writableBlock?.type === DOC_BLOCK_TYPES.TEXT && writableIndex !== blockIndex) {
          return insertSlashFromText(writableIndex, writableBlock.text || "", parsed);
        }
      }
    }

    if (
      parsed.type === DOC_BLOCK_TYPES.LINK_VAULT
      || parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
      || parsed.type === DOC_BLOCK_TYPES.AGENT
    ) {
      const existingIndex = findLastDocVaultBlockIndex(blocksRef.current, parsed.type);
      if (existingIndex >= 0) {
        const existingId = blocksRef.current[existingIndex]?.id;
        if (existingId) {
          onFocusBlock?.(existingId);
          focusBlockCaret(existingId);
          requestContentGrow();
          return existingId;
        }
      }
    }

    if (parsed.compound && parsed.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
      const next = replaceBlocksFromSlashWithEmbedVideo(
        blocksRef.current,
        blockIndex,
        textValue,
      );
      return finalizeEmbedVideoSlashInsert(next);
    }
    const newBlock = createDocBlockFromSlash(parsed);
    const next = replaceBlocksFromSlashInText(
      blocksRef.current,
      blockIndex,
      textValue,
      newBlock,
    );
    if (
      parsed.type === DOC_BLOCK_TYPES.IMAGE
      || parsed.type === DOC_BLOCK_TYPES.IMAGE_SPLIT
      || parsed.type === DOC_BLOCK_TYPES.MOODBOARD
      || parsed.type === DOC_BLOCK_TYPES.BANNER
      || parsed.type === DOC_BLOCK_TYPES.CODE
      || parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
      || parsed.type === DOC_BLOCK_TYPES.LINK_VAULT
      || parsed.type === DOC_BLOCK_TYPES.AGENT
    ) {
      const newIndex = next.findIndex((b) => b.id === newBlock.id);
      const withTail = newIndex >= 0
        ? ensureEmptyTextBlockAfter(next, newIndex)
        : next;
      setBlocks(withTail);
      onFocusBlock?.(newBlock.id);
      requestContentGrow();
      return newBlock.id;
    }
    finalizeSlashInsert(next, newBlock.id);
    return newBlock.id;
  };

  const handleQueryHandleClick = (index) => {
    const block = blocksRef.current[index];
    if (!block || !blockLinksEnabled(block)) return;

    if (!block.queryEnabled) {
      const patch = { queryEnabled: true };
      const ensuredNodeId = onEnsureNodeForBlock?.(index, block);
      if (ensuredNodeId) patch.nodeId = ensuredNodeId;
      let next = updateBlockAt(blocksRef.current, index, patch);
      next = ensureContinuationAfterLinkedOwner(next, index);
      setBlocks(next);
      return;
    }

    const fresh = normalizeDocBlocks(blocksRef.current)[index] ?? block;
    openNode?.(index, fresh);
  };

  const insertTextAfter = (index, initialText = "", sourceBlocks = null, options = {}) => {
    const { skipFocus = false } = options;
    let current = sourceBlocks ?? blocksRef.current;
    const ownerBlock = current[index];
    const h1Index = ownerBlock?.type === DOC_BLOCK_TYPES.H1 ? index : -1;
    const linkedOwnerIndex = (
      ownerBlock?.type === DOC_BLOCK_TYPES.H1
      || ownerBlock?.type === DOC_BLOCK_TYPES.TODO
    ) && isDocBlockLinkedToNode(ownerBlock)
      ? index
      : -1;

    if (h1Index >= 0 && current[h1Index + 1]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
      const nextBlock = current[h1Index + 1];
      const videoReady = Boolean(nextBlock.embedSaved && nextBlock.embedSrc);
      if (!videoReady) {
        if (!skipFocus) {
          onFocusBlock?.(nextBlock.id);
          requestAnimationFrame(() => {
            document.getElementById(`video-embed-${nextBlock.id}`)?.focus();
          });
        }
        requestContentGrow();
        return nextBlock.id;
      }
      return insertTextAfter(h1Index + 1, initialText, current, options);
    }

    let targetIndex = linkedOwnerIndex >= 0
      ? getWritableTextIndexBelowLinkedOwner(current, linkedOwnerIndex)
      : index + 1;

    if (linkedOwnerIndex >= 0) {
      const ensured = ensureContinuationAfterLinkedOwner(current, linkedOwnerIndex);
      if (ensured !== current) {
        current = ensured;
        setBlocks(ensured);
      }
      targetIndex = getWritableTextIndexBelowLinkedOwner(current, linkedOwnerIndex);
    }

    const nextBlock = current[targetIndex];

    if (isEmptyTextBlock(nextBlock)) {
      if (initialText) {
        const next = updateBlockAt(current, targetIndex, { text: initialText });
        setBlocks(next);
        if (h1Index >= 0 && linkedOwnerIndex < 0) {
          onAnswerBelowH1Change?.(h1Index, initialText);
        }
      } else if (current !== blocksRef.current) {
        setBlocks(current);
      }
      if (!skipFocus && nextBlock?.id) {
        focusBlockCaret(nextBlock.id, initialText ? initialText.length : 0);
      }
      requestContentGrow();
      return nextBlock?.id ?? null;
    }

    const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: initialText });
    const next = insertBlockAfter(current, targetIndex, textBlock);
    setBlocks(next);
    if (h1Index >= 0 && initialText && linkedOwnerIndex < 0) {
      onAnswerBelowH1Change?.(h1Index, initialText);
    }
    if (!skipFocus) {
      onFocusBlock?.(textBlock.id);
      focusBlockCaret(textBlock.id, initialText.length);
    }
    requestContentGrow();
    return textBlock.id;
  };

  const insertNewlineAtCaret = (blockIndex, e, field = "text") => {
    e.preventDefault();
    const el = e.currentTarget;
    const caretStart = el.selectionStart ?? 0;
    const caretEnd = el.selectionEnd ?? caretStart;
    const text = el.value ?? "";
    const nextText = `${text.slice(0, caretStart)}\n${text.slice(caretEnd)}`;
    const blockId = blocksRef.current[blockIndex]?.id;
    if (!blockId) return;

    const next = updateBlockAt(blocksRef.current, blockIndex, { [field]: nextText });
    setBlocks(next);
    if (field === "text") {
      syncAnswerBelowH1(next, blockIndex, nextText);
    }
    focusBlockCaret(blockId, caretStart + 1);
    scrollCaretAfterNewline(blockId);
  };

  const isCaretOnEmptyH1Line = (title, caret) => {
    const lineStart = title.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
    const nextBreak = title.indexOf("\n", caret);
    const lineEnd = nextBreak === -1 ? title.length : nextBreak;
    return !title.slice(lineStart, lineEnd).trim();
  };

  const shouldExitH1ToBodyOnEnter = (title, caretStart, caretEnd) => {
    if (caretStart !== caretEnd) return false;
    if (caretEnd >= title.length) return true;
    return isCaretOnEmptyH1Line(title, caretStart);
  };

  const exitH1ToBodyBelow = (h1Index, rawTitle) => {
    const cleanedTitle = rawTitle.replace(/\n+$/, "").trimEnd();
    const current = updateBlockAt(blocksRef.current, h1Index, { title: cleanedTitle });
    insertTextAfter(h1Index, "", current);
  };

  const handleH1EnterKey = (index, block, e) => {
    const fieldValue = e.currentTarget?.value ?? "";
    const rawTitle = fieldValue || block.title || "";

    if (!rawTitle.trim()) {
      removeEmptyH1AndFocusBody(index);
      return;
    }

    const caretStart = e.currentTarget.selectionStart ?? 0;
    const caretEnd = e.currentTarget.selectionEnd ?? caretStart;

    if (shouldExitH1ToBodyOnEnter(rawTitle, caretStart, caretEnd)) {
      exitH1ToBodyBelow(index, rawTitle);
      return;
    }

    insertNewlineAtCaret(index, e, "title");
  };

  const focusTodoItem = (blockId, itemId) => {
    if (!blockId || !itemId) return;
    setTodoFocusItemId(itemId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      const input = el?.querySelector(`[data-todo-item-id="${itemId}"]`);
      input?.focus();
    });
  };

  const appendTodoItem = (blockIndex) => {
    const block = blocksRef.current[blockIndex];
    if (!block || block.type !== DOC_BLOCK_TYPES.TODO) return;
    const newItem = createTodoItem({ text: "" });
    updateAt(blockIndex, { items: [...(block.items || []), newItem] });
    focusTodoItem(block.id, newItem.id);
  };

  const handleDragPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const canInsertSlashBlock = (parsed) => {
    if (
      parsed?.type === DOC_BLOCK_TYPES.PRODUCT_CARD
      && hasProductCardBlock(blocksRef.current)
    ) {
      return false;
    }
    return true;
  };

  const tryConfirmSlashInText = (blockIndex, textValue) => {
    const { slash } = splitBodyForSlash(textValue);
    if (!slash) return false;
    const parsed = parseScopedSlash(slash.slice(1));
    if (!parsed || !canInsertSlashBlock(parsed)) return false;

    return insertSlashFromText(blockIndex, textValue, parsed);
  };

  const tryConfirmSlashInLinkable = (blockIndex, fieldValue) => {
    const { slash } = splitBodyForSlash(fieldValue);
    if (!slash) return false;
    const parsed = parseScopedSlash(slash.slice(1));
    if (!parsed || !canInsertSlashBlock(parsed)) return false;

    const newBlock = createDocBlockFromSlash(parsed);
    const next = replaceBlockFromSlashInLinkable(
      blocksRef.current,
      blockIndex,
      fieldValue,
      newBlock,
    );
    if (
      parsed.type === DOC_BLOCK_TYPES.IMAGE
      || parsed.type === DOC_BLOCK_TYPES.IMAGE_SPLIT
      || parsed.type === DOC_BLOCK_TYPES.MOODBOARD
      || parsed.type === DOC_BLOCK_TYPES.BANNER
      || parsed.type === DOC_BLOCK_TYPES.CODE
      || parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
      || parsed.type === DOC_BLOCK_TYPES.LINK_VAULT
      || parsed.type === DOC_BLOCK_TYPES.AGENT
    ) {
      const newIndex = next.findIndex((b) => b.id === newBlock.id);
      const withTail = newIndex >= 0
        ? ensureEmptyTextBlockAfter(next, newIndex)
        : next;
      setBlocks(withTail);
      onFocusBlock?.(newBlock.id);
      requestContentGrow();
      return newBlock.id;
    }
    finalizeSlashInsert(next, newBlock.id);
    return newBlock.id;
  };

  const tryConfirmSlashInImageSplitBody = (blockIndex, bodyValue) => {
    const { slash } = splitBodyForSlash(bodyValue);
    if (!slash) return false;
    const parsed = parseSlashQueryFromCommands(
      slash.slice(1),
      IMAGE_CARD_BODY_SLASH_COMMANDS,
    );
    if (!parsed || parsed.type !== DOC_BLOCK_TYPES.TODO) return false;

    const block = blocksRef.current[blockIndex];
    const patch = applyTodoSlashToImageSplit(block, bodyValue);
    if (!patch) return false;

    const next = updateBlockAt(blocksRef.current, blockIndex, patch);
    setBlocks(next);
    const focusId = patch.todoItems?.[0]?.id ?? null;
    setTodoFocusItemId(focusId);
    onFocusBlock?.(block?.id);
    requestContentGrow();
    return block?.id || true;
  };

  const tryConfirmSlashInMoodboardBody = (blockIndex, bodyValue) => {
    const { slash } = splitBodyForSlash(bodyValue);
    if (!slash) return false;
    const parsed = parseScopedSlash(slash.slice(1));
    if (!parsed || !canInsertSlashBlock(parsed)) return false;

    const newBlock = createDocBlockFromSlash(parsed);
    let next = replaceBlocksFromSlashInMoodboardBody(
      blocksRef.current,
      blockIndex,
      bodyValue,
      newBlock,
    );
    if (
      parsed.type === DOC_BLOCK_TYPES.IMAGE
      || parsed.type === DOC_BLOCK_TYPES.IMAGE_SPLIT
      || parsed.type === DOC_BLOCK_TYPES.MOODBOARD
      || parsed.type === DOC_BLOCK_TYPES.BANNER
      || parsed.type === DOC_BLOCK_TYPES.CODE
      || parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
      || parsed.type === DOC_BLOCK_TYPES.LINK_VAULT
      || parsed.type === DOC_BLOCK_TYPES.AGENT
    ) {
      const newIndex = next.findIndex((b) => b.id === newBlock.id);
      if (newIndex >= 0) next = ensureEmptyTextBlockAfter(next, newIndex);
      setBlocks(next);
      onFocusBlock?.(newBlock.id);
      requestContentGrow();
      return newBlock.id;
    }
    finalizeSlashInsert(next, newBlock.id);
    return newBlock.id;
  };

  const handleTextBackspace = (blockIndex, e, textValue) => {
    if (e.key !== "Backspace" || !isAtInputStart(e)) return false;

    const currentBlocks = blocksRef.current;
    const block = currentBlocks[blockIndex];
    if (block?.type !== DOC_BLOCK_TYPES.TEXT) return false;

    const text = textValue ?? "";
    const isEmpty = text.length === 0;

    if (!isEmpty && blockIndex > 0) {
      const prev = currentBlocks[blockIndex - 1];
      if (prev?.type === DOC_BLOCK_TYPES.TEXT) {
        e.preventDefault();
        const joinAt = (prev.text || "").length;
        const merged = (prev.text || "") + text;
        let next = updateBlockAt(currentBlocks, blockIndex - 1, { text: merged });
        next = removeBlockAt(next, blockIndex);
        const h1Index = getH1IndexForTextBlock(currentBlocks, blockIndex);
        if (h1Index >= 0) onAnswerBelowH1Change?.(h1Index, merged);
        setBlocks(next);
        focusBlockCaret(prev.id, joinAt);
        return true;
      }

      e.preventDefault();
      focusBlockCaret(currentBlocks[blockIndex - 1].id);
      return true;
    }

    if (isEmpty && currentBlocks.length > 1) {
      const ownerIndex = getOwningScheduleBlockIndexForText(currentBlocks, blockIndex);
      const ownerBlock = ownerIndex >= 0 ? currentBlocks[ownerIndex] : null;
      if (
        ownerBlock
        && collapsedPadWriteByOwnerId[ownerBlock.id]?.blockId === block.id
      ) {
        clearCollapsedPadWrite(ownerBlock.id);
      }
      e.preventDefault();
      const prevId = blockIndex > 0 ? currentBlocks[blockIndex - 1]?.id : null;
      const h1Index = getH1IndexForTextBlock(currentBlocks, blockIndex);
      if (h1Index >= 0) onAnswerBelowH1Change?.(h1Index, "");
      setBlocks(removeBlockAt(currentBlocks, blockIndex));
      if (prevId) focusBlockCaret(prevId);
      return true;
    }

    return false;
  };

  const handleTextKeyDown = (blockIndex, e) => {
    if (tryDocSelectAllKeyDown(e, blocksRef.current)) return;

    const textValue = e.currentTarget?.value ?? blocksRef.current[blockIndex]?.text ?? "";
    if (handleTextBackspace(blockIndex, e, textValue)) return;

    const { slash } = splitBodyForSlash(textValue);

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      insertNewlineAtCaret(blockIndex, e);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      if (slash) {
        const newId = tryConfirmSlashInText(blockIndex, textValue);
        if (newId) {
          e.preventDefault();
          requestContentGrow();
          return;
        }
      }
      insertNewlineAtCaret(blockIndex, e);
      return;
    }

    if (e.key === "Escape" && slash) {
      const { prefix } = splitBodyForSlash(textValue);
      e.preventDefault();
      updateAt(blockIndex, { text: prefix });
      return;
    }

    onBodyKeyDown?.(e);
  };

  const removeEmptyH1AndFocusBody = (h1Index) => {
    const current = blocksRef.current;
    const h1 = current[h1Index];
    if (!h1 || h1.type !== DOC_BLOCK_TYPES.H1) return;

    if (h1.nodeId || h1HasVideoEmbedSibling(current, h1Index)) {
      insertTextAfter(h1Index, "", current);
      return;
    }

    const nextBlock = current[h1Index + 1];
    let next = removeBlockAt(current, h1Index);
    if (!next.length) {
      next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
    } else if (!isEmptyTextBlock(nextBlock) && nextBlock?.type !== DOC_BLOCK_TYPES.TEXT) {
      next = ensureEmptyTextBlockAfter(next, Math.max(0, h1Index - 1));
    }

    setBlocks(next);
    const focusIndex = Math.min(h1Index, next.length - 1);
    const focusId = next[focusIndex]?.id;
    if (focusId) focusBlockCaret(focusId, 0);
    requestContentGrow();
  };

  const handleLinkableBlockKeyDown = (index, block, e) => {
    if (block.type === DOC_BLOCK_TYPES.H1 && tryDocSelectAllKeyDown(e, blocksRef.current)) return;

    const fieldValue = e.currentTarget?.value ?? "";

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const { slash } = splitBodyForSlash(fieldValue);
      if (slash) {
        const parsed = parseScopedSlash(slash.slice(1));
        if (parsed && canInsertSlashBlock(parsed)) {
          tryConfirmSlashInLinkable(index, fieldValue);
          return;
        }
      }

      if (block.type === DOC_BLOCK_TYPES.TODO) {
        const items = block.items || [];
        if (items.length === 0) {
          appendTodoItem(index);
        } else {
          focusTodoItem(block.id, items[0].id);
        }
        return;
      }

      if (block.type === DOC_BLOCK_TYPES.H1) {
        const nextBlock = blocksRef.current[index + 1];
        if (nextBlock?.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
          const videoReady = Boolean(nextBlock.embedSaved && nextBlock.embedSrc);
          if (!videoReady) {
            onFocusBlock?.(nextBlock.id);
            requestAnimationFrame(() => {
              document.getElementById(`video-embed-${nextBlock.id}`)?.focus();
            });
            return;
          }

          const title = fieldValue || block.title || "";
          if (!title.trim()) {
            removeEmptyH1AndFocusBody(index);
            return;
          }
          handleH1EnterKey(index, block, e);
          return;
        }

        handleH1EnterKey(index, block, e);
        return;
      }

      if (block.type === DOC_BLOCK_TYPES.H2 || block.type === DOC_BLOCK_TYPES.H3) {
        handleH1EnterKey(index, block, e);
        return;
      }

      if (e.currentTarget.tagName === "TEXTAREA") {
        insertNewlineAtCaret(index, e, "title");
        return;
      }

      insertTextAfter(index);
      return;
    }

    if (e.key === "Escape") {
      const { slash } = splitBodyForSlash(fieldValue);
      if (slash) {
        const { prefix } = splitBodyForSlash(fieldValue);
        e.preventDefault();
        if (block.type === DOC_BLOCK_TYPES.TODO) {
          updateAt(index, { listTitle: prefix });
        } else {
          updateAt(index, { title: prefix });
        }
        return;
      }
    }

    const atStart = isAtInputStart(e);
    const titleEmpty =
      block.type === DOC_BLOCK_TYPES.TODO
        ? !block.listTitle
        : !block.title;

    if (e.key === "Backspace" && atStart && !titleEmpty && index > 0) {
      e.preventDefault();
      focusBlockCaret(blocksRef.current[index - 1]?.id);
      return;
    }

    if ((e.key === "Backspace" || e.key === "Delete") && titleEmpty && atStart) {
      e.preventDefault();
      const current = blocksRef.current;
      const prevId = index > 0 ? current[index - 1]?.id : null;
      const nextBlock = current[index + 1];
      // Linked title: remove layers from folder but keep document in left panel.
      if (block.nodeId) {
        if (onDetachFromNode) {
          onDetachFromNode(index);
          if (prevId) focusBlockCaret(prevId);
          return;
        }
        const nodeId = block.nodeId;
        const folderId = getNode(nodeId)?.parentDocId || null;
        const { blocks: next } = removeLinkedOwnerBundleFromBlocks(current, nodeId);
        const nextBlocks = next.length
          ? next
          : [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
        setBlocks(nextBlocks);
        if (folderId) {
          updateDoc(folderId, { blocks: nextBlocks });
          updateNode(nodeId, {
            sourceBlockId: undefined,
            sourceTextBlockId: undefined,
            parentDocId: folderId,
            linkedToDoc: true,
          });
          addNodeToDoc(folderId, nodeId);
        } else {
          updateNode(nodeId, {
            sourceBlockId: undefined,
            sourceTextBlockId: undefined,
          });
        }
        if (prevId) focusBlockCaret(prevId);
        return;
      }
      let next;
      if (block.type === DOC_BLOCK_TYPES.H1 && nextBlock?.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
        next = removeEmbedVideoPairAt(current, index);
      } else {
        next = removeBlockAt(current, index);
      }
      if (next.length === 0) {
        setBlocks([createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })]);
        return;
      }
      setBlocks(next);
      if (prevId) focusBlockCaret(prevId);
      return;
    }

    onBodyKeyDown?.(e);
  };

  const handleTodoItemKeyDown = (index, itemIndex, e) => {
    const block = blocksRef.current[index];
    if (!block || block.type !== DOC_BLOCK_TYPES.TODO) return;

    const items = block.items || [];
    const item = items[itemIndex];
    if (!item) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newItem = createTodoItem({ text: "" });
      const nextItems = [
        ...items.slice(0, itemIndex + 1),
        newItem,
        ...items.slice(itemIndex + 1),
      ];
      updateAt(index, { items: nextItems });
      focusTodoItem(block.id, newItem.id);
      return;
    }

    const atStart = isAtInputStart(e);
    if (e.key === "Backspace" && atStart && item.text) {
      e.preventDefault();
      focusBlockCaret(block.id);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${block.id}"]`);
        const titleInput = el?.querySelector(".doc-todo-plan__title-input");
        if (titleInput && "setSelectionRange" in titleInput) {
          titleInput.focus();
          titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
        }
      });
      return;
    }

    if ((e.key === "Backspace" || e.key === "Delete") && !item.text && atStart) {
      e.preventDefault();
      if (items.length > 1) {
        const nextItems = items.filter((_, i) => i !== itemIndex);
        updateAt(index, { items: nextItems });
        const focusTarget = nextItems[Math.min(itemIndex, nextItems.length - 1)];
        setTodoFocusItemId(focusTarget?.id || null);
      } else {
        setBlocks(removeBlockAt(blocksRef.current, index));
        setTodoFocusItemId(null);
      }
      return;
    }

    onBodyKeyDown?.(e);
  };

  const handleTextPaste = (blockIndex, e) => {
    const pasted = e.clipboardData?.getData("text/plain") ?? "";
    if (!/\n\n/.test(pasted)) return;

    const el = e.currentTarget;
    if (!el || !("selectionStart" in el)) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const current = el.value ?? "";
    // Only intercept when pasting into an otherwise-empty focused block —
    // never wipe neighboring prose blocks in the same unit.
    if (current.slice(0, start).trim() || current.slice(end).trim()) return;

    const parts = pasted.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length <= 1) return;

    e.preventDefault();

    const blocks = blocksRef.current;
    if (blockIndex < 0 || blockIndex >= blocks.length) return;

    const segment = {
      kind: "prose",
      start: blockIndex,
      end: blockIndex,
      blockIds: [blocks[blockIndex].id],
    };
    const next = replaceProseSegmentInBlocks(blocks, segment, pasted.trim());
    setBlocks(next);
    const focusId = next[blockIndex]?.id;
    if (focusId) {
      onFocusBlock?.(focusId);
      requestAnimationFrame(() => focusBlockCaret(focusId));
    }
    requestContentGrow();
  };

  useImperativeHandle(ref, () => ({
    insertSlashCommand: insertSlashCommandAtFocus,
    resyncTextHeights: resyncAllTextHeights,
  }));

  return (
    <div className="doc-block-stack" ref={stackRef}>
      {blocks.map((block, index) => {
        const itemHidden =
          block.type === DOC_BLOCK_TYPES.TEXT
          && (isTextHiddenByParentCollapse(index)
            || isTextHiddenByLinkedMacroNode(blocks, index));
        const ownerIndexForBlock =
          block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO
            ? index
            : -1;
        const padWrite = collapsedPadWriteByOwnerId[block.id] ?? null;
        const collapsedActiveWriteId = padWrite?.blockId ?? null;
        const showCollapsedWritePad =
          (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO)
          && showScheduleForBlock(block)
          && !isContentExpanded(block.id)
          && Boolean(collapsedActiveWriteId);
        const collapsedWriteIndex = collapsedActiveWriteId
          ? resolveBlockIndexById(collapsedActiveWriteId)
          : -1;
        const collapsedWriteBlock = collapsedActiveWriteId
          ? resolveBlockById(collapsedActiveWriteId)
          : null;

        if (block.type === DOC_BLOCK_TYPES.TEXT && isLinkedOwnerContinuationSlot(blocks, index)) {
          if (getLinkedOwnerForContinuationSlot(blocks, index) < 0) {
            return null;
          }
        }

        if (block.type === DOC_BLOCK_TYPES.TEXT && isTextHiddenByLinkedMacroNode(blocks, index)) {
          return null;
        }

        return (
        <Fragment key={block.id}>
        <div
          className={
            "doc-block-stack__item"
            + (itemHidden ? " doc-block-stack__item--content-collapsed" : "")
          }
          data-block-id={block.id}
          hidden={itemHidden}
        >
          {block.type === DOC_BLOCK_TYPES.H1 ? (
            <>
              <H1BlockView
                value={block.title || ""}
                placeholder={
                  h1HasVideoEmbedSibling(blocksRef.current, index)
                    ? "Create video title"
                    : block.macronodeHeading
                      ? "Create a title"
                      : "Heading 1"
                }
                onChange={(title) => {
                  updateAt(index, { title, sourceQuery: title });
                  syncLinkedBlockTitleToNode(block, title);
                  if (h1HasVideoEmbedSibling(blocksRef.current, index)) {
                    onVideoEmbedH1TitleChange?.(index);
                  }
                }}
                queryEnabled={Boolean(block.queryEnabled)}
                nodeLinkColor={blockLinkColor(block)}
                linksEnabled={
                  Boolean(block.macronodeHeading)
                  && blockLinksEnabled(block)
                  && !block.hideColorLink
                }
                ghostHints={slashGhostHints}
                onFocus={() => {
                  if (collapsedPadWriteByOwnerId[block.id]) return;
                  onFocusBlock?.(block.id);
                }}
                onQueryHandleClick={() => handleQueryHandleClick(index)}
                onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
              />
              {isDocBlockLinkedToNode(block) ? (
                <LinkedMacronodeDescription
                  nodeId={block.nodeId}
                  onContinue={() => handleQueryHandleClick(index)}
                />
              ) : null}
            </>
          ) : null}

          {block.type === DOC_BLOCK_TYPES.H2 ? (
            <H2BlockView
              value={block.title || ""}
              placeholder="Heading 2"
              linksEnabled={false}
              ghostHints={slashGhostHints}
              onChange={(title) => updateAt(index, { title })}
              onFocus={() => {
                if (collapsedPadWriteByOwnerId[block.id]) return;
                onFocusBlock?.(block.id);
              }}
              onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.H3 ? (
            <H3BlockView
              value={block.title || ""}
              placeholder="Heading 3"
              linksEnabled={false}
              ghostHints={slashGhostHints}
              onChange={(title) => updateAt(index, { title })}
              onFocus={() => {
                if (collapsedPadWriteByOwnerId[block.id]) return;
                onFocusBlock?.(block.id);
              }}
              onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.DATE ? (
            <DateBlockView
              title={block.title || ""}
              date={block.date || ""}
              time={block.time || ""}
              onTitleChange={(title) => {
                updateAt(index, { title, sourceQuery: title });
                syncLinkedBlockTitleToNode(block, title);
              }}
              onDateChange={(date) => updateAt(index, { date })}
              onTimeChange={(time) => updateAt(index, { time })}
              onQueryHandleClick={() => openNode?.(index, block)}
              onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.METRIC ? (
            <MetricBlockView
              title={block.title || ""}
              value={block.value != null ? String(block.value) : ""}
              unit={block.unit || ""}
              onTitleChange={(title) => {
                updateAt(index, { title, sourceQuery: title });
                syncLinkedBlockTitleToNode(block, title);
              }}
              onValueChange={(value) => updateAt(index, { value })}
              onUnitChange={(unit) => updateAt(index, { unit })}
              onQueryHandleClick={() => openNode?.(index, block)}
              onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.PRODUCT_CARD ? (
            <ProductCardBlockView
              block={block}
              onChange={(patch) => updateAt(index, patch)}
              onInsertToCanvas={onInsertProductToCanvas}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.productCard");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.VIDEO_EMBED ? (
            <VideoEmbedBlockView
              block={block}
              onChange={(patch) => {
                let next = updateBlockAt(blocksRef.current, index, patch);
                if (patch.embedSaved && patch.embedSrc) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                onVideoEmbedSync?.(index, patch, next);
                if (patch.embedSaved && patch.embedSrc) {
                  const textBlock = next[index + 1];
                  if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
                    onFocusBlock?.(textBlock.id);
                    focusBlockCaret(textBlock.id, 0);
                  }
                  requestContentGrow();
                }
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.video");
                if (!ok) return;
                removeEmbedVideoSection(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.IMAGE ? (
            <ImageBlockView
              block={block}
              onChange={(patch) => {
                let next = updateBlockAt(blocksRef.current, index, patch);
                if (patch.imageSaved && patch.src) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                if (patch.imageSaved && patch.src) {
                  const textBlock = next[index + 1];
                  if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
                    onFocusBlock?.(textBlock.id);
                    focusBlockCaret(textBlock.id, 0);
                  }
                  requestContentGrow();
                }
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.image");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.IMAGE_SPLIT ? (
            <ImageSplitBlockView
              block={block}
              autoFocusBody={focusBlockId === block.id && Boolean(block.imageSaved) && !block.splitSaved}
              focusTodoItemId={
                focusBlockId === block.id && block.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
                  ? todoFocusItemId
                  : null
              }
              bodySlashGhostHints={IMAGE_CARD_BODY_SLASH_GHOST_HINTS}
              onChange={(patch) => {
                let next = updateBlockAt(blocksRef.current, index, patch);
                if (patch.imageSaved && patch.src) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                if (patch.imageSaved && patch.src) {
                  requestContentGrow();
                }
              }}
              onSave={() => {
                if (!(block.imageSaved && block.src)) return;
                let next = updateBlockAt(blocksRef.current, index, { splitSaved: true });
                next = ensureEmptyTextBlockAfter(next, index);
                setBlocks(next);
                const textBlock = next[index + 1];
                if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
                  onFocusBlock?.(textBlock.id);
                  focusBlockCaret(textBlock.id, 0);
                }
                requestContentGrow();
              }}
              onEdit={() => {
                updateAt(index, { splitSaved: false });
                onFocusBlock?.(block.id);
              }}
              onConvertLayout={(targetType) => {
                const converted = convertImageLayoutBlock(block, targetType);
                if (!converted) return;
                const next = normalizeDocBlocks(
                  blocksRef.current.map((entry, i) => (i === index ? converted : entry)),
                );
                setBlocks(next);
                onFocusBlock?.(converted.id);
                requestContentGrow();
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.imageSplit");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
              onBodyKeyDown={(e) => {
                if (tryDocSelectAllKeyDown(e, blocksRef.current)) return;
                const bodyValue = e.currentTarget?.value ?? block.body ?? "";
                const { slash } = splitBodyForSlash(bodyValue);

                if (e.key === "Enter" && !e.shiftKey && slash) {
                  const newId = tryConfirmSlashInImageSplitBody(index, bodyValue);
                  if (newId) {
                    e.preventDefault();
                    requestContentGrow();
                  }
                  return;
                }

                if (e.key === "Escape" && slash) {
                  const { prefix } = splitBodyForSlash(bodyValue);
                  e.preventDefault();
                  updateAt(index, { body: prefix });
                  return;
                }

                onBodyKeyDown?.(e);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.MOODBOARD ? (
            <MoodboardBlockView
              block={block}
              autoFocusBody={
                focusBlockId === block.id
                && Boolean(block.a?.imageSaved && block.b?.imageSaved)
                && !block.moodboardSaved
              }
              onChange={(patch) => {
                let next = updateBlockAt(blocksRef.current, index, patch);
                if (patch.a?.imageSaved || patch.b?.imageSaved) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                if (patch.a?.imageSaved || patch.b?.imageSaved) {
                  requestContentGrow();
                }
              }}
              onSave={() => {
                if (!(block.a?.imageSaved && block.b?.imageSaved)) return;
                let next = updateBlockAt(blocksRef.current, index, { moodboardSaved: true });
                next = ensureEmptyTextBlockAfter(next, index);
                setBlocks(next);
                const textBlock = next[index + 1];
                if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
                  onFocusBlock?.(textBlock.id);
                  focusBlockCaret(textBlock.id, 0);
                }
                requestContentGrow();
              }}
              onEdit={() => {
                updateAt(index, { moodboardSaved: false });
                onFocusBlock?.(block.id);
              }}
              onConvertLayout={(targetType) => {
                const converted = convertImageLayoutBlock(block, targetType);
                if (!converted) return;
                const next = normalizeDocBlocks(
                  blocksRef.current.map((entry, i) => (i === index ? converted : entry)),
                );
                setBlocks(next);
                onFocusBlock?.(converted.id);
                requestContentGrow();
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.moodboard");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
              onBodyKeyDown={(e) => {
                if (tryDocSelectAllKeyDown(e, blocksRef.current)) return;
                const bodyValue = e.currentTarget?.value ?? block.body ?? "";
                const { slash } = splitBodyForSlash(bodyValue);

                if (e.key === "Enter" && !e.shiftKey && slash) {
                  const newId = tryConfirmSlashInMoodboardBody(index, bodyValue);
                  if (newId) {
                    e.preventDefault();
                    requestContentGrow();
                  }
                  return;
                }

                if (e.key === "Escape" && slash) {
                  const { prefix } = splitBodyForSlash(bodyValue);
                  e.preventDefault();
                  updateAt(index, { body: prefix });
                  return;
                }

                onBodyKeyDown?.(e);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.BANNER ? (
            <BannerBlockView
              block={block}
              onChange={(patch) => {
                let next = updateBlockAt(blocksRef.current, index, patch);
                if (patch.imageSaved && patch.src) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                if (patch.imageSaved && patch.src) {
                  requestContentGrow();
                }
              }}
              onSave={() => {
                if (!(block.imageSaved && block.src)) return;
                let next = updateBlockAt(blocksRef.current, index, { bannerSaved: true });
                next = ensureEmptyTextBlockAfter(next, index);
                setBlocks(next);
                const textBlock = next[index + 1];
                if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
                  onFocusBlock?.(textBlock.id);
                  focusBlockCaret(textBlock.id, 0);
                }
                requestContentGrow();
              }}
              onEdit={() => {
                updateAt(index, { bannerSaved: false });
                onFocusBlock?.(block.id);
              }}
              onConvertLayout={(targetType) => {
                const converted = convertImageLayoutBlock(block, targetType);
                if (!converted) return;
                const next = normalizeDocBlocks(
                  blocksRef.current.map((entry, i) => (i === index ? converted : entry)),
                );
                setBlocks(next);
                onFocusBlock?.(converted.id);
                requestContentGrow();
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.banner");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.CODE ? (
            <CodeBlockView
              language={block.language}
              code={block.code || ""}
              codeSaved={Boolean(block.codeSaved)}
              autoFocus={focusBlockId === block.id && !block.codeSaved}
              onLanguageChange={(language) => updateAt(index, { language, codeSaved: false })}
              onCodeChange={(code) => updateAt(index, { code, codeSaved: false })}
              onSave={() => {
                if (!(block.code || "").trim()) return;
                let next = updateBlockAt(blocksRef.current, index, { codeSaved: true });
                next = ensureEmptyTextBlockAfter(next, index);
                setBlocks(next);
                const textBlock = next[index + 1];
                if (textBlock?.type === DOC_BLOCK_TYPES.TEXT) {
                  onFocusBlock?.(textBlock.id);
                  focusBlockCaret(textBlock.id, 0);
                }
                requestContentGrow();
              }}
              onEdit={() => {
                updateAt(index, { codeSaved: false });
                onFocusBlock?.(block.id);
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.code");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.PASSWORD_VAULT ? (
            <PasswordVaultBlockView
              slashStack
              entries={companyObjectId ? [] : (block.entries || [])}
              openAddForm={focusBlockId === block.id}
              onSaveEntry={companyObjectId ? (entry) => {
                queuePasswordTableEntry(companyObjectId, entry);
                let next = removeBlockAt(blocksRef.current, index);
                if (!next.length) {
                  next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
                }
                setBlocks(next);
                const focusIndex = Math.min(index, next.length - 1);
                onFocusBlock?.(next[focusIndex]?.id);
                requestContentGrow();
              } : null}
              onEntriesChange={companyObjectId ? undefined : (entries) => {
                let next = updateBlockAt(blocksRef.current, index, { entries });
                if (entries.length > 0) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                requestContentGrow();
              }}
              onDeleteVault={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.password");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.LINK_VAULT ? (
            <LinkVaultBlockView
              multilineDescription
              slashStack
              entries={companyObjectId ? [] : (block.entries || [])}
              openAddForm={focusBlockId === block.id}
              onSaveEntry={companyObjectId ? (entry) => {
                queueUrlTableEntry(companyObjectId, entry);
                let next = removeBlockAt(blocksRef.current, index);
                if (!next.length) {
                  next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
                }
                setBlocks(next);
                const focusIndex = Math.min(index, next.length - 1);
                onFocusBlock?.(next[focusIndex]?.id);
                requestContentGrow();
              } : null}
              onEntriesChange={companyObjectId ? undefined : (entries) => {
                let next = updateBlockAt(blocksRef.current, index, { entries });
                if (entries.length > 0) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                requestContentGrow();
              }}
              onDeleteVault={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.link");
                if (!ok) return;
                removeCommandBlockAt(index);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.AGENT ? (
            <AgentBlockView
              instruction={block.instruction || ""}
              autoFocus={focusBlockId === block.id}
              onInstructionChange={(instruction) => {
                const next = updateBlockAt(blocksRef.current, index, { instruction });
                setBlocks(next);
                requestContentGrow();
              }}
              onDelete={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.agent");
                if (!ok) return;
                removeCommandBlockAt(index, { grow: true });
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.STEP_SEQUENCE ? (
            <StepSequenceBlockView
              blockId={block.id}
              title={block.title || ""}
              steps={block.steps || []}
              saved={Boolean(block.saved)}
              autoFocus={focusBlockId === block.id}
              onTitleChange={(nextTitle) => {
                const next = updateBlockAt(blocksRef.current, index, { title: nextTitle });
                setBlocks(next);
                requestContentGrow();
              }}
              onStepsChange={(steps) => {
                let next = updateBlockAt(blocksRef.current, index, { steps });
                const current = blocksRef.current[index];
                const hasContent = (current?.title || "").trim()
                  || steps.some(stepEntryHasContent);
                if (hasContent) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                requestContentGrow();
              }}
              onSavedChange={(finalizedSteps) => {
                let next = updateBlockAt(blocksRef.current, index, {
                  steps: finalizedSteps,
                  saved: true,
                });
                const current = blocksRef.current[index];
                const hasContent = (current?.title || "").trim()
                  || finalizedSteps.some(stepEntryHasContent);
                if (hasContent) {
                  next = ensureEmptyTextBlockAfter(next, index);
                }
                setBlocks(next);
                requestContentGrow();
              }}
              onEditRequest={() => {
                const next = updateBlockAt(blocksRef.current, index, { saved: false });
                setBlocks(next);
                requestContentGrow();
                onFocusBlock?.(block.id);
              }}
              onDeleteBlock={async () => {
                const ok = await confirmDeleteCommandBlock("doc.blockDelete.stepSequence");
                if (!ok) return;
                const removedBlock = blocksRef.current[index];
                const wasSavedPlaybook = Boolean(
                  removedBlock?.type === DOC_BLOCK_TYPES.STEP_SEQUENCE && removedBlock?.saved,
                );
                const removedBlockId = removedBlock?.id;
                let next = removeBlockAt(blocksRef.current, index);
                if (!next.length) {
                  next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
                }
                setBlocks(next);
                if (wasSavedPlaybook && removedBlockId) {
                  onSavedStepSequenceRemoved?.({ blockId: removedBlockId, nextBlocks: next });
                }
                const focusIndex = Math.min(index, next.length - 1);
                onFocusBlock?.(next[focusIndex]?.id);
                requestContentGrow();
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.TODO ? (
            <>
              <DocTodoPlanBlockView
                listTitle={block.listTitle ?? "Todo list:"}
                onListTitleChange={(listTitle) => {
                  updateAt(index, { listTitle, sourceQuery: listTitle });
                  syncLinkedBlockTitleToNode(block, listTitle);
                }}
                queryEnabled={Boolean(block.queryEnabled)}
                nodeLinkColor={blockLinkColor(block)}
                linksEnabled={blockLinksEnabled(block) && !block.hideColorLink}
                onFocus={() => {
                  if (collapsedPadWriteByOwnerId[block.id]) return;
                  onFocusBlock?.(block.id);
                }}
                items={block.items || []}
                focusItemId={todoFocusItemId}
                onItemsChange={(items) => updateAt(index, { items })}
                onItemKeyDown={(itemIndex, e) => handleTodoItemKeyDown(index, itemIndex, e)}
                onAddItem={() => {
                  const newItem = createTodoItem({ text: "" });
                  updateAt(index, { items: [...(block.items || []), newItem] });
                  setTodoFocusItemId(newItem.id);
                }}
                onDragHandlePointerDown={handleDragPointerDown}
                onQueryHandleClick={() => handleQueryHandleClick(index)}
                onListTitleKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
                onDetachFromNode={
                  isDocBlockLinkedToNode(block) && onDetachFromNode
                    ? () => onDetachFromNode(index)
                    : null
                }
              />
              {isDocBlockLinkedToNode(block) ? (
                <LinkedMacronodeDescription
                  nodeId={block.nodeId}
                  onContinue={() => handleQueryHandleClick(index)}
                />
              ) : null}
            </>
          ) : null}

          {block.type === DOC_BLOCK_TYPES.TEXT && !isCollapsedPadWriteBlock(block.id) ? (
            (() => {
              const linkedOwnerIndex = getLinkedOwnerIndexForTextBlock(blocks, index);
              const continuationOwnerIndex = getLinkedOwnerForContinuationSlot(blocks, index);
              const isLinkedContinuation = continuationOwnerIndex >= 0;
              const continuationIndex = linkedOwnerIndex >= 0
                ? getLinkedContinuationTextIndex(blocks, linkedOwnerIndex)
                : -1;
              const continuationBlock = continuationIndex >= 0
                ? blocks[continuationIndex]
                : null;
              const isPrimaryReportBlock = isAnalystReport
                && index === blocks.findIndex((b) => b.type === DOC_BLOCK_TYPES.TEXT);

              if (isLinkedContinuation) {
                return (
                  <TextBlockView
                    ghostHints={slashGhostHints}
                    value={block.text || ""}
                    placeholder={bodyPlaceholder}
                    showPlaceholder={false}
                    autoFocus={focusBlockId === block.id && !itemHidden}
                    onFocus={() => onFocusBlock?.(block.id)}
                    onChange={(text) => updateAt(index, { text })}
                    onKeyDown={(e) => handleTextKeyDown(index, e)}
                  />
                );
              }

              return (
            <TextBlockView
              value={block.text || ""}
              ghostHints={slashGhostHints}
              analystReportStyle={isAnalystReport && isPrimaryReportBlock}
              reportAnimate={shouldAnimateReport && isPrimaryReportBlock}
              reportStaticView={
                isPrimaryReportBlock
                && (isMarketingGuideReport || (isAnalystReport && !shouldAnimateReport))
              }
              onReportAnimationComplete={onReportAnimationComplete}
              onSelectAllRequest={(fromEl) => requestDocSelectAll(fromEl, blocks)}
              embedded={block.embedded || null}
              linkedNodeId={(() => {
                const h1Index = getH1IndexForTextBlock(blocks, index);
                return h1Index >= 0 ? blocks[h1Index]?.nodeId || null : null;
              })()}
              onDetachFromNode={
                linkedOwnerIndex >= 0 && onDetachFromNode
                  ? () => onDetachFromNode(linkedOwnerIndex)
                  : null
              }
              continuationValue={
                continuationBlock ? continuationBlock.text || "" : null
              }
              onContinuationChange={
                continuationIndex >= 0
                  ? (text) => updateAt(continuationIndex, { text })
                  : null
              }
              onContinuationKeyDown={
                continuationIndex >= 0
                  ? (e) => handleTextKeyDown(continuationIndex, e)
                  : null
              }
              onContinuationFocus={
                continuationIndex >= 0
                  ? () => onFocusBlock?.(continuationBlock.id)
                  : null
              }
              continuationPlaceholder={continuationPlaceholder}
              continuationAutoFocus={focusBlockId === continuationBlock?.id && !itemHidden}
              onRemoveEmbedded={
                block.embedded?.kind === WIDGET_SNAPSHOT_KIND
                  ? () => handleRemoveWidgetSnapshot(index)
                  : isEmbeddableWidgetBlock(block)
                  ? () => { void handleRemoveEmbeddedBlock(index); }
                  : null
              }
              onChange={(text) => {
                updateAt(index, { text });
                if (isPrimaryAnswerTextForLinkedOwner(blocks, index)) {
                  const h1Index = getH1IndexForTextBlock(blocks, index);
                  const ownerBlock = h1Index >= 0 ? blocks[h1Index] : null;
                  const parentCollapsed = ownerBlock
                    && collapsedContentByBlockId[ownerBlock.id];
                  if (h1Index >= 0 && !parentCollapsed) {
                    onAnswerBelowH1Change?.(h1Index, text);
                  }
                }
              }}
              placeholder={bodyPlaceholder}
              showPlaceholder={index === 0 && blocks.length === 1}
              autoFocus={focusBlockId === block.id && !itemHidden}
              onFocus={() => {
                onFocusBlock?.(block.id);
              }}
              onKeyDown={(e) => handleTextKeyDown(index, e)}
              onPaste={(e) => handleTextPaste(index, e)}
            />
              );
            })()
          ) : null}
        </div>
        {showCollapsedWritePad && collapsedActiveWriteId ? (
          <div
            className="doc-block-stack__item doc-collapsed-write-pad"
            data-collapsed-write-for={block.id}
          >
            <div data-collapsed-write-field={collapsedActiveWriteId}>
              <TextBlockView
                value={collapsedWriteBlock?.text || ""}
                ghostHints={slashGhostHints}
                onChange={(text) => {
                  const writeIndex = blocksRef.current.findIndex(
                    (b) => b.id === collapsedActiveWriteId,
                  );
                  if (writeIndex >= 0) updateAt(writeIndex, { text });
                }}
                placeholder=""
                showPlaceholder={false}
                autoFocus
                onFocus={() => onFocusBlock?.(collapsedActiveWriteId)}
                onKeyDown={(e) => {
                  const writeIndex = blocksRef.current.findIndex(
                    (b) => b.id === collapsedActiveWriteId,
                  );
                  if (writeIndex >= 0) handleTextKeyDown(writeIndex, e);
                }}
              />
            </div>
          </div>
        ) : null}
        </Fragment>
        );
      })}
    </div>
  );
});
