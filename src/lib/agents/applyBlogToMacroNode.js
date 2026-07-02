import {
  createEmptyTextBlock,
  createInlineH1Block,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../nodeInlineContent.js";
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
  if (!body) return false;

  const headline = String(output.writtenContent?.headline || fallbackTitle || node.title || "").trim();

  const { blocks } = parseNodeWritingBody(node.content);
  const normalized = normalizeWritingBlocks(blocks);

  const blogBlocks = [];
  if (headline) {
    blogBlocks.push(createInlineH1Block(headline));
  }
  for (const section of body.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)) {
    blogBlocks.push(createEmptyTextBlock(section));
  }

  const agentIndex = normalized.findIndex((block) => block.type === NODE_BLOCK_TYPES.AGENT);
  let newBlocks;

  if (agentIndex >= 0) {
    const before = normalized.slice(0, agentIndex + 1);
    const after = normalized.slice(agentIndex + 1).filter((block) => (
      block.type === NODE_BLOCK_TYPES.TODO
      || block.type === NODE_BLOCK_TYPES.PASSWORD_VAULT
      || block.type === NODE_BLOCK_TYPES.LINK_VAULT
      || block.type === NODE_BLOCK_TYPES.CODE
    ));
    newBlocks = [...before, ...blogBlocks, ...after];
  } else {
    newBlocks = [...normalized, ...blogBlocks];
  }

  const content = serializeNodeWritingBody({ blocks: newBlocks });
  store.updateNode(nodeEntityId, { content });

  const parentDocId = node.parentDocId || null;
  if (parentDocId) {
    store.syncNodeToParentDoc(nodeEntityId, parentDocId);
  }

  return true;
}
