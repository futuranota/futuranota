import { DOC_BLOCK_TYPES } from "./docBlocks.js";
import {
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  parseNodeWritingBody,
} from "./nodeInlineContent.js";

/**
 * Extract instruction text from macro-node writing blocks (first /agent cell only).
 * @param {unknown[]} blocks
 * @returns {string}
 */
export function extractAgentInstructionFromWritingBlocks(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  const agentBlock = normalized.find((block) => block.type === NODE_BLOCK_TYPES.AGENT);
  return String(agentBlock?.instruction ?? "").trim();
}

/**
 * @param {unknown} content — Zustand node entity content (string or node-body)
 * @returns {string}
 */
export function extractAgentInstructionFromNodeContent(content) {
  if (!content) return "";
  const { blocks } = parseNodeWritingBody(content);
  return extractAgentInstructionFromWritingBlocks(blocks);
}

/**
 * @param {{ content?: unknown } | null | undefined} entity
 * @returns {string}
 */
export function extractAgentInstructionFromNodeEntity(entity) {
  if (!entity) return "";
  return extractAgentInstructionFromNodeContent(entity.content);
}

/**
 * @param {unknown[]} blocks — doc blocks (not node writing blocks)
 * @returns {string}
 */
export function extractAgentInstructionFromDocBlocks(blocks) {
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    if (block?.type !== DOC_BLOCK_TYPES.AGENT) continue;
    const instruction = String(block?.instruction ?? "").trim();
    if (instruction) return instruction;
  }
  return "";
}

/**
 * @param {unknown[]} blocks
 */
export function docBlocksHaveAgentInstruction(blocks) {
  return Boolean(extractAgentInstructionFromDocBlocks(blocks));
}
