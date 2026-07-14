import { useCallback, useEffect, useRef, useState } from "react";
import { createTodoItem } from "../../lib/docBlocks.js";
import { DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";
import {
  DOCUMENT_SLASH_GHOST_HINTS,
  parseNodeSlashQuery,
  splitBodyForSlash,
} from "../../lib/docBlockSlash.js";
import {
  applySlashInTextBlock,
  createEmptyTextBlock,
  ensureEmptyTextBlockAfterNode,
  insertBlockAfterIndex,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  removeWritingBlockAt,
} from "../../lib/nodeInlineContent.js";
import { isHeadingBlockType } from "../../lib/textSelectionHeading.js";
import { syncAutoGrowTextareaHeight, scrollTextareaCaretIntoCameraView } from "../../lib/textareaSelectionRect.js";
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
import { ProductCardBlockView } from "../docs/blocks/ProductCardBlockView.jsx";
import { LinkedNodeDocActions } from "../docs/blocks/LinkedNodeDocActions.jsx";
import { queueUrlTableEntry } from "../../lib/urlTableSession.js";
import { queuePasswordTableEntry } from "../../lib/passwordTableSession.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useNodeTextSelectionToolbar } from "./useNodeTextSelectionToolbar.jsx";

function syncTextareaHeight(el) {
  syncAutoGrowTextareaHeight(el);
}

function isAtInputStart(e) {
  const target = e.target;
  if (!target || !("selectionStart" in target)) return false;
  return target.selectionStart === 0 && target.selectionEnd === 0;
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
  const caretStart = el.selectionStart ?? 0;
  const caretEnd = el.selectionEnd ?? caretStart;
  const text = el.value ?? "";
  const nextText = `${text.slice(0, caretStart)}\n${text.slice(caretEnd)}`;
  const blockId = blocksRef.current[blockIndex]?.id;
  if (!blockId) return;

  const current = normalizeWritingBlocks(blocksRef.current);
  updateBlocks(current.map((block, index) => (
    index === blockIndex ? { ...block, text: nextText } : block
  )));

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
  slashEnabled = false,
  contentFocusMode = false,
  className = "",
  textPlaceholder = "Escribe aquí o /macronodo",
  companyObjectId = null,
  parseSlashQuery = parseNodeSlashQuery,
  slashGhostHints = DOCUMENT_SLASH_GHOST_HINTS,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const inputRefs = useRef({});
  const stackRef = useRef(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [focusedBlockId, setFocusedBlockId] = useState(null);

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
    const block = normalizeWritingBlocks(blocksRef.current)[focusTarget.blockIndex];
    if (!block?.id) return undefined;

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const root = stackRef.current;
        const scrollParent = root?.closest(".note-taker__content-scroll")
          || root?.closest(".node-query-modal__content-scroll");
        const blockEl = root?.querySelector(`[data-writing-block-id="${block.id}"]`);
        if (blockEl && scrollParent) {
          const blockRect = blockEl.getBoundingClientRect();
          const rootRect = scrollParent.getBoundingClientRect();
          if (blockRect.top < rootRect.top || blockRect.bottom > rootRect.bottom) {
            blockEl.scrollIntoView({ block: "nearest", behavior: "auto" });
          }
        }

        if (focusTarget.focusH1 || focusTarget.focusH2 || focusTarget.focusH3 || focusTarget.focusHeading) {
          const input = blockEl?.querySelector("textarea, input");
          input?.focus({ preventScroll: true });
        }
        if (focusTarget.focusText) {
          const textarea = blockEl?.querySelector("textarea.node-writing-text-field");
          textarea?.focus({ preventScroll: true });
        }
        if (focusTarget.focusAgent) {
          const input = blockEl?.querySelector(".doc-agent-cell__input");
          input?.focus({ preventScroll: true });
        }
      });
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

    if ((e.key === "Backspace" || e.key === "Delete") && titleEmpty && atStart) {
      e.preventDefault();
      removeEmptyHeadingAndFocus(blockIndex);
    }
  }, [onFocusTargetChange, removeEmptyHeadingAndFocus, updateBlocks]);

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
        el.focus({ preventScroll: true });
        if (caret != null && "setSelectionRange" in el) {
          const pos = caret === "end" ? el.value.length : caret;
          el.setSelectionRange(pos, pos);
        }
      });
    };
    attempt();
  }, []);

  const handleTextKeyDown = useCallback((blockIndex, e) => {
    // Render iterates over normalized blocks, so index against the normalized list.
    const current = normalizeWritingBlocks(blocksRef.current);
    const block = current[blockIndex];
    if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return;

    const { slash } = splitBodyForSlash(block.text);

    // Folder expand blueprint: Enter inserts newline in the same cell (SlashAwareTextarea scrolls caret).
    if (contentFocusMode) {
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
        const merged = (prev.text || "") + value;
        const next = current
          .map((b, i) => (i === blockIndex - 1 ? { ...b, text: merged } : b))
          .filter((_, i) => i !== blockIndex);
        updateBlocks(next);
        onFocusTargetChange?.(null);
        focusBlockById(prev.id, joinAt);
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
  }, [contentFocusMode, focusBlockById, onFocusTargetChange, parseSlashQuery, slashEnabled, updateBlockAt, updateBlocks]);

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
    <div
      ref={stackRef}
      className={`node-writing-block-stack${className ? ` ${className}` : ""}`}
    >
      {selectionBubble}
      {normalizedBlocks.map((block, blockIndex) => {
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
                entries={companyObjectId ? [] : (block.entries || [])}
                compact
                openAddForm={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusVault
                }
                onSaveEntry={companyObjectId ? (entry) => {
                  queueUrlTableEntry(companyObjectId, entry);
                  removeBlockAt(blockIndex);
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
                onChange={(patch) => {
                  let next = normalizeWritingBlocks(blocksRef.current);
                  next = next.map((entry, index) => (
                    index === blockIndex
                      ? { ...entry, ...patch, type: NODE_BLOCK_TYPES.IMAGE_SPLIT }
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
                }}
                onDelete={() => confirmRemoveCommandBlock(blockIndex, "doc.blockDelete.imageSplit")}
                onBodyKeyDown={undefined}
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

        return (
          <div
            key={block.id}
            data-writing-block-id={block.id}
            className={
              "node-writing-block-stack__text"
              + (contentFocusMode ? " doc-text-block" : "")
            }
          >
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
                onChange={(text) => updateBlockAt(blockIndex, { text })}
                onKeyDown={(e) => handleTextKeyDown(blockIndex, e)}
                onFocus={() => setFocusedBlockId(block.id)}
                onBlur={() => setFocusedBlockId((cur) => (cur === block.id ? null : cur))}
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
              <textarea
                ref={(el) => {
                  if (el) {
                    inputRefs.current[block.id] = el;
                    syncTextareaHeight(el);
                  } else {
                    delete inputRefs.current[block.id];
                  }
                }}
                className="node-writing-text-field doc-normal-text-field"
                value={block.text}
                placeholder={block.id === placeholderTextBlockId ? textPlaceholder : ""}
                rows={1}
                autoFocus={focusTarget?.blockIndex === blockIndex && focusTarget?.focusText}
                onChange={(e) => {
                  updateBlockAt(blockIndex, { text: e.target.value });
                  syncTextareaHeight(e.target);
                }}
                onKeyDown={(e) => handleTextKeyDown(blockIndex, e)}
                onFocus={() => setFocusedBlockId(block.id)}
                onBlur={() => setFocusedBlockId((cur) => (cur === block.id ? null : cur))}
                onMouseDown={(e) => e.stopPropagation()}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
