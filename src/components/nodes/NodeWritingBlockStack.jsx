import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTodoItem, convertImageLayoutBlock, countMoodboardSavedImages, DOC_BLOCK_TYPES, IMAGE_SPLIT_BODY_MODE } from "../../lib/docBlocks.js";
import {
  DOCUMENT_SLASH_GHOST_HINTS,
  getLibraryHashActionAtCaret,
  parseNodeSlashQuery,
  splitBodyForSlash,
} from "../../lib/docBlockSlash.js";
import {
  applyTextEditToMentions,
  mergeMentionBlocks,
} from "../../lib/docMentions.js";
import {
  applyTextEditToLibraryNameRefs,
  mergeLibraryNameRefBlocks,
} from "../../lib/docLibraryNameRefs.js";
import {
  applyTextEditToLibrarySpeakRefs,
} from "../../lib/docLibrarySpeakRefs.js";
import { applyTextEditToTagRefs, snapCaretOutOfTagRefBoxInterior } from "../../lib/docTagRefs.js";
import { useLibraryItems, useLibrarySets } from "../../hooks/useLibraryItems.js";
import { isLibraryAssignPromptFile, mergeAssignFiles, shouldCloneLibraryAssign } from "../../lib/libraryAssignPath.js";
import { imageSplitHasFill } from "../../lib/libraryImageCardPick.js";
import { assignLibraryItemToSet, cloneLibraryItemIntoSet } from "../../lib/folderLibrary.js";
import {
  applyTextEditToMarkerRanges,
  mergeBlockMarkerRanges,
} from "../../lib/docTextMarkerRanges.js";
import {
  applyTextEditToBoldRanges,
  mergeBlockBoldRanges,
} from "../../lib/docTextBoldRanges.js";
import {
  applyLibraryHashInTextBlock,
  applySlashInTextBlock,
  createEmptyTextBlock,
  ensureEmptyTextBlockAfterNode,
  insertBlockAfterIndex,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  removeWritingBlockAt,
} from "../../lib/nodeInlineContent.js";
import {
  applyH1MarkdownShortcutToNodeBlocks,
  findH1MarkdownShortcutCaret,
  resolveH1MarkdownShortcutFromKey,
} from "../../lib/docMarkdownHeadingShortcut.js";
import { isHeadingBlockType } from "../../lib/textSelectionHeading.js";
import { scrollTextareaCaretIntoCameraView, withPreservedWritingScroll } from "../../lib/textareaSelectionRect.js";
import { SlashAwareTextarea } from "../docs/blocks/SlashAwareTextarea.jsx";
import { H1BlockView } from "../docs/blocks/H1BlockView.jsx";
import { H2BlockView } from "../docs/blocks/H2BlockView.jsx";
import { H3BlockView } from "../docs/blocks/H3BlockView.jsx";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";
import { CodeBlockView } from "../docs/blocks/CodeBlockView.jsx";
import { PasswordVaultBlockView } from "../docs/blocks/PasswordVaultBlockView.jsx";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { AgentBlockView } from "../docs/blocks/AgentBlockView.jsx";
import { StepSequenceBlockView } from "../docs/blocks/StepSequenceBlockView.jsx";
import { ImageBlockView } from "../docs/blocks/ImageBlockView.jsx";
import { ImageSplitBlockView } from "../docs/blocks/ImageSplitBlockView.jsx";
import { MoodboardBlockView } from "../docs/blocks/MoodboardBlockView.jsx";
import { BannerBlockView } from "../docs/blocks/BannerBlockView.jsx";
import { ProductCardBlockView } from "../docs/blocks/ProductCardBlockView.jsx";
import { LinkedNodeDocActions } from "../docs/blocks/LinkedNodeDocActions.jsx";
import {
  EmbeddedWidgetStack,
  hasRenderableEmbeddedWidget,
} from "../docs/blocks/EmbeddedWidgetStack.jsx";
import { removeEmbeddedFromWritingBlock } from "../../lib/nodeIntelWidget.js";
import { queueUrlTableEntry } from "../../lib/urlTableSession.js";
import { queuePasswordTableEntry } from "../../lib/passwordTableSession.js";
import { collectTagCandidatesForObject } from "../../lib/urlTableTags.js";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useUrlTablesStore } from "../../stores/urlTablesStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useNodeTextSelectionToolbar } from "./useNodeTextSelectionToolbar.jsx";
import {
  findNewlyClosedLibraryPrompt,
  stripLibraryPromptDelimiters,
} from "../../lib/libraryPromptCapture.js";
import { sliceScriptRefsForCapture } from "../../lib/libraryScriptCapture.js";
import { LibraryPromptCaptureModal } from "../docs/LibraryPromptCaptureModal.jsx";
import { FolderLibraryImageDetail } from "../docs/FolderLibraryImageDetail.jsx";
import { FolderLibraryAssetDetail } from "../docs/FolderLibraryAssetDetail.jsx";

function isAtInputStart(e) {
  const target = e.target;
  if (!target || !("selectionStart" in target)) return false;
  return target.selectionStart === 0 && target.selectionEnd === 0;
}

/** Zoom-out only: show at most this many trailing empty TEXT cells. */
const COLLAPSED_MAX_TRAILING_EMPTY = 2;

function getHideTrailingEmptyFromIndex(blocks) {
  let trailingStart = blocks.length;
  while (
    trailingStart > 0
    && blocks[trailingStart - 1]?.type === NODE_BLOCK_TYPES.TEXT
    && !blocks[trailingStart - 1].embedded
    && !(blocks[trailingStart - 1].text || "").trim()
  ) {
    trailingStart -= 1;
  }
  const trailingCount = blocks.length - trailingStart;
  if (trailingCount <= COLLAPSED_MAX_TRAILING_EMPTY) return blocks.length;
  return trailingStart + COLLAPSED_MAX_TRAILING_EMPTY;
}

function focusVaultTarget(parsed, blocks, blockIndex, onFocusTargetChange) {
  const vaultNodeType = vaultNodeTypeForParsed(parsed);
  if (vaultNodeType === NODE_BLOCK_TYPES.AGENT) {
    const existingIndex = findLastAgentBlockIndex(blocks);
    if (existingIndex >= 0) {
      onFocusTargetChange?.({ blockIndex: existingIndex, focusAgent: true });
      return;
    }
  }
  if (vaultNodeType && vaultNodeType !== NODE_BLOCK_TYPES.AGENT) {
    const existingIndex = findLastVaultBlockIndex(blocks, vaultNodeType);
    if (existingIndex >= 0) {
      onFocusTargetChange?.({ blockIndex: existingIndex, focusVault: true });
      return;
    }
  }

  const insertedIndex = blockIndex + 1;
  if (parsed.type === DOC_BLOCK_TYPES.TODO) {
    const todoBlock = blocks[insertedIndex];
    onFocusTargetChange?.({
      blockIndex: insertedIndex,
      itemId: todoBlock?.items?.[0]?.id ?? null,
    });
    return;
  }
  if (parsed.type === DOC_BLOCK_TYPES.CODE) {
    onFocusTargetChange?.({ blockIndex: insertedIndex, focusCode: true });
    return;
  }
  if (parsed.type === DOC_BLOCK_TYPES.AGENT) {
    onFocusTargetChange?.({ blockIndex: insertedIndex, focusAgent: true });
    return;
  }
  if (parsed.type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
    onFocusTargetChange?.({ blockIndex: insertedIndex, focusSteps: true });
    return;
  }
  if (vaultNodeType) {
    onFocusTargetChange?.({ blockIndex: insertedIndex, focusVault: true });
    return;
  }
  onFocusTargetChange?.({ blockIndex: insertedIndex, focusHeading: true });
}

