import { createTodoItem } from "./docBlocks.js";

function isAtInputStart(event) {
  const target = event.target;
  if (!target || !("selectionStart" in target)) return false;
  return target.selectionStart === 0 && target.selectionEnd === 0;
}

/**
 * @param {Object} options
 * @param {{ id: string, text: string, checked?: boolean }[]} options.items
 * @param {number} options.itemIndex
 * @param {(nextItems: typeof options.items) => void} options.onItemsChange
 * @param {(itemId: string) => void} [options.onFocusItemId]
 */
export function handleLazyTodoItemKeyDown({
  items,
  itemIndex,
  event,
  onItemsChange,
  onFocusItemId,
}) {
  const item = items[itemIndex];
  if (!item) return;

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const newItem = createTodoItem({ text: "" });
    const nextItems = [
      ...items.slice(0, itemIndex + 1),
      newItem,
      ...items.slice(itemIndex + 1),
    ];
    onItemsChange(nextItems);
    onFocusItemId?.(newItem.id);
    return;
  }

  if (event.key === "Backspace" && isAtInputStart(event) && !item.text && items.length > 1) {
    event.preventDefault();
    const prevIndex = Math.max(0, itemIndex - 1);
    const prevItem = items[prevIndex];
    const nextItems = items.filter((_, index) => index !== itemIndex);
    onItemsChange(nextItems);
    if (prevItem) onFocusItemId?.(prevItem.id);
  }
}

export function lazyTodoHasContent({ reminder = "", items = [] } = {}) {
  if (String(reminder ?? "").trim()) return true;
  return items.some((item) => String(item?.text ?? "").trim());
}
