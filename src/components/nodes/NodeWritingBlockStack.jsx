import { useCallback, useEffect, useRef } from "react";
import { createTodoItem } from "../../lib/docBlocks.js";
import { DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";
import { parseNodeSlashQuery, splitBodyForSlash } from "../../lib/docBlockSlash.js";
import {
  applySlashInTextBlock,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  removeWritingBlockAt,
} from "../../lib/nodeInlineContent.js";
import { H1BlockView } from "../docs/blocks/H1BlockView.jsx";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";
import { CodeBlockView } from "../docs/blocks/CodeBlockView.jsx";
import { PasswordVaultBlockView } from "../docs/blocks/PasswordVaultBlockView.jsx";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { LinkedNodeDocActions } from "../docs/blocks/LinkedNodeDocActions.jsx";

function syncTextareaHeight(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function isAtInputStart(e) {
  const target = e.target;
  if (!target || !("selectionStart" in target)) return false;
  return target.selectionStart === 0 && target.selectionEnd === 0;
}

function focusVaultTarget(parsed, blocks, blockIndex, onFocusTargetChange) {
  const vaultNodeType = vaultNodeTypeForParsed(parsed);
  if (vaultNodeType) {
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
  if (vaultNodeType) {
    onFocusTargetChange?.({ blockIndex: insertedIndex, focusVault: true });
    return;
  }
  onFocusTargetChange?.({ blockIndex: insertedIndex, focusH1: true });
}

function vaultNodeTypeForParsed(parsed) {
  if (parsed?.type === DOC_BLOCK_TYPES.PASSWORD_VAULT) return NODE_BLOCK_TYPES.PASSWORD_VAULT;
  if (parsed?.type === DOC_BLOCK_TYPES.LINK_VAULT) return NODE_BLOCK_TYPES.LINK_VAULT;
  return null;
}

function findLastVaultBlockIndex(blocks, vaultNodeType) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type === vaultNodeType) return index;
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
  textPlaceholder = "Escribe aquí o /title",
}) {
  const inputRefs = useRef({});
  const stackRef = useRef(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => {
    if (focusTarget?.blockIndex == null) return undefined;
    const block = normalizeWritingBlocks(blocks)[focusTarget.blockIndex];
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
            blockEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }

        if (focusTarget.focusH1) {
          const input = blockEl?.querySelector("textarea, input");
          input?.focus({ preventScroll: true });
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [blocks, focusTarget]);

  const updateBlocks = useCallback((nextBlocks) => {
    onBlocksChange?.(normalizeWritingBlocks(nextBlocks));
  }, [onBlocksChange]);

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

  const focusNextTextBlock = useCallback((afterIndex) => {
    onFocusTargetChange?.(null);
    requestAnimationFrame(() => {
      const normalized = normalizeWritingBlocks(blocksRef.current);
      focusTextBlockAfter(inputRefs, normalized, afterIndex);
    });
  }, [onFocusTargetChange]);

  const removeEmptyH1AndFocus = useCallback((h1Index) => {
    const current = normalizeWritingBlocks(blocksRef.current);
    const h1 = current[h1Index];
    if (!h1 || h1.type !== NODE_BLOCK_TYPES.H1) return;

    const next = removeWritingBlockAt(current, h1Index);
    updateBlocks(next);
    onFocusTargetChange?.(null);
    requestAnimationFrame(() => {
      focusTextBlockAfter(inputRefs, next, h1Index - 1);
    });
  }, [onFocusTargetChange, updateBlocks]);

  const handleH1KeyDown = useCallback((blockIndex, e) => {
    const block = blocksRef.current[blockIndex];
    if (!block || block.type !== NODE_BLOCK_TYPES.H1) return;

    const fieldValue = e.currentTarget?.value ?? block.title ?? "";
    const titleEmpty = !fieldValue.trim();
    const atStart = isAtInputStart(e);

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (titleEmpty) {
        removeEmptyH1AndFocus(blockIndex);
        return;
      }
      e.currentTarget?.blur();
      focusNextTextBlock(blockIndex);
      return;
    }

    if ((e.key === "Backspace" || e.key === "Delete") && titleEmpty && atStart) {
      e.preventDefault();
      removeEmptyH1AndFocus(blockIndex);
    }
  }, [focusNextTextBlock, removeEmptyH1AndFocus]);

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

  return (
    <div
      ref={stackRef}
      className={`node-writing-block-stack${className ? ` ${className}` : ""}`}
    >
      {normalizedBlocks.map((block, blockIndex) => {
        if (block.type === NODE_BLOCK_TYPES.H1) {
          return (
            <div
              key={block.id}
              data-writing-block-id={block.id}
              className="node-writing-block-stack__h1"
            >
              <H1BlockView
                value={block.title}
                onChange={(title) => updateBlockAt(blockIndex, { title })}
                onKeyDown={(e) => handleH1KeyDown(blockIndex, e)}
                linksEnabled={false}
                placeholder="Título"
                autoFocus={focusTarget?.blockIndex === blockIndex && focusTarget?.focusH1}
              />
              <LinkedNodeDocActions
                onDetach={() => removeBlockAt(blockIndex)}
                label="Eliminar título"
              />
            </div>
          );
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