function isHeadingFocusTarget(focusTarget, blockIndex) {
  if (focusTarget?.blockIndex !== blockIndex) return false;
  return Boolean(
    focusTarget.focusH1
    || focusTarget.focusH2
    || focusTarget.focusH3
    || focusTarget.focusHeading,
  );
}

function vaultNodeTypeForParsed(parsed) {
  if (parsed?.type === DOC_BLOCK_TYPES.PASSWORD_VAULT) return NODE_BLOCK_TYPES.PASSWORD_VAULT;
  if (parsed?.type === DOC_BLOCK_TYPES.LINK_VAULT) return NODE_BLOCK_TYPES.LINK_VAULT;
  if (parsed?.type === DOC_BLOCK_TYPES.AGENT) return NODE_BLOCK_TYPES.AGENT;
  return null;
}

function findLastVaultBlockIndex(blocks, vaultNodeType) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type === vaultNodeType) return index;
  }
  return -1;
}

function findLastAgentBlockIndex(blocks) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type === NODE_BLOCK_TYPES.AGENT) return index;
  }
  return -1;
}

function focusTextBlockAfter(inputRefs, blocks, afterIndex) {
  for (let index = afterIndex + 1; index < blocks.length; index += 1) {
    if (blocks[index]?.type !== NODE_BLOCK_TYPES.TEXT) continue;
    const el = inputRefs.current[blocks[index].id];
    if (el) {
      el.focus();
      return true;
    }
  }

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type !== NODE_BLOCK_TYPES.TEXT) continue;
    const el = inputRefs.current[blocks[index].id];
    if (el) {
      el.focus();
      return true;
    }
  }

  return false;
}

function scrollCaretAfterNewline(blockId) {
  requestAnimationFrame(() => {
    const textarea = document.querySelector(
      `[data-writing-block-id="${blockId}"] textarea`,
    );
    if (textarea instanceof HTMLTextAreaElement) {
      scrollTextareaCaretIntoCameraView(textarea, { behavior: "instant" });
    }
  });
}

function insertNewlineAtCaret(blockIndex, e, blocksRef, updateBlocks) {
  e.preventDefault();
  const el = e.currentTarget;
  const text = el.value ?? "";
  const block = normalizeWritingBlocks(blocksRef.current)[blockIndex];
  const tagRefs = Array.isArray(block?.tagRefs) ? block.tagRefs : [];
  let caretStart = el.selectionStart ?? 0;
  let caretEnd = el.selectionEnd ?? caretStart;
  // Don't let Enter split the moodboard label/spacers (that drops the tag link).
  // Keep caret at the label's leading edge so Enter can still open a line above.
  if (caretStart === caretEnd && tagRefs.length) {
    const snapped = snapCaretOutOfTagRefBoxInterior(text, tagRefs, caretStart);
    caretStart = snapped;
    caretEnd = snapped;
  }
  const nextText = `${text.slice(0, caretStart)}\n${text.slice(caretEnd)}`;
  const blockId = block?.id;
  if (!blockId) return;

  const current = normalizeWritingBlocks(blocksRef.current);
  updateBlocks(current.map((item, index) => {
    if (index !== blockIndex) return item;
    // Shift @mention + #tagRef + marker + bold ranges past the newline.
    const mentions = applyTextEditToMentions(item.text || "", nextText, item.mentions || []);
    const nextTagRefs = applyTextEditToTagRefs(item.text || "", nextText, item.tagRefs || []);
    const libraryNameRefs = applyTextEditToLibraryNameRefs(
      item.text || "",
      nextText,
      item.libraryNameRefs || [],
    );
    const librarySpeakRefs = applyTextEditToLibrarySpeakRefs(
      item.text || "",
      nextText,
      item.librarySpeakRefs || [],
    );
    const markerRanges = applyTextEditToMarkerRanges(item.text || "", nextText, item.markerRanges || []);
    const boldRanges = applyTextEditToBoldRanges(item.text || "", nextText, item.boldRanges || []);
    return {
      ...item,
      text: nextText,
      mentions: mentions.length ? mentions : undefined,
      tagRefs: nextTagRefs.length ? nextTagRefs : undefined,
      libraryNameRefs: libraryNameRefs.length ? libraryNameRefs : undefined,
      librarySpeakRefs: librarySpeakRefs.length ? librarySpeakRefs : undefined,
      markerRanges: markerRanges.length ? markerRanges : undefined,
      boldRanges: boldRanges.length ? boldRanges : undefined,
    };
  }));

  requestAnimationFrame(() => {
    const textarea = document.querySelector(
      `[data-writing-block-id="${blockId}"] textarea`,
    );
    if (textarea instanceof HTMLTextAreaElement && "setSelectionRange" in textarea) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(caretStart + 1, caretStart + 1);
    }
    scrollCaretAfterNewline(blockId);
  });
}

