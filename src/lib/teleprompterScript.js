import { stepModelCardMeta } from './promptModels.js';
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
 * Relative cost of one script character for teleprompter pacing.
 * Base letter/space = 1; punctuation costs more so CPS still means
 * “letter units / s” while sentences breathe.
 * @param {string} ch
 * @returns {number}
 */
export function charPaceWeight(ch) {
  const c = String(ch || '');
  if (c === '.' || c === '…' || c === '?' || c === '!') return 4;
  if (c === ',' || c === ';' || c === ':') return 2.2;
  if (
    c === '"'
    || c === "'"
    || c === '\u201c'
    || c === '\u201d'
    || c === '\u2018'
    || c === '\u2019'
  ) return 1.6;
  if (c === '\n') return 2;
  if (c === '—' || c === '–') return 1.8;
  return 1;
}

/**
 * Sum of pace weights for `text[0 .. endExclusive)`.
 * @param {string} text
 * @param {number} [endExclusive]
 * @returns {number}
 */
export function pacedUnitsInText(text, endExclusive = Number.POSITIVE_INFINITY) {
  const chars = Array.from(String(text || ''));
  const limit = Math.min(chars.length, Math.max(0, Number(endExclusive) || 0));
  let units = 0;
  for (let i = 0; i < limit; i += 1) units += charPaceWeight(chars[i]);
  return units;
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
 * Payload fields for inserting a prompt block into the teleprompter script.
 * @param {object} folder
 * @param {object} file
 * @param {object} step
 */
export function buildPromptInsertPayload(folder, file, step) {
  const plain = stepPlainBody(file, step);
  const title = stepInsertLabel(file, step);
  const meta = stepModelCardMeta(file, step);
  return {
    folderId: folder?.id,
    fileId: file?.id,
    stepId: step?.id,
    title,
    body: plain,
    preview: plain.slice(0, 180),
    modelId: meta.modelId,
    modelLabel: meta.modelLabel,
    modelSrc: meta.modelSrc,
    recommendedModel: meta.recommendedModel,
  };
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
  if (node.type === 'instruction') {
    const note = String(node.body || '').trim();
    const href = String(node.href || '').trim();
    if (note && href) return `${note}\n${href}`;
    return note || href;
  }
  if (node.type === 'prompt') {
    const found = findDeskStep(folders, node.fileId, node.stepId);
    const live = found ? stepPlainBody(found.file, found.step) : '';
    return String(live || node.body || '').trim();
  }
  return String(node.body || '').trim();
}

/** @param {object} [node] */
export function isTeleprompterCopyBlock(node) {
  return node?.type === 'prompt' || node?.type === 'url' || node?.type === 'instruction';
}

/**
 * Desk folders usable in the teleprompter browser (no transcript shelf).
 * @param {object[]} folders
 * @param {string} transcriptLabel
 */
export function deskFoldersForTeleprompter(folders, transcriptLabel = 'Transcribe File') {
  return (folders || []).filter((folder) => folder?.label !== transcriptLabel);
}
