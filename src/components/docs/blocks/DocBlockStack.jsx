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
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  ensureEmptyTextBlockAfter,
  hasProductCardBlock,
  h1HasVideoEmbedSibling,
  insertBlockAfter,
  isEmptyTextBlock,
  normalizeDocBlocks,
  removeBlockAt,
  removeEmbedVideoPairAt,
  removeEmbedVideoPairFromVideoIndex,
  replaceBlockFromSlashInLinkable,
  replaceBlocksFromSlashInText,
  replaceBlocksFromSlashWithEmbedVideo,
  updateBlockAt,
} from "../../../lib/docBlocks.js";
import {
  createDocBlockFromSlash,
  parseSlashQuery,
  splitBodyForSlash,
} from "../../../lib/docBlockSlash.js";
import { getH1IndexForTextBlock, getOwnedTextBlockIndices, getOwningScheduleBlockIndexForText } from "../../../lib/docNodeSync.js";
import { isNoNodeLinkMode, resolveBlockNodeLinkColor } from "../../../lib/docNodeLinkColors.js";
import { H1BlockView } from "./H1BlockView.jsx";
import { TextBlockView } from "./TextBlockView.jsx";
import { TodoBlockView } from "./TodoBlockView.jsx";
import { DateBlockView } from "./DateBlockView.jsx";
import { MetricBlockView } from "./MetricBlockView.jsx";
import { ProductCardBlockView } from "./ProductCardBlockView.jsx";
import { VideoEmbedBlockView } from "./VideoEmbedBlockView.jsx";

