import { createTodoItem } from "./docBlocks.js";

export const NODE_TODO_KIND = "todo-plan";
export const DEFAULT_NODE_TODO_LIST_TITLE = "Todo list:";

export function createDefaultNodeTodoContent(listTitle = DEFAULT_NODE_TODO_LIST_TITLE) {
  return {
    kind: NODE_TODO_KIND,
    listTitle,
    items: [createTodoItem()],
  };
}

export function isNodeTodoContent(content) {
  return Boolean(
    content
    && typeof content === "object"
    && !Array.isArray(content)
    && content.kind === NODE_TODO_KIND
    && Array.isArray(content.items),
  );
}

export function blockTodoToNodeContent(block, fallbackTitle = DEFAULT_NODE_TODO_LIST_TITLE) {
  const items = Array.isArray(block?.items) ? block.items : [];
  return {
    kind: NODE_TODO_KIND,
    listTitle: block?.listTitle || fallbackTitle,
    items: items.length
      ? items.map((item) => createTodoItem({ ...item }))
      : [createTodoItem()],
  };
}

export function normalizeNodeTodoContent(content, fallbackTitle = DEFAULT_NODE_TODO_LIST_TITLE) {
  if (isNodeTodoContent(content)) {
    const items = content.items.length
      ? content.items.map((item) => createTodoItem({ ...item }))
      : [createTodoItem()];
    return {
      kind: NODE_TODO_KIND,
      listTitle: content.listTitle || fallbackTitle,
      items,
    };
  }

  if (typeof content === "boolean") {
    return {
      kind: NODE_TODO_KIND,
      listTitle: fallbackTitle,
      items: [createTodoItem({ checked: content })],
    };
  }

  if (typeof content === "string") {
    const normalized = content.trim().toLowerCase();
    if (normalized === "true" || normalized === "false") {
      return {
        kind: NODE_TODO_KIND,
        listTitle: fallbackTitle,
        items: [createTodoItem({ checked: normalized === "true" })],
      };
    }
  }

  return createDefaultNodeTodoContent(fallbackTitle);
}

export function nodeTodoMacroChecked(content) {
  const normalized = normalizeNodeTodoContent(content);
  if (!normalized.items.length) return false;
  return normalized.items.every((item) => item.checked);
}
