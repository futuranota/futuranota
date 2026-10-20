/** Prompt desk limits. Separate from the older workspace caps in planConfig.js. */

/** Free shelf, embed day, and the 3-click pool are live. Pro stays open except the credit pool. */
export const PROMPT_LIMITS_ENFORCED = true;

export const PROMPT_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;

/** Embed branding logo. The original file lives in the 5 GB desk quota. */
export const EMBED_BRAND_MAX_BYTES = 5 * 1024 * 1024;

/** One toolbar click. 3 free clicks = 21 credits. 200 Pro clicks = 1400 credits. */
export const CREDITS_PER_CLICK = 7;

export const PRO_PROMPT_CREDITS = 200 * CREDITS_PER_CLICK;

/**
 * Preview account. The desk treats this login as free until the founder asks for Pro.
 * Clicks for this email live in the browser so the cap shows even if the profile row says pro.
 */
export const DESK_FREE_PREVIEW_EMAIL = 'contact.fnota@gmail.com';

export const TRANSCRIPT_FOLDER_LABEL = 'Transcribe File';

export const FREE_PROMPT_LIMITS = {
  maxFolders: 1,
  maxFiles: 2,
  maxPagesPerFile: 6,
  maxToolCalls: 3,
  maxEmbedBoxesPerDay: 3,
};

export const PRO_PROMPT_LIMITS = {
  maxFolders: Infinity,
  maxFiles: Infinity,
  maxPagesPerFile: Infinity,
  maxToolCalls: 200,
  maxEmbedBoxesPerDay: Infinity,
};

export const PROMPT_LIMIT_COPY = {
  folder: 'El plan gratis incluye 1 folder.',
  file: 'El plan gratis incluye 2 files.',
  page: 'El plan gratis incluye 6 páginas por file.',
  tools: 'Se acabaron los 3 clics del plan gratis.',
  storage: 'Llegaste al tope de 5 GB.',
  embed: 'El plan gratis incluye 3 embeds por día. Mañana podés crear otro.',
  usage: 'No pude revisar las llamadas del plan gratis.',
};

/** @param {string} [plan] */
export function isPromptPro(plan) {
  return plan === 'pro';
}

/** @param {string} [email] */
export function isDeskFreePreview(email) {
  return String(email || '').trim().toLowerCase() === DESK_FREE_PREVIEW_EMAIL;
}

/**
 * Plan the desk enforces. The preview login stays free even when the profile row is pro.
 * @param {string} [email]
 * @param {string} [profilePlan]
 */
export function deskPlan(email, profilePlan) {
  if (isDeskFreePreview(email)) return 'free';
  return profilePlan === 'pro' ? 'pro' : 'free';
}

/** @param {number} clicksLeft @param {string} [plan] */
export function creditBalance(clicksLeft, plan) {
  if (isPromptPro(plan)) return PRO_PROMPT_CREDITS;
  const left = Number.isFinite(clicksLeft) ? clicksLeft : 0;
  return Math.max(0, left) * CREDITS_PER_CLICK;
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
  let counts = OPEN_PROMPT_LIMITS;
  if (PROMPT_LIMITS_ENFORCED) {
    counts = isPromptPro(plan) ? PRO_PROMPT_LIMITS : FREE_PROMPT_LIMITS;
  }
  return { ...counts, storageBytes: PROMPT_STORAGE_BYTES };
}

function isDeskFolder(folder) {
  return folder?.label !== TRANSCRIPT_FOLDER_LABEL;
}

/** @param {Array<{ prompts?: unknown[] }>} [folders] */
export function countPromptFiles(folders) {
  return (folders || []).filter(isDeskFolder).reduce((total, folder) => total + (folder.prompts?.length || 0), 0);
}

/** @param {Array<unknown>} [folders] @param {string} [plan] */
export function canAddPromptFolder(folders, plan) {
  return (folders || []).filter(isDeskFolder).length < promptLimits(plan).maxFolders;
}

/** @param {Array<{ id?: string, prompts?: unknown[] }>} [folders] @param {string} [plan] @param {string} [folderId] */
export function canAddPromptFile(folders, plan, folderId) {
  const cap = promptLimits(plan).maxFiles;
  if (!Number.isFinite(cap)) return true;
  if (folderId) {
    const folder = (folders || []).find((item) => item.id === folderId);
    if (!folder || !isDeskFolder(folder)) return true;
    return (folder.prompts?.length || 0) < cap;
  }
  return countPromptFiles(folders) < cap;
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