// #region agent log
const debugLog = (location, message, data, hypothesisId) => {
  fetch("http://127.0.0.1:7764/ingest/1d5b49ee-76e8-4907-8f7a-6cd7282ea736", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a58ec5" },
    body: JSON.stringify({
      sessionId: "a58ec5",
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

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
}, ref) {
  const [todoFocusItemId, setTodoFocusItemId] = useState(null);
  const [collapsedContentByBlockId, setCollapsedContentByBlockId] = useState({});
  const [collapsedPadWriteByOwnerId, setCollapsedPadWriteByOwnerId] = useState({});
  const openNode = onOpenNodeForBlock || onOpenNodeForH1;
  const blocksRef = useRef(blocks);
  const stackRef = useRef(null);

  useLayoutEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const resyncAllTextHeights = useCallback(() => {
    const root = stackRef.current;
    if (!root) return;
    root.querySelectorAll("textarea").forEach((textarea) => {
      textarea.style.height = "auto";
      const minH = textarea.classList.contains("doc-h1-block__input--multiline") ? 22 : 28;
      textarea.style.height = `${Math.max(textarea.scrollHeight, minH)}px`;
      textarea.style.overflowY = "hidden";
    });
  }, []);

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

  const showScheduleForBlock = (block) =>
    blockLinksEnabled(block) && Boolean(block.queryEnabled) && Boolean(block.anchorFromNode);

  const isContentExpanded = (blockId) => !collapsedContentByBlockId[blockId];

  const toggleBlockContent = (blockId) => {
    const willCollapse = !collapsedContentByBlockId[blockId];

    // #region agent log
    debugLog("DocBlockStack.jsx:toggleBlockContent", "toggle", {
      blockId,
      willCollapse,
      activeWrite: collapsedPadWriteByOwnerId[blockId] ?? null,
      runId: "post-fix-v4",
    }, "A,F");
    // #endregion

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
    const parsed = parseSlashQuery(alias);
    if (!parsed || !canInsertSlashBlock(parsed)) return;

    const ownerBlock = blocksRef.current[ownerIndex];
    if (!ownerBlock) return;

    const padEntry = collapsedPadWriteByOwnerId[ownerBlock.id];
    let blockIndex = padEntry?.blockId
      ? blocksRef.current.findIndex((b) => b.id === padEntry.blockId)
      : -1;

    if (blockIndex < 0) {
      const owned = getOwnedTextBlockIndices(blocksRef.current, ownerIndex);
      const insertAfterIndex = owned.length > 0 ? owned[owned.length - 1] : ownerIndex;
      const nextBlock = blocksRef.current[insertAfterIndex + 1];
      if (isEmptyTextBlock(nextBlock)) {
        blockIndex = insertAfterIndex + 1;
      } else {
        const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
        const inserted = insertBlockAfter(blocksRef.current, insertAfterIndex, textBlock);
        setBlocks(inserted);
        blockIndex = insertAfterIndex + 1;
      }
    }

    const block = blocksRef.current[blockIndex];
    if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return;

    clearCollapsedPadWrite(ownerBlock.id);
    insertSlashFromText(blockIndex, block.text || "", parsed);
  };

  const insertSlashCommandAtFocus = (alias) => {
    const parsed = parseSlashQuery(alias);
    if (!parsed || !canInsertSlashBlock(parsed)) return;

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
        || focused.type === DOC_BLOCK_TYPES.TODO
        || focused.type === DOC_BLOCK_TYPES.DATE
        || focused.type === DOC_BLOCK_TYPES.METRIC
      ) {
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
          // #region agent log
          debugLog("DocBlockStack.jsx:focusPadTextarea", "no-input", {
            blockId,
            tries,
            runId: "post-fix-v4",
          }, "B");
          // #endregion
          return;
        }
        input.focus({ preventScroll: true });
        if ("setSelectionRange" in input) {
          const pos = caretPos ?? input.value.length;
          input.setSelectionRange(pos, pos);
        }
        // #region agent log
        debugLog("DocBlockStack.jsx:focusPadTextarea", "focused", {
          blockId,
          valueLen: input.value?.length ?? 0,
          clientHeight: input.clientHeight,
          runId: "post-fix-v4",
        }, "B");
        // #endregion
      });
    };
    attempt();
  };

  const focusBlockCaret = (blockId, caretPos = null) => {
    if (!blockId) return;
    onFocusBlock?.(blockId);
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
          // #region agent log
          debugLog("DocBlockStack.jsx:focusBlockCaret", "no-input", {
            blockId,
            tries,
            itemHidden: el?.closest(".doc-block-stack__item")?.hasAttribute("hidden"),
          }, "B");
          // #endregion
          return;
        }
        input.focus({ preventScroll: true });
        if ("setSelectionRange" in input) {
          const pos = caretPos ?? input.value.length;
          input.setSelectionRange(pos, pos);
        }
        // #region agent log
        debugLog("DocBlockStack.jsx:focusBlockCaret", "focused", {
          blockId,
          tag: input.tagName,
          valueLen: input.value?.length ?? 0,
          clientHeight: input.clientHeight,
          scrollHeight: input.scrollHeight,
          activeTag: document.activeElement?.tagName,
          activeClass: document.activeElement?.className,
        }, "B,D");
        // #endregion
      });
    };
    attempt();
  };

  const isAtInputStart = (e) =>
    e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0;

  const syncAnswerBelowH1 = (blocksList, textBlockIndex, text) => {
    const h1Index = getH1IndexForTextBlock(blocksList, textBlockIndex);
    if (h1Index >= 0) onAnswerBelowH1Change?.(h1Index, text);
  };

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
  }, [blocks, collapsedContentByBlockId, collapsedPadWriteByOwnerId, resyncAllTextHeights]);

  const setBlocks = (next) => {
    const merged = normalizeDocBlocks(next);
    blocksRef.current = merged;
    onBlocksChange?.(merged);
  };

  const updateAt = (index, patch) => {
    setBlocks(updateBlockAt(blocksRef.current, index, patch));
  };

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
      updateAt(index, patch);
      return;
    }

    const fresh = normalizeDocBlocks(blocksRef.current)[index] ?? block;
    openNode?.(index, fresh);
  };

  const insertTextAfter = (index, initialText = "", sourceBlocks = null, options = {}) => {
    const { skipFocus = false } = options;
    const current = sourceBlocks ?? blocksRef.current;
    const nextBlock = current[index + 1];
    const h1Index = current[index]?.type === DOC_BLOCK_TYPES.H1 ? index : -1;

    if (h1Index >= 0 && nextBlock?.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
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

    if (isEmptyTextBlock(nextBlock)) {
      if (initialText) {
        const next = updateBlockAt(current, index + 1, { text: initialText });
        setBlocks(next);
        if (h1Index >= 0) onAnswerBelowH1Change?.(h1Index, initialText);
      } else {
        setBlocks([...current]);
      }
      if (!skipFocus) {
        focusBlockCaret(nextBlock.id, initialText ? initialText.length : 0);
      }
      requestContentGrow();
      return nextBlock.id;
    }

    const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: initialText });
    const next = insertBlockAfter(current, index, textBlock);
    setBlocks(next);
    if (h1Index >= 0 && initialText) onAnswerBelowH1Change?.(h1Index, initialText);
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
    requestContentGrow();
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
    const parsed = parseSlashQuery(slash.slice(1));
    if (!parsed || !canInsertSlashBlock(parsed)) return false;

    return insertSlashFromText(blockIndex, textValue, parsed);
  };

  const tryConfirmSlashInLinkable = (blockIndex, fieldValue) => {
    const { slash } = splitBodyForSlash(fieldValue);
    if (!slash) return false;
    const parsed = parseSlashQuery(slash.slice(1));
    if (!parsed || !canInsertSlashBlock(parsed)) return false;

    const newBlock = createDocBlockFromSlash(parsed);
    const next = replaceBlockFromSlashInLinkable(
      blocksRef.current,
      blockIndex,
      fieldValue,
      newBlock,
    );
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

  const handleLinkableBlockKeyDown = (index, block, e) => {
    const fieldValue = e.currentTarget?.value ?? "";

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const { slash } = splitBodyForSlash(fieldValue);
      if (slash) {
        const parsed = parseSlashQuery(slash.slice(1));
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

          const el = e.currentTarget;
          const caretStart = el.selectionStart ?? 0;
          const caretEnd = el.selectionEnd ?? caretStart;
          const title = fieldValue || block.title || "";
          const head = title.slice(0, caretStart);
          const tail = title.slice(caretEnd);
          const current = updateBlockAt(blocksRef.current, index, { title: head });

          insertTextAfter(index + 1, tail, current);
          return;
        }

        const el = e.currentTarget;
        const caretStart = el.selectionStart ?? 0;
        const caretEnd = el.selectionEnd ?? caretStart;
        const title = fieldValue || block.title || "";
        const head = title.slice(0, caretStart);
        const tail = title.slice(caretEnd);
        const current = updateBlockAt(blocksRef.current, index, { title: head });

        if (tail) onAnswerBelowH1Change?.(index, tail);
        insertTextAfter(index, tail, current);
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
        const titleInput = el?.querySelector(".doc-todo-block__title-input");
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

  useImperativeHandle(ref, () => ({
    insertSlashCommand: insertSlashCommandAtFocus,
    resyncTextHeights: resyncAllTextHeights,
  }));

  return (
    <div className="doc-block-stack" ref={stackRef}>
      {blocks.map((block, index) => {
        const itemHidden =
          block.type === DOC_BLOCK_TYPES.TEXT && isTextHiddenByParentCollapse(index);
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

        if (block.type === DOC_BLOCK_TYPES.TEXT && !itemHidden) {
          const ownerIdx = getOwningScheduleBlockIndexForText(blocks, index);
          const ownerId = ownerIdx >= 0 ? blocks[ownerIdx]?.id : null;
          // #region agent log
          debugLog("DocBlockStack.jsx:renderText", "visible-text", {
            blockId: block.id,
            index,
            textLen: (block.text || "").length,
            itemHidden,
            isActiveWrite: ownerId
              ? collapsedPadWriteByOwnerId[ownerId]?.blockId === block.id
              : false,
            collapsed: ownerId ? Boolean(collapsedContentByBlockId[ownerId]) : false,
            runId: "post-fix-v4",
          }, "A,C");
          // #endregion
        }

        if (
          (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.TODO)
          && showScheduleForBlock(block)
        ) {
          // #region agent log
          debugLog("DocBlockStack.jsx:renderOwner", "schedule-owner", {
            blockId: block.id,
            type: block.type,
            collapsed: Boolean(collapsedContentByBlockId[block.id]),
            showCollapsedWritePad,
            activeWrite: collapsedActiveWriteId,
            collapsedWriteIndex,
            hasWriteBlock: Boolean(collapsedWriteBlock),
            runId: "post-fix-v4",
          }, "F");
          // #endregion
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
            <H1BlockView
              value={block.title || ""}
              placeholder={
                h1HasVideoEmbedSibling(blocksRef.current, index)
                  ? "Create video title"
                  : undefined
              }
              onChange={(title) => {
                updateAt(index, { title });
                if (h1HasVideoEmbedSibling(blocksRef.current, index)) {
                  onVideoEmbedH1TitleChange?.(index);
                }
              }}
              queryEnabled={Boolean(block.queryEnabled)}
              nodeLinkColor={blockLinkColor(block)}
              linksEnabled={blockLinksEnabled(block)}
              onFocus={() => {
                if (collapsedPadWriteByOwnerId[block.id]) return;
                onFocusBlock?.(block.id);
              }}
              anchorFromNode={Boolean(block.anchorFromNode)}
              anchorDate={block.anchorDate || ""}
              anchorTime={block.anchorTime || ""}
              onQueryHandleClick={() => handleQueryHandleClick(index)}
              onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
              contentExpanded={isContentExpanded(block.id)}
              onContentToggle={
                showScheduleForBlock(block)
                  ? () => toggleBlockContent(block.id)
                  : undefined
              }
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.DATE ? (
            <DateBlockView
              title={block.title || ""}
              date={block.date || ""}
              time={block.time || ""}
              onTitleChange={(title) => updateAt(index, { title })}
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
              onTitleChange={(title) => updateAt(index, { title })}
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
              onDelete={() => {
                if (!window.confirm("Delete this product card from the document?")) return;
                let next = removeBlockAt(blocksRef.current, index);
                if (!next.length) {
                  next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
                }
                setBlocks(next);
                const focusIndex = Math.min(index, next.length - 1);
                onFocusBlock?.(next[focusIndex]?.id);
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
              onDelete={() => removeEmbedVideoSection(index)}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.TODO ? (
            <TodoBlockView
              listTitle={block.listTitle ?? "Checkbox:"}
              onListTitleChange={(listTitle) => updateAt(index, { listTitle })}
              queryEnabled={Boolean(block.queryEnabled)}
              nodeLinkColor={blockLinkColor(block)}
              linksEnabled={blockLinksEnabled(block)}
              onFocus={() => {
                if (collapsedPadWriteByOwnerId[block.id]) return;
                onFocusBlock?.(block.id);
              }}
              anchorFromNode={Boolean(block.anchorFromNode)}
              anchorDate={block.anchorDate || ""}
              anchorTime={block.anchorTime || ""}
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
              contentExpanded={isContentExpanded(block.id)}
              onContentToggle={
                showScheduleForBlock(block)
                  ? () => toggleBlockContent(block.id)
                  : undefined
              }
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.TEXT && !isCollapsedPadWriteBlock(block.id) ? (
            <TextBlockView
              value={block.text || ""}
              onChange={(text) => {
                updateAt(index, { text });
                const h1Index = getH1IndexForTextBlock(blocks, index);
                const ownerBlock = h1Index >= 0 ? blocks[h1Index] : null;
                const parentCollapsed = ownerBlock
                  && collapsedContentByBlockId[ownerBlock.id];
                if (h1Index >= 0 && !parentCollapsed) {
                  onAnswerBelowH1Change?.(h1Index, text);
                }
              }}
              placeholder={bodyPlaceholder}
              showPlaceholder={index === 0 && blocks.length === 1}
              autoFocus={focusBlockId === block.id && !itemHidden}
              onFocus={() => {
                // #region agent log
                debugLog("DocBlockStack.jsx:textFocus", "textarea-focus", {
                  blockId: block.id,
                  textLen: (block.text || "").length,
                }, "B");
                // #endregion
                onFocusBlock?.(block.id);
              }}
              onKeyDown={(e) => handleTextKeyDown(index, e)}
              onAfterInput={requestContentGrow}
            />
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
                onAfterInput={requestContentGrow}
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
