import { normalizeDocBlocks } from "../docBlocks.js";
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
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";

/**
 * @typedef {Object} MacroBlogOutput
 * @property {{ headline?: string, body?: string }} [writtenContent]
 */

const STRUCTURAL_NODE_BLOCK_TYPES = new Set([
  NODE_BLOCK_TYPES.AGENT,
  NODE_BLOCK_TYPES.PASSWORD_VAULT,
  NODE_BLOCK_TYPES.LINK_VAULT,
  NODE_BLOCK_TYPES.CODE,
  NODE_BLOCK_TYPES.TODO,
  NODE_BLOCK_TYPES.STEP_SEQUENCE,
]);

/**
 * @param {import("../../stores/nodesStore.js").NodeEntity | null | undefined} node
 * @param {import("../docBlocks.js").DocBlock[]} docBlocks
 * @returns {boolean}
 */
export function isMacroNodeLinkedInParentDoc(node, docBlocks) {
  if (!node) return false;
  const normalized = normalizeDocBlocks(docBlocks || []);
  if (node.sourceBlockId && normalized.some((block) => block.id === node.sourceBlockId)) {
    return true;
  }
  return normalized.some((block) => block.nodeId === node.id);
}

/**
 * @param {string} body
 * @param {string} headline
 * @returns {string[]}
 */
export function splitMacroBlogBodySections(body, headline) {
  const sections = String(body || "")
    .split(/\n\n+/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!headline || !sections.length) return sections;
  if (sections[0].toLowerCase() === headline.toLowerCase()) {
    return sections.slice(1);
  }
  return sections;
}

/**
 * @param {import("../nodeInlineContent.js").NodeWritingBlock[]} normalized
 * @param {import("../nodeInlineContent.js").NodeWritingBlock[]} generatedBlocks
 * @param {number} agentIndex
 * @param {boolean} linkedInDoc
 * @returns {import("../nodeInlineContent.js").NodeWritingBlock[]}
 */
export function mergeMacroBlogWritingBlocks(normalized, generatedBlocks, agentIndex, linkedInDoc) {
  if (agentIndex >= 0) {
    const before = normalized.slice(0, agentIndex + 1);
    const after = normalized.slice(agentIndex + 1).filter((block) => (
      block.type === NODE_BLOCK_TYPES.PASSWORD_VAULT
      || block.type === NODE_BLOCK_TYPES.LINK_VAULT
      || block.type === NODE_BLOCK_TYPES.CODE
    ));
    return [...before, ...generatedBlocks, ...after];
  }

  if (linkedInDoc) {
    const structural = normalized.filter((block) => STRUCTURAL_NODE_BLOCK_TYPES.has(block.type));
    return [...structural, ...generatedBlocks];
  }

  return [...normalized, ...generatedBlocks];
}

/**
 * Write generated blog content into a macro node's writing stack.
 * Preserves /agent and todo blocks; replaces prior generated text after /agent.
 * Linked macros: title stays on the doc H1 — body only inside the node.
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

  const parentDocId = node.parentDocId || null;
  const parentDoc = parentDocId ? useDocsStore.getState().getDoc(parentDocId) : null;
  const linkedInDoc = isMacroNodeLinkedInParentDoc(node, parentDoc?.blocks || []);

  const { blocks } = parseNodeWritingBody(node.content);
  const normalized = normalizeWritingBlocks(blocks);

  const generatedBlocks = [];
  if (headline && body && !linkedInDoc) {
    generatedBlocks.push(createInlineH1Block(headline));
  }
  for (const section of splitMacroBlogBodySections(body, headline)) {
    generatedBlocks.push(createEmptyTextBlock(section));
  }
  if (todoItems.length > 0) {
    generatedBlocks.push({
      ...createInlineTodoBlock(String(output.listTitle || "").trim() || DEFAULT_NODE_TODO_LIST_TITLE),
      items: todoItems,
    });
  }

  const agentIndex = normalized.findIndex((block) => block.type === NODE_BLOCK_TYPES.AGENT);
  const newBlocks = mergeMacroBlogWritingBlocks(normalized, generatedBlocks, agentIndex, linkedInDoc);

  /** @type {Record<string, unknown>} */
  const nodePatch = {
    content: serializeNodeWritingBody({ blocks: newBlocks }),
  };
  if (linkedInDoc && headline) {
    nodePatch.title = headline;
    nodePatch.sourceQuery = headline;
  }

  store.updateNode(nodeEntityId, nodePatch);

  if (parentDocId) {
    store.syncNodeToParentDoc(nodeEntityId, parentDocId);
  }

  return true;
}
