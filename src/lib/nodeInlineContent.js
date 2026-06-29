import { generateId } from "./ids.js";
import {
  createDefaultNodeTodoContent,
  normalizeNodeTodoContent,
} from "./nodeTodoContent.js";

export const NODE_BODY_KIND = "node-body";

export function isNodeWritingBody(content) {
  return Boolean(
    content
    && typeof content === "object"
    && !Array.isArray(content)
    && content.kind === NODE_BODY_KIND,
  );
}

export function normalizeInlineTodoBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => {
    const normalized = normalizeNodeTodoContent(block, block?.listTitle);
    return {
      id: block?.id || generateId("NTB"),
      listTitle: normalized.listTitle,
      items: normalized.items,
    };
  });
}

export function parseNodeWritingBody(content) {
  if (typeof content === "string") {
    return { text: content, todoBlocks: [] };
  }
  if (isNodeWritingBody(content)) {
    return {
      text: content.text || "",
      todoBlocks: normalizeInlineTodoBlocks(content.todoBlocks),
    };
  }
  return { text: "", todoBlocks: [] };
}

export function serializeNodeWritingBody({ text = "", todoBlocks = [] } = {}) {
  const blocks = normalizeInlineTodoBlocks(todoBlocks);
  if (!blocks.length) {
    return text || "";
  }
  return {
    kind: NODE_BODY_KIND,
    text: text || "",
    todoBlocks: blocks,
  };
}

export function createInlineTodoBlock(listTitle) {
  const todo = createDefaultNodeTodoContent(listTitle);
  return {
    id: generateId("NTB"),
    listTitle: todo.listTitle,
    items: todo.items,
  };
}

export function inlineTodoBlocksHaveContent(blocks) {
  return normalizeInlineTodoBlocks(blocks).some(
    (block) =>
      (block.listTitle || "").trim()
      || block.items.some((item) => (item.text || "").trim()),
  );
}
