import { useCallback, useRef } from "react";
import { createTodoItem } from "../../lib/docBlocks.js";
import { DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";
import { parseNodeSlashQuery, splitBodyForSlash } from "../../lib/docBlockSlash.js";
import {
  applySlashInTextBlock,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "../../lib/nodeInlineContent.js";
import { H1BlockView } from "../docs/blocks/H1BlockView.jsx";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";

function syncTextareaHeight(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function NodeWritingBlockStack({
  blocks,
  onBlocksChange,
  focusTarget = null,
  onFocusTargetChange,
  slashEnabled = false,
  className = "",
  textPlaceholder = "Escribe aquí, o /title o /todo",
}) {
  const inputRefs = useRef({});

  const updateBlocks = useCallback((nextBlocks) => {
    onBlocksChange?.(normalizeWritingBlocks(nextBlocks));
  }, [onBlocksChange]);

  const updateBlockAt = useCallback((index, patch) => {
    updateBlocks(blocks.map((block, blockIndex) => (
      blockIndex === index ? { ...block, ...patch } : block
    )));
  }, [blocks, updateBlocks]);

  const handleTextSlashKeyDown = useCallback((blockIndex, e) => {
    if (!slashEnabled) return;
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;

    const block = blocks[blockIndex];
    if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return;

    const { slash } = splitBodyForSlash(block.text);
    if (!slash) return;

    const parsed = parseNodeSlashQuery(slash.slice(1));
    if (!parsed) return;

    e.preventDefault();
    const nextBlocks = applySlashInTextBlock(blocks, blockIndex, parsed);
    updateBlocks(nextBlocks);

    const insertedIndex = blockIndex + 1;
    if (parsed.type === DOC_BLOCK_TYPES.TODO) {
      const todoBlock = nextBlocks[insertedIndex];
      onFocusTargetChange?.({
        blockIndex: insertedIndex,
        itemId: todoBlock?.items?.[0]?.id ?? null,
      });
    } else {
      onFocusTargetChange?.({ blockIndex: insertedIndex, focusH1: true });
    }
  }, [blocks, onFocusTargetChange, slashEnabled, updateBlocks]);

  const handleTodoItemKeyDown = useCallback((blockIndex, itemIndex, e) => {
    const block = blocks[blockIndex];
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
    }
  }, [blocks, onFocusTargetChange, updateBlockAt]);

  const normalizedBlocks = normalizeWritingBlocks(blocks);

  return (
    <div className={`node-writing-block-stack${className ? ` ${className}` : ""}`}>
      {normalizedBlocks.map((block, blockIndex) => {
        if (block.type === NODE_BLOCK_TYPES.H1) {
          return (
            <div key={block.id} className="node-writing-block-stack__h1">
              <H1BlockView
                value={block.title}
                onChange={(title) => updateBlockAt(blockIndex, { title })}
                linksEnabled={false}
                placeholder="Título"
                autoFocus={focusTarget?.blockIndex === blockIndex && focusTarget?.focusH1}
              />
            </div>
          );
        }

        if (block.type === NODE_BLOCK_TYPES.TODO) {
          return (
            <div key={block.id} className="node-writing-block-stack__todo">
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
              />
            </div>
          );
        }

        return (
          <div key={block.id} className="node-writing-block-stack__text">
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
            />
          </div>
        );
      })}
    </div>
  );
}
