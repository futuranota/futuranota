import {
  createEmptyTextBlock,
  createInlineH1Block,
  createInlineTodoBlock,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../nodeInlineContent.js";
import { createTodoItem } from "../docBlocks.js";
import { DEFAULT_NODE_TODO_LIST_TITLE } from "../nodeTodoContent.js";
import { useNodesStore } from "../../stores/nodesStore.js";

/**
 * @typedef {Object} MacroBlogOutput
 * @property {{ headline?: string, body?: string }} [writtenContent]
 */

/**
 * Write generated blog content into a macro node's writing stack.
 * Preserves /agent and todo blocks; replaces prior generated text after /agent.
 * @param {string} nodeEntityId
 * @param {MacroBlogOutput} output
 * @param {string} [fallbackTitle]
 * @returns {boolean}
 */
export function applyBlogToMacroNode(nodeEntityId, output, fallbackTitle = "") {
  const store = useNodesStore.getState();
  const node = store.nodes[nodeEntityId];
  if (!node || !output) return false;

  const body = String(output.writtenContent?.body || "").trim();
  const headline = String(output.writtenContent?.headline || fallbackTitle || node.title || "").trim();
  const todoItems = (output.items || [])
    .map((item) => createTodoItem({
      text: String(item?.text || "").trim(),
      checked: false,
    }))
    .filter((item) => item.text);

  if (!body && todoItems.length === 0) return false;

  const { blocks } = parseNodeWritingBody(node.content);
  const normalized = normalizeWritingBlocks(blocks);

  const generatedBlocks = [];
  if (headline && body) {
    generatedBlocks.push(createInlineH1Block(headline));
  }
  for (const section of body.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)) {
    generatedBlocks.push(createEmptyTextBlock(section));
  }
  if (todoItems.length > 0) {
    generatedBlocks.push({
      ...createInlineTodoBlock(String(output.listTitle || "").trim() || DEFAULT_NODE_TODO_LIST_TITLE),
      items: todoItems,
    });
  }

  const agentIndex = normalized.findIndex((block) => block.type === NODE_BLOCK_TYPES.AGENT);
  let newBlocks;

  if (agentIndex >= 0) {
    const before = normalized.slice(0, agentIndex + 1);
    const after = normalized.slice(agentIndex + 1).filter((block) => (
      block.type === NODE_BLOCK_TYPES.PASSWORD_VAULT
      || block.type === NODE_BLOCK_TYPES.LINK_VAULT
      || block.type === NODE_BLOCK_TYPES.CODE
    ));
    newBlocks = [...before, ...generatedBlocks, ...after];
  } else {
    newBlocks = [...normalized, ...generatedBlocks];
  }

  const content = serializeNodeWritingBody({ blocks: newBlocks });
  store.updateNode(nodeEntityId, { content });

  const parentDocId = node.parentDocId || null;
  if (parentDocId) {
    store.syncNodeToParentDoc(nodeEntityId, parentDocId);
  }

  return true;
}
