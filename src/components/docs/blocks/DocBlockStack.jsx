import { useEffect, useState } from "react";
import {
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  insertBlockAfter,
  removeBlockAt,
  replaceBlocksFromSlashInText,
  updateBlockAt,
} from "../../../lib/docBlocks.js";
import { parseSlashQuery, splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import { getH1IndexForTextBlock } from "../../../lib/docNodeSync.js";
import { H1BlockView } from "./H1BlockView.jsx";
import { TextBlockView } from "./TextBlockView.jsx";
import { TodoBlockView } from "./TodoBlockView.jsx";

export function DocBlockStack({
  blocks,
  onBlocksChange,
  focusBlockId = null,
  onFocusBlock,
  bodyPlaceholder,
  onBodyKeyDown,
  onOpenNodeForH1,
  onAnswerBelowH1Change,
}) {
  const [todoFocusItemId, setTodoFocusItemId] = useState(null);

  useEffect(() => {
    if (!focusBlockId) return;
    const el = document.querySelector(`[data-block-id="${focusBlockId}"]`);
    if (el instanceof HTMLElement) {
      const input = el.querySelector("input, textarea");
      input?.focus();
    }
  }, [focusBlockId, blocks.length]);

  const setBlocks = (next) => onBlocksChange?.(next);

  const updateAt = (index, patch) => {
    setBlocks(updateBlockAt(blocks, index, patch));
  };

  const insertTextAfter = (index) => {
    const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
    const next = insertBlockAfter(blocks, index, textBlock);
    setBlocks(next);
    onFocusBlock?.(textBlock.id);
    return textBlock.id;
  };

  const handleDragPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const tryConfirmSlashInText = (blockIndex, textValue) => {
    const { slash } = splitBodyForSlash(textValue);
    if (!slash) return false;
    const parsed = parseSlashQuery(slash.slice(1));
    if (!parsed) return false;

    let newBlock;
    if (parsed.type === DOC_BLOCK_TYPES.TODO) {
      newBlock = createDocBlock(DOC_BLOCK_TYPES.TODO, {
        items: [createTodoItem()],
        listTitle: "To do:",
      });
    } else if (parsed.type === DOC_BLOCK_TYPES.H1) {
      newBlock = createDocBlock(DOC_BLOCK_TYPES.H1, { title: "" });
    } else {
      return false;
    }

    const next = replaceBlocksFromSlashInText(blocks, blockIndex, textValue, newBlock);
    setBlocks(next);
    onFocusBlock?.(newBlock.id);
    return newBlock.id;
  };

  const handleTextKeyDown = (blockIndex, e, textValue) => {
    const { slash } = splitBodyForSlash(textValue);

    if (e.key === "Enter" && !e.shiftKey && slash) {
      const newId = tryConfirmSlashInText(blockIndex, textValue);
      if (newId) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === "Escape" && slash) {
      const { prefix } = splitBodyForSlash(textValue);
      e.preventDefault();
      updateAt(blockIndex, { text: prefix });
      return;
    }

    onBodyKeyDown?.(e);
  };

  const handleTodoItemKeyDown = (index, itemIndex, e) => {
    const block = blocks[index];
    if (!block || block.type !== DOC_BLOCK_TYPES.TODO) return;

    const items = block.items || [];
    const item = items[itemIndex];
    if (!item) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertTextAfter(index);
      return;
    }

    const atStart = e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0;
    if ((e.key === "Backspace" || e.key === "Delete") && !item.text && atStart) {
      e.preventDefault();
      if (items.length > 1) {
        const nextItems = items.filter((_, i) => i !== itemIndex);
        updateAt(index, { items: nextItems });
        const focusTarget = nextItems[Math.min(itemIndex, nextItems.length - 1)];
        setTodoFocusItemId(focusTarget?.id || null);
      } else {
        setBlocks(removeBlockAt(blocks, index));
        setTodoFocusItemId(null);
      }
      return;
    }

    onBodyKeyDown?.(e);
  };

  return (
    <div className="doc-block-stack">
      {blocks.map((block, index) => (
        <div className="doc-block-stack__item" key={block.id} data-block-id={block.id}>
          {block.type === DOC_BLOCK_TYPES.H1 ? (
            <H1BlockView
              value={block.title || ""}
              onChange={(title) => updateAt(index, { title })}
              onQueryHandleClick={() => onOpenNodeForH1?.(index, block)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  insertTextAfter(index);
                  return;
                }
                const atStart =
                  e.currentTarget.selectionStart === 0 &&
                  e.currentTarget.selectionEnd === 0;
                if (
                  (e.key === "Backspace" || e.key === "Delete") &&
                  !block.title &&
                  atStart
                ) {
                  e.preventDefault();
                  setBlocks(removeBlockAt(blocks, index));
                  return;
                }
                onBodyKeyDown?.(e);
              }}
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.TODO ? (
            <TodoBlockView
              listTitle={block.listTitle ?? "To do:"}
              onListTitleChange={(listTitle) => updateAt(index, { listTitle })}
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
            />
          ) : null}

          {block.type === DOC_BLOCK_TYPES.TEXT ? (
            <TextBlockView
              value={block.text || ""}
              onChange={(text) => {
                updateAt(index, { text });
                const h1Index = getH1IndexForTextBlock(blocks, index);
                if (h1Index >= 0) onAnswerBelowH1Change?.(h1Index, text);
              }}
              placeholder={bodyPlaceholder}
              showPlaceholder={index === 0 && blocks.length === 1}
              autoFocus={focusBlockId === block.id}
              onKeyDown={(e) => handleTextKeyDown(index, e, block.text || "")}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