export function NodeWritingBlockStack({
  blocks,
  onBlocksChange,
  focusTarget = null,
  onFocusTargetChange,
  writingCaretRef = null,
  slashEnabled = false,
  contentFocusMode = false,
  className = "",
  textPlaceholder = "Escribe aquí o /macronodo",
  companyObjectId = null,
  parseSlashQuery = parseNodeSlashQuery,
  slashGhostHints = DOCUMENT_SLASH_GHOST_HINTS,
  libraryOwnerKind = "document",
  libraryOwnerId = "",
  folderLibraryId = "",
  onLibrarySlashAction = null,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const inputRefs = useRef({});
  const stackRef = useRef(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [promptCapture, setPromptCapture] = useState(null);
  const [savedPromptItemId, setSavedPromptItemId] = useState(null);
  const [savedPromptAssetId, setSavedPromptAssetId] = useState(null);
  const [pendingAssignClone, setPendingAssignClone] = useState(null);

  const snapshotWritingCaret = useCallback((blockIndex, el) => {
    if (!writingCaretRef) return;
    const caret = el?.selectionStart;
    if (typeof caret !== "number") return;
    writingCaretRef.current = { blockIndex, caret };
  }, [writingCaretRef]);
  const urlTableEntries = useUrlTableStore((s) => s.entries);
  const urlTables = useUrlTablesStore((s) => s.tables);
  const libraryItems = useLibraryItems(libraryOwnerKind, libraryOwnerId);
  const folderLibraryItems = useLibraryItems("folder", folderLibraryId);
  const librarySets = useLibrarySets(libraryOwnerKind, libraryOwnerId);
  const mentionCandidates = useMemo(() => {
    if (!companyObjectId) return null;
    const titleById = new Map(
      urlTables
        .filter((table) => table.objectId === companyObjectId)
        .map((table) => [table.id, table.title || ""]),
    );
    return collectTagCandidatesForObject(urlTableEntries, companyObjectId).map((item) => ({
      ...item,
      tableTitle: titleById.get(item.tableId) || "",
    }));
  }, [companyObjectId, urlTableEntries, urlTables]);
  const libraryNameCandidates = useMemo(() => {
    if (libraryOwnerKind !== "document" || !libraryOwnerId) return null;
    const seen = new Set();
    const out = [];
    const sources = [
      ...libraryItems.filter((item) => !item?.setId),
      ...folderLibraryItems,
    ];
    for (const item of sources) {
      if (item?.category !== "image") continue;
      const tag = String(item.tag || "").trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: item.id,
        tag,
        name: tag,
        description: String(item.description || ""),
        setId: item.setId ?? null,
      });
    }
    return out;
  }, [folderLibraryItems, libraryItems, libraryOwnerId, libraryOwnerKind]);
  const libraryAssignFiles = useMemo(() => {
    if (libraryOwnerKind !== "document" || !libraryOwnerId) return null;
    const taggedPrompts = (items) => items.filter(
      (item) => isLibraryAssignPromptFile(item) && String(item?.tag || "").trim(),
    );
    return mergeAssignFiles(
      taggedPrompts(libraryItems),
      taggedPrompts(folderLibraryItems),
    );
  }, [folderLibraryItems, libraryItems, libraryOwnerId, libraryOwnerKind]);
  const libraryAssignAssets = useMemo(() => {
    if (libraryOwnerKind !== "document" || !libraryOwnerId) return null;
    return librarySets.filter((set) => String(set?.tag || "").trim());
  }, [libraryOwnerId, libraryOwnerKind, librarySets]);

  const handleLibraryAssignSelect = useCallback((file, asset) => {
    if (libraryOwnerKind !== "document" || !libraryOwnerId || !file || !asset?.id) return;
    setPendingAssignClone({ file, assetId: asset.id });
    setSavedPromptAssetId(asset.id);
  }, [libraryOwnerId, libraryOwnerKind]);

  const handleCloseAssetDetail = useCallback(() => {
    setSavedPromptAssetId(null);
    setPendingAssignClone(null);
  }, []);

  const handleSavePendingAssignClone = useCallback(() => {
    if (!pendingAssignClone?.file || !libraryOwnerId) return;
    const file = pendingAssignClone.file;
    if (shouldCloneLibraryAssign(file)) {
      cloneLibraryItemIntoSet(libraryOwnerId, file, pendingAssignClone.assetId);
    } else if (file.id) {
      assignLibraryItemToSet("document", libraryOwnerId, file.id, pendingAssignClone.assetId);
    }
    setPendingAssignClone(null);
  }, [libraryOwnerId, pendingAssignClone]);

  const handleOpenAssetItem = useCallback((item) => {
    if (!item?.id) return;
    if (item.category === "image") {
      setSavedPromptItemId(item.id);
    }
  }, []);

  const updateBlocks = useCallback((nextBlocks) => {
    onBlocksChange?.(normalizeWritingBlocks(nextBlocks));
  }, [onBlocksChange]);

  const { selectionBubble } = useNodeTextSelectionToolbar({
    stackRef,
    blocks,
    onBlocksChange: updateBlocks,
  });

  useEffect(() => {
    if (focusTarget?.blockIndex == null) return undefined;
    // Skip scroll/focus chase unless this is an intentional insert/focus request.
    // (Caret is tracked in writingCaretRef — never via focusTarget — so blur
    // into image-split text must not re-run scrollIntoView.)
    const wantsFocus = Boolean(
      focusTarget.focusKey
      || focusTarget.focusHeading
      || focusTarget.focusH1
      || focusTarget.focusH2
      || focusTarget.focusH3
      || focusTarget.focusText
      || focusTarget.focusAgent
      || focusTarget.focusCode
      || focusTarget.focusVault
      || focusTarget.focusSteps
      || focusTarget.itemId,
    );
    if (!wantsFocus) return undefined;

    const block = normalizeWritingBlocks(blocksRef.current)[focusTarget.blockIndex];
    if (!block?.id) return undefined;

    let cancelled = false;
    const focusInput = (tries = 0) => {
      if (cancelled) return;
      const root = stackRef.current;
      const scrollParent = root?.closest(".note-taker__content-scroll")
        || root?.closest(".node-query-modal__content-scroll");
      const blockEl = root?.querySelector(`[data-writing-block-id="${block.id}"]`);
      if (!blockEl) {
        if (tries < 12) requestAnimationFrame(() => focusInput(tries + 1));
        return;
      }
      // Only scroll when the parent explicitly asked via focusKey (post-insert).
      if (focusTarget.focusKey && scrollParent) {
        const blockRect = blockEl.getBoundingClientRect();
        const rootRect = scrollParent.getBoundingClientRect();
        if (blockRect.top < rootRect.top || blockRect.bottom > rootRect.bottom) {
          blockEl.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
      }

      if (focusTarget.focusH1 || focusTarget.focusH2 || focusTarget.focusH3 || focusTarget.focusHeading) {
        const input = blockEl.querySelector("textarea, input");
        if (input) {
          input.focus({ preventScroll: true });
          return;
        }
      }
      if (focusTarget.focusText) {
        const textarea = blockEl.querySelector("textarea.node-writing-text-field, textarea.doc-text-block__field");
        if (textarea) {
          textarea.focus({ preventScroll: true });
          return;
        }
      }
      if (focusTarget.focusAgent) {
        const input = blockEl.querySelector(".doc-agent-cell__input");
        input?.focus({ preventScroll: true });
        return;
      }
      if (tries < 12) requestAnimationFrame(() => focusInput(tries + 1));
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => focusInput());
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [focusTarget]);

  const updateBlockAt = useCallback((index, patch) => {
    const current = blocksRef.current;
    updateBlocks(current.map((block, blockIndex) => (
      blockIndex === index ? { ...block, ...patch } : block
    )));
  }, [updateBlocks]);

  const applyTextBlockChange = useCallback((blockIndex, nextText, meta) => {
    const prevText = blocksRef.current[blockIndex]?.text ?? "";
    const block = blocksRef.current[blockIndex];
    let text = nextText;
    let captureMeta = null;
    if (libraryOwnerId) {
      const capture = findNewlyClosedLibraryPrompt(prevText, nextText);
      if (capture) {
        captureMeta = sliceScriptRefsForCapture(nextText, capture, {
          libraryNameRefs: meta?.libraryNameRefs ?? block?.libraryNameRefs,
          librarySpeakRefs: meta?.librarySpeakRefs ?? block?.librarySpeakRefs,
        });
        text = stripLibraryPromptDelimiters(nextText, capture);
        setPromptCapture({
          prompt: capture.prompt,
          libraryNameRefs: captureMeta.libraryNameRefs,
          librarySpeakRefs: captureMeta.librarySpeakRefs,
        });
      }
    }
    const mentions = text !== nextText
      ? applyTextEditToMentions(nextText, text, meta?.mentions || [])
      : meta?.mentions;
    const libraryNameRefs = text !== nextText
      ? applyTextEditToLibraryNameRefs(
        nextText,
        text,
        meta?.libraryNameRefs ?? block?.libraryNameRefs,
      )
      : meta?.libraryNameRefs;
    const librarySpeakRefs = text !== nextText
      ? applyTextEditToLibrarySpeakRefs(
        nextText,
        text,
        meta?.librarySpeakRefs ?? block?.librarySpeakRefs,
      )
      : meta?.librarySpeakRefs;
    updateBlockAt(blockIndex, {
      text,
      ...(meta && "mentions" in meta
        ? { mentions: (mentions?.length ? mentions : undefined) }
        : {}),
      ...(meta && "tagRefs" in meta
        ? { tagRefs: meta.tagRefs?.length ? meta.tagRefs : undefined }
        : {}),
      ...((meta && "libraryNameRefs" in meta) || libraryNameRefs?.length
        ? { libraryNameRefs: libraryNameRefs?.length ? libraryNameRefs : undefined }
        : {}),
      ...((meta && "librarySpeakRefs" in meta) || librarySpeakRefs?.length
        ? { librarySpeakRefs: librarySpeakRefs?.length ? librarySpeakRefs : undefined }
        : {}),
      ...(meta && "markerRanges" in meta
        ? { markerRanges: meta.markerRanges?.length ? meta.markerRanges : undefined }
        : {}),
      ...(meta && "boldRanges" in meta
        ? { boldRanges: meta.boldRanges?.length ? meta.boldRanges : undefined }
        : {}),
    });
  }, [libraryOwnerId, updateBlockAt]);

  const removeBlockAt = useCallback((blockIndex) => {
    updateBlocks(removeWritingBlockAt(blocksRef.current, blockIndex));
    onFocusTargetChange?.(null);
  }, [onFocusTargetChange, updateBlocks]);

  const confirmRemoveCommandBlock = useCallback(async (blockIndex, messageKey) => {
    const ok = await askConfirm({
      title: t("doc.blockDelete.title"),
      message: t(messageKey),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    removeBlockAt(blockIndex);
  }, [askConfirm, removeBlockAt, t]);

  const removeEmptyHeadingAndFocus = useCallback((headingIndex) => {
    const current = normalizeWritingBlocks(blocksRef.current);
    const heading = current[headingIndex];
    if (!heading || !isHeadingBlockType(heading.type)) return;

    const next = removeWritingBlockAt(current, headingIndex);
    updateBlocks(next);
    onFocusTargetChange?.(null);
    requestAnimationFrame(() => {
      focusTextBlockAfter(inputRefs, next, headingIndex - 1);
    });
  }, [onFocusTargetChange, updateBlocks]);

  const focusBlockById = useCallback((blockId, caret = null) => {
    if (!blockId) return;
    const attempt = (tries = 0) => {
      requestAnimationFrame(() => {
        let el = inputRefs.current[blockId];
        if (!el) {
          const root = stackRef.current;
          el = root?.querySelector(
            `[data-writing-block-id="${blockId}"] textarea, [data-writing-block-id="${blockId}"] input`,
          );
        }
        if (!el || !("focus" in el)) {
          if (tries < 12) attempt(tries + 1);
          return;
        }
        const alreadyFocused = document.activeElement === el;
        withPreservedWritingScroll(el, () => {
          if (!alreadyFocused) {
            el.focus({ preventScroll: true });
          }
          if (caret != null && "setSelectionRange" in el) {
            const pos = caret === "end" ? el.value.length : caret;
            el.setSelectionRange(pos, pos);
          }
        });
      });
    };
    attempt();
  }, []);

  const handleHeadingKeyDown = useCallback((blockIndex, e) => {
    const block = blocksRef.current[blockIndex];
    if (!block || !isHeadingBlockType(block.type)) return;

    const fieldValue = e.currentTarget?.value ?? block.title ?? "";
    const titleEmpty = !fieldValue.trim();
    const atStart = isAtInputStart(e);

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (titleEmpty) {
        removeEmptyHeadingAndFocus(blockIndex);
        return;
      }
      const current = normalizeWritingBlocks(blocksRef.current);
      const after = current[blockIndex + 1];
      if (!after || after.type !== NODE_BLOCK_TYPES.TEXT) {
        updateBlocks(insertBlockAfterIndex(current, blockIndex, createEmptyTextBlock()));
      }
      e.currentTarget?.blur();
      onFocusTargetChange?.(null);
      requestAnimationFrame(() => {
        const normalized = normalizeWritingBlocks(blocksRef.current);
        focusTextBlockAfter(inputRefs, normalized, blockIndex);
      });
      return;
    }

    // Backspace/Delete at start with title → move to previous cell (keep heading).
    if ((e.key === "Backspace" || e.key === "Delete") && atStart && !titleEmpty && blockIndex > 0) {
      e.preventDefault();
      const current = normalizeWritingBlocks(blocksRef.current);
      const prev = current[blockIndex - 1];
      focusBlockById(prev?.id, "end");
      return;
    }

    if ((e.key === "Backspace" || e.key === "Delete") && titleEmpty && atStart) {
      e.preventDefault();
      removeEmptyHeadingAndFocus(blockIndex);
    }
  }, [focusBlockById, onFocusTargetChange, removeEmptyHeadingAndFocus, updateBlocks]);

  const handleTextKeyDown = useCallback((blockIndex, e) => {
    // Render iterates over normalized blocks, so index against the normalized list.
    const current = normalizeWritingBlocks(blocksRef.current);
    const block = current[blockIndex];
    if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return;

    const textValue = e.currentTarget?.value ?? block.text ?? "";
    if (!e.metaKey && !e.nativeEvent?.isComposing) {
      const caret = e.currentTarget?.selectionStart ?? textValue.length;
      const caretEnd = e.currentTarget?.selectionEnd ?? caret;
      if (caret === caretEnd) {
        const resolvedH1 = resolveH1MarkdownShortcutFromKey(
          textValue,
          caret,
          e.key,
          e.code,
        );
        if (resolvedH1) {
          const applied = applyH1MarkdownShortcutToNodeBlocks(
            current,
            blockIndex,
            resolvedH1.text,
            resolvedH1.caret,
          );
          if (applied) {
            e.preventDefault();
            updateBlocks(applied.blocks);
            onFocusTargetChange?.(null);
            focusBlockById(applied.h1Id, 0);
            return;
          }
        }
      }
    }

    const { slash } = splitBodyForSlash(block.text);

    const confirmLibraryHash = () => {
      if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return false;
      if (!onLibrarySlashAction) return false;
      const liveText = e.currentTarget?.value ?? block.text ?? "";
      const caret = e.currentTarget?.selectionStart ?? liveText.length;
      const hashAction = getLibraryHashActionAtCaret(liveText, caret);
      if (!hashAction) return false;
      e.preventDefault();
      updateBlocks(applyLibraryHashInTextBlock(current, blockIndex, hashAction));
      onLibrarySlashAction(hashAction.action);
      return true;
    };

    // Folder expand blueprint: Enter inserts newline in the same cell (SlashAwareTextarea scrolls caret).
    if (contentFocusMode) {
      // Backspace at start → merge with / move to the previous cell (DocBlockStack parity).
      if (e.key === "Backspace" && isAtInputStart(e)) {
        if (blockIndex === 0) return;
        const prev = current[blockIndex - 1];
        const value = e.currentTarget.value ?? block.text ?? "";

        if (value && prev?.type === NODE_BLOCK_TYPES.TEXT) {
          e.preventDefault();
          const joinAt = (prev.text || "").length;
          const mergedResult = mergeMentionBlocks(
            prev.text || "",
            prev.mentions || [],
            value,
            block.mentions || [],
            "",
          );
          const mergedNames = mergeLibraryNameRefBlocks(
            prev.text || "",
            prev.libraryNameRefs || [],
            value,
            block.libraryNameRefs || [],
            "",
          );
          const mergedMarkers = mergeBlockMarkerRanges(
            { text: prev.text || "", markerRanges: prev.markerRanges || [] },
            { text: value, markerRanges: block.markerRanges || [] },
            "",
          );
          const mergedBolds = mergeBlockBoldRanges(
            { text: prev.text || "", boldRanges: prev.boldRanges || [] },
            { text: value, boldRanges: block.boldRanges || [] },
            "",
          );
          const next = current
            .map((b, i) => (i === blockIndex - 1
              ? {
                ...b,
                text: mergedResult.text,
                mentions: mergedResult.mentions.length ? mergedResult.mentions : undefined,
                libraryNameRefs: mergedNames.libraryNameRefs.length
                  ? mergedNames.libraryNameRefs
                  : undefined,
                markerRanges: mergedMarkers.length ? mergedMarkers : undefined,
                boldRanges: mergedBolds.length ? mergedBolds : undefined,
              }
              : b))
            .filter((_, i) => i !== blockIndex);
          updateBlocks(next);
          onFocusTargetChange?.(null);
          focusBlockById(prev.id, joinAt);
          return;
        }

        // Demote heading above into this TEXT.
        if (value && isHeadingBlockType(prev?.type)) {
          e.preventDefault();
          const title = String(prev.title || "");
          const joiner = title && value ? "\n" : "";
          const merged = `${title}${joiner}${value}`;
          const joinAt = title.length + joiner.length;
          const next = current
            .map((b, i) => (i === blockIndex ? { ...b, text: merged } : b))
            .filter((_, i) => i !== blockIndex - 1);
          updateBlocks(next);
          onFocusTargetChange?.(null);
          focusBlockById(block.id, joinAt);
          return;
        }

        if (!value && current.length > 1) {
          e.preventDefault();
          const next = current.filter((_, i) => i !== blockIndex);
          updateBlocks(next.length ? next : [createEmptyTextBlock()]);
          onFocusTargetChange?.(null);
          focusBlockById(prev?.id, "end");
          return;
        }

        if (value && prev) {
          e.preventDefault();
          focusBlockById(prev.id, "end");
          return;
        }
      }

      if (confirmLibraryHash()) return;

      if (slashEnabled && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        if (slash) {
          const parsed = parseSlashQuery(slash.slice(1));
          if (parsed) {
            e.preventDefault();
            const nextBlocks = applySlashInTextBlock(current, blockIndex, parsed);
            updateBlocks(nextBlocks);
            focusVaultTarget(parsed, nextBlocks, blockIndex, onFocusTargetChange);
            return;
          }
        }
      }

      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        insertNewlineAtCaret(blockIndex, e, blocksRef, updateBlocks);
        return;
      }

      if (e.key === "Escape" && slash) {
        const { prefix } = splitBodyForSlash(block.text);
        e.preventDefault();
        updateBlockAt(blockIndex, { text: prefix });
        return;
      }

      return;
    }

    if (confirmLibraryHash()) return;

    // Slash command confirm (e.g. /macronodo) — keep existing behavior.
    if (slashEnabled && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const { slash } = splitBodyForSlash(block.text);
      if (slash) {
        const parsed = parseSlashQuery(slash.slice(1));
        if (parsed) {
          e.preventDefault();
          const nextBlocks = applySlashInTextBlock(current, blockIndex, parsed);
          updateBlocks(nextBlocks);
          focusVaultTarget(parsed, nextBlocks, blockIndex, onFocusTargetChange);
          return;
        }
      }
    }

    // Shift+Enter → newline inside the same cell (native textarea behavior).
    if (e.key === "Enter" && e.shiftKey) return;

    // Enter → move to the next cell (reuse the empty one below or create it).
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const after = current[blockIndex + 1];

      if (after?.type === NODE_BLOCK_TYPES.TEXT && !(after.text || "").trim()) {
        onFocusTargetChange?.(null);
        focusBlockById(after.id, 0);
        return;
      }

      const newBlock = createEmptyTextBlock();
      const next = [
        ...current.slice(0, blockIndex + 1),
        newBlock,
        ...current.slice(blockIndex + 1),
      ];
      updateBlocks(next);
      onFocusTargetChange?.(null);
      focusBlockById(newBlock.id, 0);
      return;
    }

    // Backspace at start → merge with / move to the previous cell.
    if (e.key === "Backspace" && isAtInputStart(e)) {
      if (blockIndex === 0) return;
      const prev = current[blockIndex - 1];
      const value = e.currentTarget.value ?? block.text ?? "";

      if (value && prev?.type === NODE_BLOCK_TYPES.TEXT) {
        e.preventDefault();
        const joinAt = (prev.text || "").length;
        const mergedResult = mergeMentionBlocks(
          prev.text || "",
          prev.mentions || [],
          value,
          block.mentions || [],
          "",
        );
        const mergedNames = mergeLibraryNameRefBlocks(
          prev.text || "",
          prev.libraryNameRefs || [],
          value,
          block.libraryNameRefs || [],
          "",
        );
        const mergedMarkers = mergeBlockMarkerRanges(
          { text: prev.text || "", markerRanges: prev.markerRanges || [] },
          { text: value, markerRanges: block.markerRanges || [] },
          "",
        );
        const mergedBolds = mergeBlockBoldRanges(
          { text: prev.text || "", boldRanges: prev.boldRanges || [] },
          { text: value, boldRanges: block.boldRanges || [] },
          "",
        );
        const next = current
          .map((b, i) => (i === blockIndex - 1
            ? {
              ...b,
              text: mergedResult.text,
              mentions: mergedResult.mentions.length ? mergedResult.mentions : undefined,
              libraryNameRefs: mergedNames.libraryNameRefs.length
                ? mergedNames.libraryNameRefs
                : undefined,
              markerRanges: mergedMarkers.length ? mergedMarkers : undefined,
              boldRanges: mergedBolds.length ? mergedBolds : undefined,
            }
            : b))
          .filter((_, i) => i !== blockIndex);
        updateBlocks(next);
        onFocusTargetChange?.(null);
        focusBlockById(prev.id, joinAt);
        return;
      }

      // Demote heading above into this TEXT.
      if (value && isHeadingBlockType(prev?.type)) {
        e.preventDefault();
        const title = String(prev.title || "");
        const joiner = title && value ? "\n" : "";
        const merged = `${title}${joiner}${value}`;
        const joinAt = title.length + joiner.length;
        const next = current
          .map((b, i) => (i === blockIndex ? { ...b, text: merged } : b))
          .filter((_, i) => i !== blockIndex - 1);
        updateBlocks(next);
        onFocusTargetChange?.(null);
        focusBlockById(block.id, joinAt);
        return;
      }

      if (!value && current.length > 1) {
        e.preventDefault();
        const next = current.filter((_, i) => i !== blockIndex);
        updateBlocks(next.length ? next : [createEmptyTextBlock()]);
        onFocusTargetChange?.(null);
        focusBlockById(prev?.id, "end");
        return;
      }

      // Non-empty text with a non-text block above — just move focus up.
      if (value && prev) {
        e.preventDefault();
        focusBlockById(prev.id, "end");
      }
    }
  }, [contentFocusMode, focusBlockById, onFocusTargetChange, onLibrarySlashAction, parseSlashQuery, slashEnabled, updateBlockAt, updateBlocks]);

  const handleTodoItemKeyDown = useCallback((blockIndex, itemIndex, e) => {
    const block = blocksRef.current[blockIndex];
    if (!block || block.type !== NODE_BLOCK_TYPES.TODO) return;

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
      updateBlockAt(blockIndex, { items: nextItems });
      onFocusTargetChange?.({ blockIndex, itemId: newItem.id });
      return;
    }

    const atStart = isAtInputStart(e);
    const inputValue = e.currentTarget?.value ?? item.text ?? "";
    if ((e.key === "Backspace" || e.key === "Delete") && !inputValue && atStart && items.length > 1) {
      e.preventDefault();
      const nextItems = items.filter((_, index) => index !== itemIndex);
      updateBlockAt(blockIndex, { items: nextItems });
      const focusTargetItem = nextItems[Math.min(itemIndex, nextItems.length - 1)];
      onFocusTargetChange?.({ blockIndex, itemId: focusTargetItem?.id ?? null });
    }
  }, [onFocusTargetChange, updateBlockAt]);

  const normalizedBlocks = normalizeWritingBlocks(blocks);
  // Collapsed view: hide extra trailing empty cells (data stays; focus shows all).
  const hideTrailingEmptyFrom = contentFocusMode
    ? normalizedBlocks.length
    : getHideTrailingEmptyFromIndex(normalizedBlocks);

  // Show the "Escribe aquí…" placeholder on a single cell only: the focused one,
  // or (when nothing is focused) the first empty text cell.
  const placeholderTextBlockId = (() => {
    if (focusedBlockId) {
      const focused = normalizedBlocks.find((b) => b.id === focusedBlockId);
      if (focused?.type === NODE_BLOCK_TYPES.TEXT) return focusedBlockId;
    }
    const firstEmpty = normalizedBlocks.find(
      (b) => b.type === NODE_BLOCK_TYPES.TEXT && !(b.text || "").trim(),
    );
    return firstEmpty?.id ?? null;
  })();

  const renderHeadingBlock = (block, blockIndex, {
    View,
    stackClass,
    placeholder,
    linksEnabled,
    deleteLabel,
    showDeleteAction = false,
  }) => (
    <div
      key={block.id}
      data-writing-block-id={block.id}
      className={stackClass}
    >
      <View
        value={block.title}
        onChange={(title) => updateBlockAt(blockIndex, { title })}
        onKeyDown={(e) => handleHeadingKeyDown(blockIndex, e)}
        onFocus={() => {
          setFocusedBlockId(block.id);
          onFocusTargetChange?.({ blockIndex, focusHeading: true });
        }}
        linksEnabled={linksEnabled}
        placeholder={placeholder}
        autoFocus={isHeadingFocusTarget(focusTarget, blockIndex)}
      />
      {showDeleteAction ? (
        <LinkedNodeDocActions
          onDetach={() => removeBlockAt(blockIndex)}
          label={deleteLabel}
        />
      ) : null}
    </div>
  );

  return (
    <>
    <div
      ref={stackRef}
      className={`node-writing-block-stack${className ? ` ${className}` : ""}`}
    >
      {selectionBubble}
      {normalizedBlocks.map((block, blockIndex) => {
        if (
          blockIndex >= hideTrailingEmptyFrom
          && block.type === NODE_BLOCK_TYPES.TEXT
          && !block.embedded
          && !(block.text || "").trim()
        ) {
          return null;
        }

        if (block.type === NODE_BLOCK_TYPES.H1) {
          const isMacronodo = Boolean(block.macronodeHeading);
          return renderHeadingBlock(block, blockIndex, {
            View: H1BlockView,
            stackClass: "node-writing-block-stack__h1",
            placeholder: isMacronodo ? "Create a title" : "Heading 1",
            linksEnabled: isMacronodo,
            deleteLabel: "Eliminar macronodo",
            showDeleteAction: isMacronodo,
          });
        }

        if (block.type === NODE_BLOCK_TYPES.H2) {
          return renderHeadingBlock(block, blockIndex, {
            View: H2BlockView,
            stackClass: "node-writing-block-stack__h2",
            placeholder: "Heading 2",
            linksEnabled: false,
          });
        }

        if (block.type === NODE_BLOCK_TYPES.H3) {
          return renderHeadingBlock(block, blockIndex, {
            View: H3BlockView,
            stackClass: "node-writing-block-stack__h3",
            placeholder: "Heading 3",
            linksEnabled: false,
          });
        }

        if (block.type === NODE_BLOCK_TYPES.TODO) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__todo"
            >
              <DocTodoPlanBlockView
                listTitle={block.listTitle}
                onListTitleChange={(listTitle) => updateBlockAt(blockIndex, { listTitle })}
                linksEnabled={false}
                showDragHandle={false}
                items={block.items}
                focusItemId={
                  focusTarget?.blockIndex === blockIndex ? focusTarget.itemId : null
                }
                onItemsChange={(items) => updateBlockAt(blockIndex, { items })}
                onItemKeyDown={(itemIndex, e) => handleTodoItemKeyDown(blockIndex, itemIndex, e)}
                onAddItem={() => {
                  const newItem = createTodoItem({ text: "" });
                  updateBlockAt(blockIndex, { items: [...block.items, newItem] });
                  onFocusTargetChange?.({ blockIndex, itemId: newItem.id });
                }}
                onDetachFromNode={() => removeBlockAt(blockIndex)}
                detachFromNodeLabel="Eliminar lista"
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.CODE) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__code"
            >
              <CodeBlockView
                language={block.language}
                code={block.code}
                codeSaved={Boolean(block.codeSaved)}
                compact
                autoFocus={
                  focusTarget?.blockIndex === blockIndex
                  && focusTarget?.focusCode
                  && !block.codeSaved
                }
                onLanguageChange={(language) => updateBlockAt(blockIndex, { language, codeSaved: false })}
                onCodeChange={(code) => updateBlockAt(blockIndex, { code, codeSaved: false })}
                onSave={() => {
                  if (!(block.code || "").trim()) return;
                  updateBlockAt(blockIndex, { codeSaved: true });
                  onFocusTargetChange?.(null);
                }}
                onEdit={() => {
                  updateBlockAt(blockIndex, { codeSaved: false });
                  onFocusTargetChange?.({ blockIndex, focusCode: true });
                }}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.code")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.PASSWORD_VAULT) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__vault"
            >
              <PasswordVaultBlockView
                slashStack
                entries={companyObjectId ? [] : (block.entries || [])}
                compact
                openAddForm={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusVault
                }
                onSaveEntry={companyObjectId ? (entry) => {
                  queuePasswordTableEntry(companyObjectId, entry);
                  removeBlockAt(blockIndex);
                } : null}
                onEntriesChange={companyObjectId ? undefined : (entries) => updateBlockAt(blockIndex, { entries })}
                onDeleteVault={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.password")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.LINK_VAULT) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__vault"
            >
              <LinkVaultBlockView
                multilineDescription
                slashStack
                objectId={companyObjectId}
                entries={companyObjectId ? [] : (block.entries || [])}
                compact
                openAddForm={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusVault
                }
                onSaveEntry={companyObjectId ? (entry) => {
                  const stored = queueUrlTableEntry(companyObjectId, entry);
                  if (!stored) return null;
                  removeBlockAt(blockIndex);
                  return stored;
                } : null}
                onEntriesChange={companyObjectId ? undefined : (entries) => updateBlockAt(blockIndex, { entries })}
                onDeleteVault={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.link")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.AGENT) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__agent"
            >
              <AgentBlockView
                instruction={block.instruction || ""}
                compact
                autoFocus={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusAgent
                }
                onInstructionChange={(instruction) => updateBlockAt(blockIndex, { instruction })}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.agent")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.STEP_SEQUENCE) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__steps"
            >
              <StepSequenceBlockView
                blockId={block.id}
                title={block.title || ""}
                steps={block.steps || []}
                saved={Boolean(block.saved)}
                compact
                autoFocus={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusSteps
                }
                onTitleChange={(nextTitle) => updateBlockAt(blockIndex, { title: nextTitle })}
                onStepsChange={(steps) => updateBlockAt(blockIndex, { steps })}
                onSavedChange={(finalizedSteps) => {
                  updateBlockAt(blockIndex, { steps: finalizedSteps, saved: true });
                }}
                onEditRequest={() => updateBlockAt(blockIndex, { saved: false })}
                onDeleteBlock={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.stepSequence")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.IMAGE) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__image"
            >
              <ImageBlockView
                block={block}
                onChange={(patch) => {
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex ? { ...entry, ...patch, type: NODE_BLOCK_TYPES.IMAGE } : entry
                  ));
                  if (patch.imageSaved && patch.src) {
                    next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  }
                  updateBlocks(next);
                }}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.image")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.IMAGE_SPLIT) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__image-split"
            >
              <ImageSplitBlockView
                block={block}
                libraryOwnerKind={libraryOwnerKind}
                libraryOwnerId={libraryOwnerId}
                folderLibraryId={folderLibraryId}
                onChange={(patch) => {
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, ...patch, type: NODE_BLOCK_TYPES.IMAGE_SPLIT }
                      : entry
                  ));
                  if (imageSplitHasFill({ ...block, ...patch })) {
                    next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  }
                  updateBlocks(next);
                }}
                onSave={() => {
                  if (!imageSplitHasFill(block)) return;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, splitSaved: true, type: NODE_BLOCK_TYPES.IMAGE_SPLIT }
                      : entry
                  ));
                  next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  updateBlocks(next);
                  const after = next[blockIndex + 1];
                  if (after?.type === NODE_BLOCK_TYPES.TEXT) {
                    onFocusTargetChange?.({ blockIndex: blockIndex + 1, focusText: true });
                  }
                }}
                onEdit={() => {
                  updateBlockAt(blockIndex, { splitSaved: false });
                  onFocusTargetChange?.({ blockIndex, focusImageSplit: true });
                }}
                onConvertLayout={(targetType) => {
                  const converted = convertImageLayoutBlock(block, targetType);
                  if (!converted) return;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex ? { ...converted, type: converted.type } : entry
                  ));
                  updateBlocks(normalizeWritingBlocks(next));
                }}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.imageSplit")}
                onBodyFocus={() => {
                  onFocusTargetChange?.({ blockIndex, focusImageSplit: true });
                }}
                focusTodoItemId={
                  block.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
                    ? focusTarget?.itemId ?? null
                    : null
                }
                autoFocusBody={
                  focusTarget?.blockIndex === blockIndex
                  && Boolean(focusTarget?.focusImageSplit || focusTarget?.focusHeading)
                }
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.MOODBOARD) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__moodboard"
            >
              <MoodboardBlockView
                block={block}
                slashGhostHints={slashGhostHints}
                onChange={(patch) => {
                  const patchHasSavedImage = Array.isArray(patch.columns)
                    && countMoodboardSavedImages(patch) > 0;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, ...patch, type: NODE_BLOCK_TYPES.MOODBOARD }
                      : entry
                  ));
                  if (patchHasSavedImage) {
                    next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  }
                  updateBlocks(next);
                }}
                onSave={() => {
                  if (countMoodboardSavedImages(block) < 1) return;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, moodboardSaved: true, type: NODE_BLOCK_TYPES.MOODBOARD }
                      : entry
                  ));
                  next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  updateBlocks(next);
                  const after = next[blockIndex + 1];
                  if (after?.type === NODE_BLOCK_TYPES.TEXT) {
                    onFocusTargetChange?.({ blockIndex: blockIndex + 1, focusText: true });
                  }
                }}
                onEdit={() => {
                  updateBlockAt(blockIndex, { moodboardSaved: false });
                }}
                onConvertLayout={(targetType) => {
                  const converted = convertImageLayoutBlock(block, targetType);
                  if (!converted) return;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex ? { ...converted, type: converted.type } : entry
                  ));
                  updateBlocks(normalizeWritingBlocks(next));
                }}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.moodboard")}
                onBodyKeyDown={undefined}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.BANNER) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__banner"
            >
              <BannerBlockView
                block={block}
                onChange={(patch) => {
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, ...patch, type: NODE_BLOCK_TYPES.BANNER }
                      : entry
                  ));
                  if (patch.imageSaved && patch.src) {
                    next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  }
                  updateBlocks(next);
                }}
                onSave={() => {
                  if (!(block.imageSaved && block.src)) return;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, bannerSaved: true, type: NODE_BLOCK_TYPES.BANNER }
                      : entry
                  ));
                  next = ensureEmptyTextBlockAfterNode(next, blockIndex);
                  updateBlocks(next);
                  const after = next[blockIndex + 1];
                  if (after?.type === NODE_BLOCK_TYPES.TEXT) {
                    onFocusTargetChange?.({ blockIndex: blockIndex + 1, focusText: true });
                  }
                }}
                onEdit={() => {
                  updateBlockAt(blockIndex, { bannerSaved: false });
                }}
                onConvertLayout={(targetType) => {
                  const converted = convertImageLayoutBlock(block, targetType);
                  if (!converted) return;
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex ? { ...converted, type: converted.type } : entry
                  ));
                  updateBlocks(normalizeWritingBlocks(next));
                }}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.banner")}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.PRODUCT_CARD) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__product"
            >
              <ProductCardBlockView
                block={block}
                onChange={(patch) => updateBlockAt(blockIndex, patch)}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.productCard")}
              />
            </div>
          );
        }

        const embeddedWidget = hasRenderableEmbeddedWidget(block.embedded)
          ? (
            <EmbeddedWidgetStack
              embedded={block.embedded}
              onRemove={() => {
                updateBlocks(removeEmbeddedFromWritingBlock(blocksRef.current, blockIndex));
              }}
            />
          )
          : null;

        return (
          <div
            key={block.id}
            data-writing-block-id={block.id}
            className={
              "node-writing-block-stack__text"
              + (contentFocusMode ? " doc-text-block" : "")
              + (embeddedWidget ? " node-writing-block-stack__text--embedded" : "")
            }
          >
            {embeddedWidget}
            {contentFocusMode ? (
              <SlashAwareTextarea
                inputRef={(el) => {
                  if (el) {
                    inputRefs.current[block.id] = el;
                  } else {
                    delete inputRefs.current[block.id];
                  }
                }}
                value={block.text}
                mentions={block.mentions || []}
                tagRefs={block.tagRefs || []}
                libraryNameRefs={block.libraryNameRefs || []}
                librarySpeakRefs={block.librarySpeakRefs || []}
                libraryNameCandidates={libraryNameCandidates}
                libraryAssignFiles={libraryAssignFiles}
                libraryAssignAssets={libraryAssignAssets}
                onLibraryAssignSelect={handleLibraryAssignSelect}
                mentionCandidates={mentionCandidates}
                companyObjectId={companyObjectId}
                markerRanges={block.markerRanges || []}
                boldRanges={block.boldRanges || []}
                onChange={(text, meta) => {
                  const h1Caret = findH1MarkdownShortcutCaret(text);
                  if (h1Caret >= 0) {
                    const applied = applyH1MarkdownShortcutToNodeBlocks(
                      normalizeWritingBlocks(blocksRef.current),
                      blockIndex,
                      text,
                      h1Caret,
                    );
                    if (applied) {
                      updateBlocks(applied.blocks);
                      onFocusTargetChange?.(null);
                      focusBlockById(applied.h1Id, 0);
                      return;
                    }
                  }
                  applyTextBlockChange(blockIndex, text, meta);
                }}
                onKeyDown={(e) => handleTextKeyDown(blockIndex, e)}
                onFocus={(e) => {
                  setFocusedBlockId(block.id);
                  snapshotWritingCaret(blockIndex, e?.target);
                  onFocusTargetChange?.({ blockIndex, focusText: true });
                }}
                onBlur={(e) => {
                  setFocusedBlockId((cur) => (cur === block.id ? null : cur));
                  snapshotWritingCaret(blockIndex, e?.target);
                }}
                placeholder={block.id === placeholderTextBlockId ? textPlaceholder : ""}
                showPlaceholder={block.id === placeholderTextBlockId}
                autoFocus={focusTarget?.blockIndex === blockIndex && focusTarget?.focusText}
                wrapClassName="doc-text-block__wrap"
                className="doc-text-block__field"
                minHeightPx={28}
                maxHeightPx={null}
                ghostHints={slashGhostHints}
              />
            ) : (
              <div onMouseDown={(e) => e.stopPropagation()}>
                <SlashAwareTextarea
                  inputRef={(el) => {
                    if (el) {
                      inputRefs.current[block.id] = el;
                    } else {
                      delete inputRefs.current[block.id];
                    }
                  }}
                  value={block.text}
                  mentions={block.mentions || []}
                  tagRefs={block.tagRefs || []}
                  libraryNameRefs={block.libraryNameRefs || []}
                  librarySpeakRefs={block.librarySpeakRefs || []}
                  libraryNameCandidates={libraryNameCandidates}
                  libraryAssignFiles={libraryAssignFiles}
                  libraryAssignAssets={libraryAssignAssets}
                  onLibraryAssignSelect={handleLibraryAssignSelect}
                  mentionCandidates={mentionCandidates}
                  companyObjectId={companyObjectId}
                  markerRanges={block.markerRanges || []}
                  boldRanges={block.boldRanges || []}
                  onChange={(text, meta) => {
                    const h1Caret = findH1MarkdownShortcutCaret(text);
                    if (h1Caret >= 0) {
                      const applied = applyH1MarkdownShortcutToNodeBlocks(
                        normalizeWritingBlocks(blocksRef.current),
                        blockIndex,
                        text,
                        h1Caret,
                      );
                      if (applied) {
                        updateBlocks(applied.blocks);
                        onFocusTargetChange?.(null);
                        focusBlockById(applied.h1Id, 0);
                        return;
                      }
                    }
                    applyTextBlockChange(blockIndex, text, meta);
                  }}
                  onKeyDown={(e) => handleTextKeyDown(blockIndex, e)}
                  onFocus={(e) => {
                    setFocusedBlockId(block.id);
                    snapshotWritingCaret(blockIndex, e?.target);
                    onFocusTargetChange?.({ blockIndex, focusText: true });
                  }}
                  onBlur={(e) => {
                    setFocusedBlockId((cur) => (cur === block.id ? null : cur));
                    snapshotWritingCaret(blockIndex, e?.target);
                  }}
                  placeholder={block.id === placeholderTextBlockId ? textPlaceholder : ""}
                  showPlaceholder={block.id === placeholderTextBlockId}
                  autoFocus={focusTarget?.blockIndex === blockIndex && focusTarget?.focusText}
                  className="node-writing-text-field doc-normal-text-field"
                  minHeightPx={28}
                  maxHeightPx={null}
                  ghostHints={slashGhostHints}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
    {promptCapture ? (
      <LibraryPromptCaptureModal
        prompt={promptCapture.prompt}
        libraryNameRefs={promptCapture.libraryNameRefs || []}
        librarySpeakRefs={promptCapture.librarySpeakRefs || []}
        ownerKind={libraryOwnerKind}
        ownerId={libraryOwnerId}
        onClose={() => setPromptCapture(null)}
        onSaved={(item) => {
          setPromptCapture(null);
          if (!item?.id) return;
          if (item.setId) setSavedPromptAssetId(item.setId);
          else setSavedPromptItemId(item.id);
        }}
      />
    ) : null}
    {savedPromptAssetId && libraryOwnerId ? (
      <FolderLibraryAssetDetail
        ownerKind={libraryOwnerKind}
        ownerId={libraryOwnerId}
        folderLibraryId={folderLibraryId}
        assetId={savedPromptAssetId}
        allowDownload={false}
        pendingClone={
          pendingAssignClone?.assetId === savedPromptAssetId
            ? pendingAssignClone.file
            : null
        }
        onSavePendingClone={handleSavePendingAssignClone}
        onOpenItem={handleOpenAssetItem}
        onClose={handleCloseAssetDetail}
      />
    ) : null}
    {savedPromptItemId && libraryOwnerId ? (
      <FolderLibraryImageDetail
        ownerKind={libraryOwnerKind}
        ownerId={libraryOwnerId}
        folderId={libraryOwnerId}
        itemId={savedPromptItemId}
        onClose={() => setSavedPromptItemId(null)}
      />
    ) : null}
    </>
  );
}
