import { useCallback, useEffect, useRef } from "react";
import { createTodoItem } from "../../lib/docBlocks.js";
import { DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";
import { parseNodeSlashQuery, splitBodyForSlash } from "../../lib/docBlockSlash.js";
import {
  applySlashInTextBlock,
  createEmptyTextBlock,
  insertBlockAfterIndex,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  removeWritingBlockAt,
} from "../../lib/nodeInlineContent.js";
import { isHeadingBlockType } from "../../lib/textSelectionHeading.js";
import { syncAutoGrowTextareaHeight } from "../../lib/textareaSelectionRect.js";
import { H1BlockView } from "../docs/blocks/H1BlockView.jsx";
import { H2BlockView } from "../docs/blocks/H2BlockView.jsx";
import { H3BlockView } from "../docs/blocks/H3BlockView.jsx";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";
import { CodeBlockView } from "../docs/blocks/CodeBlockView.jsx";
import { PasswordVaultBlockView } from "../docs/blocks/PasswordVaultBlockView.jsx";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { AgentBlockView } from "../docs/blocks/AgentBlockView.jsx";
import { StepSequenceBlockView } from "../docs/blocks/StepSequenceBlockView.jsx";
import { LinkedNodeDocActions } from "../docs/blocks/LinkedNodeDocActions.jsx";
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

export function NodeWritingBlockStack({
  blocks,
  onBlocksChange,
  focusTarget = null,
  onFocusTargetChange,
  slashEnabled = false,
  className = "",
  textPlaceholder = "Escribe aquí o /macronodo",
}) {
  const inputRefs = useRef({});
  const stackRef = useRef(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

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

  const handleTextSlashKeyDown = useCallback((blockIndex, e) => {
    if (!slashEnabled) return;
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;

    const block = blocksRef.current[blockIndex];
    if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return;

    const { slash } = splitBodyForSlash(block.text);
    if (!slash) return;

    const parsed = parseNodeSlashQuery(slash.slice(1));
    if (!parsed) return;

    e.preventDefault();
    const nextBlocks = applySlashInTextBlock(blocksRef.current, blockIndex, parsed);
    updateBlocks(nextBlocks);
    focusVaultTarget(parsed, nextBlocks, blockIndex, onFocusTargetChange);
  }, [onFocusTargetChange, slashEnabled, updateBlocks]);

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

  const renderHeadingBlock = (block, blockIndex, {
    View,
    stackClass,
    placeholder,
    linksEnabled,
    deleteLabel,
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
      <LinkedNodeDocActions
        onDetach={() => removeBlockAt(blockIndex)}
        label={deleteLabel}
      />
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
          return renderHeadingBlock(block, blockIndex, {
            View: H1BlockView,
            stackClass: "node-writing-block-stack__h1",
            placeholder: "Create a title",
            linksEnabled: true,
            deleteLabel: "Eliminar macronodo",
          });
        }

        if (block.type === NODE_BLOCK_TYPES.H2) {
          return renderHeadingBlock(block, blockIndex, {
            View: H2BlockView,
            stackClass: "node-writing-block-stack__h2",
            placeholder: "Heading 2",
            linksEnabled: false,
            deleteLabel: "Eliminar encabezado",
          });
        }

        if (block.type === NODE_BLOCK_TYPES.H3) {
          return renderHeadingBlock(block, blockIndex, {
            View: H3BlockView,
            stackClass: "node-writing-block-stack__h3",
            placeholder: "Heading 3",
            linksEnabled: false,
            deleteLabel: "Eliminar encabezado",
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
                onDelete={() => removeBlockAt(blockIndex)}
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
                entries={block.entries || []}
                compact
                openAddForm={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusVault
                }
                onEntriesChange={(entries) => updateBlockAt(blockIndex, { entries })}
                onDeleteVault={() => removeBlockAt(blockIndex)}
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
                entries={block.entries || []}
                compact
                openAddForm={
                  focusTarget?.blockIndex === blockIndex && focusTarget?.focusVault
                }
                onEntriesChange={(entries) => updateBlockAt(blockIndex, { entries })}
                onDeleteVault={() => removeBlockAt(blockIndex)}
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
                onDelete={() => removeBlockAt(blockIndex)}
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
                onDeleteBlock={() => removeBlockAt(blockIndex)}
              />
            </div>
          );
        }

        return (
          <div
            key={block.id}
            data-writing-block-id={block.id}
            className="node-writing-block-stack__text"
          >
            <textarea
              ref={(el) => {
                if (el) {
                  inputRefs.current[block.id] = el;
                  syncTextareaHeight(el);
                } else {
                  delete inputRefs.current[block.id];
                }
              }}
              className="node-writing-text-field"
              value={block.text}
              placeholder={textPlaceholder}
              rows={1}
              onChange={(e) => {
                updateBlockAt(blockIndex, { text: e.target.value });
                syncTextareaHeight(e.target);
              }}
              onKeyDown={(e) => handleTextSlashKeyDown(blockIndex, e)}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        );
      })}
    </div>
  );
}
