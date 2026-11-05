import { documentVariables, resolvePrompt } from './promptVariables.js';
import { visibleStepTitle } from './promptPages.js';

/** @returns {string} */
export function makeTpId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @returns {{ id: string, type: 'text', body: string }} */
export function blankTextNode(body = '') {
  return { id: makeTpId(), type: 'text', body: String(body || '') };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function plainPromptCopy(template, variables) {
  return resolvePrompt(template, variables)
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?ul>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/?(?:strong|em|u|s|mark|h1|p|div|span)>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {unknown[]} nodes
 * @returns {string}
 */
export function joinScriptText(nodes) {
  return (nodes || [])
    .filter((node) => node?.type === 'text')
    .map((node) => String(node.body || ''))
    .join('\n\n');
}

/**
 * Cumulative text length before each node (for play highlighting).
 * Matches joinScriptText: `\n\n` between consecutive text nodes.
 * @param {object[]} nodes
 */
export function scriptOffsets(nodes) {
  let offset = 0;
  let textSeen = 0;
  return (nodes || []).map((node) => {
    if (node?.type === 'text') {
      if (textSeen > 0) offset += 2; /* joinScriptText separator */
      textSeen += 1;
      const start = offset;
      offset += Array.from(String(node.body || '')).length;
      return { id: node.id, type: node.type, start, end: offset };
    }
    return { id: node.id, type: node.type, start: offset, end: offset };
  });
}

/**
 * Next Copy-block gate the playhead should stop at (manual Play to continue).
 * @param {object[]} nodes
 * @param {number} fromCursor
 * @param {number} toCursor
 * @param {Set<string> | string[]} clearedBlockIds
 * @returns {{ blockId: string, at: number } | null}
 */
export function nextBlockPause(nodes, fromCursor, toCursor, clearedBlockIds) {
  const cleared = clearedBlockIds instanceof Set
    ? clearedBlockIds
    : new Set(clearedBlockIds || []);
  const from = Math.max(0, Number(fromCursor) || 0);
  const to = Math.max(from, Number(toCursor) || 0);
  const offsets = scriptOffsets(nodes);
  for (let i = 0; i < offsets.length; i += 1) {
    const meta = offsets[i];
    const node = nodes[i];
    if (!node || node.type === 'text' || cleared.has(node.id)) continue;
    const at = meta.start;
    if (at > to) continue;
    if (from < at && to >= at) return { blockId: node.id, at };
    if (from === at) return { blockId: node.id, at };
  }
  return null;
}

/**
 * @param {object[]} folders
 * @param {string} fileId
 * @param {string} stepId
 */
export function findDeskStep(folders, fileId, stepId) {
  for (const folder of folders || []) {
    for (const file of folder.prompts || []) {
      if (file.id !== fileId) continue;
      const step = (file.steps || []).find((item) => item.id === stepId);
      if (!step) return null;
      return { folder, file, step };
    }
  }
  return null;
}

/**
 * @param {object} file
 * @param {object} step
 */
export function stepInsertLabel(file, step) {
  const title = visibleStepTitle(step, file?.name || 'Prompt');
  return title || file?.name || 'Prompt';
}

/**
 * @param {object} file
 * @param {object} step
 */
export function stepPlainBody(file, step) {
  const variables = documentVariables(file);
  return plainPromptCopy(step?.prompt || '', variables);
}

/**
 * Plain text for a teleprompter Copy block (content, never title).
 * Prefers live desk prompt, then snapshot body, then URL href.
 * @param {object} node
 * @param {object[]} folders
 */
export function resolveBlockCopyText(node, folders) {
  if (!node || node.type === 'text') return '';
  if (node.type === 'url') {
    return String(node.body || node.href || '').trim();
  }
  if (node.type === 'prompt') {
    const found = findDeskStep(folders, node.fileId, node.stepId);
    const live = found ? stepPlainBody(found.file, found.step) : '';
    return String(live || node.body || '').trim();
  }
  return String(node.body || '').trim();
}

/**
 * Desk folders usable in the teleprompter browser (no transcript shelf).
 * @param {object[]} folders
 * @param {string} transcriptLabel
 */
export function deskFoldersForTeleprompter(folders, transcriptLabel = 'Transcribe File') {
  return (folders || []).filter((folder) => folder?.label !== transcriptLabel);
}
