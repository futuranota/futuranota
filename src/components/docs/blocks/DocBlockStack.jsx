import { useEffect, useRef, useState } from "react";
import {
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  insertBlockAfter,
  isEmptyTextBlock,
  normalizeDocBlocks,
  removeBlockAt,
  replaceBlocksFromSlashInText,
  updateBlockAt,
} from "../../../lib/docBlocks.js";
import {
  createDocBlockFromSlash,
  parseSlashQuery,
  splitBodyForSlash,
} from "../../../lib/docBlockSlash.js";
import { getH1IndexForTextBlock } from "../../../lib/docNodeSync.js";
import { isNoNodeLinkMode, resolveBlockNodeLinkColor } from "../../../lib/docNodeLinkColors.js";
import { H1BlockView } from "./H1BlockView.jsx";
import { TextBlockView } from "./TextBlockView.jsx";
import { TodoBlockView } from "./TodoBlockView.jsx";
import { DateBlockView } from "./DateBlockView.jsx";
import { MetricBlockView } from "./MetricBlockView.jsx";

export function DocBlockStack({
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
}) {
  const [todoFocusItemId, setTodoFocusItemId] = useState(null);
  const openNode = onOpenNodeForBlock || onOpenNodeForH1;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const blockLinkColor = (block) => resolveBlockNodeLinkColor(block);
  const blockLinksEnabled = (block) => !isNoNodeLinkMode(blockLinkColor(block));

  const focusBlockCaret = (blockId, caretPos = null) => {
    if (!blockId) return;
    onFocusBlock?.(blockId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      const input = el?.querySelector("input, textarea");
      if (!input || !("setSelectionRange" in input)) return;
      input.focus();
      const pos = caretPos ?? input.value.length;
      input.setSelectionRange(pos, pos);
    });
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

  const handleQueryHandleClick = (index) => {
    const block = blocksRef.current[index];
    if (!block || !blockLinksEnabled(block)) return;

    if (!block.queryEnabled) {
      updateAt(index, { queryEnabled: true });
      return;
    }

    const fresh = normalizeDocBlocks(blocksRef.current)[index] ?? block;
    openNode?.(index, fresh);
  };

  const insertTextAfter = (index, initialText = "") => {
    const current = blocksRef.current;
    const nextBlock = current[index + 1];
    if (isEmptyTextBlock(nextBlock) && !initialText) {
      focusBlockCaret(nextBlock.id, 0);
      requestContentGrow();
      return nextBlock.id;
    }

    const textBlock = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: initialText });
    const next = insertBlockAfter(current, index, textBlock);
    setBlocks(next);
    onFocusBlock?.(textBlock.id);
    focusBlockCaret(textBlock.id, initialText.length);
    requestContentGrow();
    return textBlock.id;
  };

  const insertNewlineAtCaret = (blockIndex, e) => {
    e.preventDefault();
    const el = e.currentTarget;
    const caretStart = el.selectionStart ?? 0;
    const caretEnd = el.selectionEnd ?? caretStart;
    const text = el.value ?? "";
    const nextText = `${text.slice(0, caretStart)}\n${text.slice(caretEnd)}`;
    const blockId = blocksRef.current[blockIndex]?.id;
    if (!blockId) return;

    const next = updateBlockAt(blocksRef.current, blockIndex, { text: nextText });
    setBlocks(next);
    syncAnswerBelowH1(next, blockIndex, nextText);
    focusBlockCaret(blockId, caretStart + 1);
    requestContentGrow();
  };

  const handleDragPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const tryConfirmSlashInText = (blockIndex, textValue) => {
    const { slash } = splitBodyForSlash(textValue);
    if (!slash) return false;
    const parsed = parseSlashQuery(slash.slice(1));
    if (!parsed) return false;

    const newBlock = createDocBlockFromSlash(parsed);
    const next = replaceBlocksFromSlashInText(blocks, blockIndex, textValue, newBlock);
    setBlocks(next);
    onFocusBlock?.(newBlock.id);
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

  const handleTextKeyDown = (blockIndex, e, textValue) => {
    if (handleTextBackspace(blockIndex, e, textValue)) return;

    const { slash } = splitBodyForSlash(textValue);

    if (e.key === "Enter" && !e.shiftKey) {
      if (slash) {
        const newId = tryConfirmSlashInText(blockIndex, textValue);
        if (newId) {
          e.preventDefault();
          requestContentGrow();
          return;
        }
      }
      e.preventDefault();
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertTextAfter(index);
      return;
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
      const prevId = index > 0 ? blocksRef.current[index - 1]?.id : null;
      const next = removeBlockAt(blocksRef.current, index);
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
              queryEnabled={Boolean(block.queryEnabled)}
              nodeLinkColor={blockLinkColor(block)}
              linksEnabled={blockLinksEnabled(block)}
              onFocus={() => onFocusBlock?.(block.id)}
              anchorFromNode={Boolean(block.anchorFromNode)}
              anchorDate={block.anchorDate || ""}
              anchorTime={block.anchorTime || ""}
              onQueryHandleClick={() => handleQueryHandleClick(index)}
              onKeyDown={(e) => handleLinkableBlockKeyDown(index, block, e)}
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

          {block.type === DOC_BLOCK_TYPES.TODO ? (
            <TodoBlockView
              listTitle={block.listTitle ?? "Checkbox:"}
              onListTitleChange={(listTitle) => updateAt(index, { listTitle })}
              queryEnabled={Boolean(block.queryEnabled)}
              nodeLinkColor={blockLinkColor(block)}
              linksEnabled={blockLinksEnabled(block)}
              onFocus={() => onFocusBlock?.(block.id)}
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
              maxHeightPx={520}
              onFocus={() => onFocusBlock?.(block.id)}
              onKeyDown={(e) => handleTextKeyDown(index, e, block.text || "")}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
