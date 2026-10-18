/** Prompt desk limits. Separate from the older workspace caps in planConfig.js. */

/**
 * Free and Pro caps stay defined below. They do not apply while the desk is in development.
 * Set this to true when the plan should start counting folders, files, pages, and tool calls.
 */
export const PROMPT_LIMITS_ENFORCED = false;

export const PROMPT_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;

export const FREE_PROMPT_LIMITS = {
  maxFolders: 1,
  maxFiles: 2,
  maxPagesPerFile: 6,
  maxToolCalls: 3,
  maxEmbedBoxesPerDay: 3,
};

export const PROMPT_LIMIT_COPY = {
  folder: 'El plan gratis incluye 1 folder.',
  file: 'El plan gratis incluye 2 files.',
  page: 'El plan gratis incluye 6 páginas por file.',
  tools: 'El plan gratis incluye 3 llamadas con los tools.',
  storage: 'Llegaste al tope de 5 GB.',
  embed: 'El plan gratis incluye 3 embeds por día. Mañana podés crear otro.',
  usage: 'No pude revisar las llamadas del plan gratis.',
};

/** @param {string} [plan] */
export function isPromptPro(plan) {
  return plan === 'pro';
}

const OPEN_PROMPT_LIMITS = {
  maxFolders: Infinity,
  maxFiles: Infinity,
  maxPagesPerFile: Infinity,
  maxToolCalls: Infinity,
  maxEmbedBoxesPerDay: Infinity,
};

/** @param {string} [plan] */
export function promptLimits(plan) {
  const counts = !PROMPT_LIMITS_ENFORCED || isPromptPro(plan)
    ? OPEN_PROMPT_LIMITS
    : FREE_PROMPT_LIMITS;
  return { ...counts, storageBytes: PROMPT_STORAGE_BYTES };
}

/** @param {Array<{ prompts?: unknown[] }>} [folders] */
export function countPromptFiles(folders) {
  return (folders || []).reduce((total, folder) => total + (folder.prompts?.length || 0), 0);
}

/** @param {Array<unknown>} [folders] @param {string} [plan] */
export function canAddPromptFolder(folders, plan) {
  return (folders || []).length < promptLimits(plan).maxFolders;
}

/** @param {Array<{ prompts?: unknown[] }>} [folders] @param {string} [plan] */
export function canAddPromptFile(folders, plan) {
  return countPromptFiles(folders) < promptLimits(plan).maxFiles;
}

/** @param {number} pageCount @param {string} [plan] */
export function canAddPromptPage(pageCount, plan) {
  return pageCount < promptLimits(plan).maxPagesPerFile;
}

/** @param {string} [plan] */
export function promptToolCallsLeft(used, plan) {
  const cap = promptLimits(plan).maxToolCalls;
  if (!Number.isFinite(cap)) return Infinity;
  return Math.max(0, cap - (Number(used) || 0));
}

/** Local calendar day, YYYY-MM-DD. */
export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
