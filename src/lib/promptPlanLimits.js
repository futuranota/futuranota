/** Prompt desk limits. Separate from the older workspace caps in planConfig.js. */

/** Free shelf, embed day, and the 3-click pool are live. Pro stays open except the credit pool. */
export const PROMPT_LIMITS_ENFORCED = true;

/** Free desk storage (text + non-cover uploads). */
export const FREE_PROMPT_STORAGE_BYTES = 5 * 1024 * 1024;

/** Pro desk storage. */
export const PRO_PROMPT_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;

/** @deprecated Prefer promptStorageBytes(plan). Alias of Pro cap for older callers. */
export const PROMPT_STORAGE_BYTES = PRO_PROMPT_STORAGE_BYTES;

/** Embed branding logo. The original file lives in the desk quota. */
export const EMBED_BRAND_MAX_BYTES = 5 * 1024 * 1024;

/** One toolbar click. 3 free clicks = 21 credits. 200 Pro clicks = 1400 credits. */
export const CREDITS_PER_CLICK = 7;

export const PRO_PROMPT_CREDITS = 200 * CREDITS_PER_CLICK;

/**
 * Founder / development login. When VITE_DESK_FOUNDER_PRO=true, the desk treats
 * this email as unlimited Pro (Organizar, embeds, credit glass). Default off so
 * Free vs Pro freemium can be tested with the real profile.plan.
 */
export const DESK_FREE_PREVIEW_EMAIL = 'contact.fnota@gmail.com';

/** @returns {boolean} */
export function isDeskFounderProEnabled() {
  try {
    return String(import.meta.env.VITE_DESK_FOUNDER_PRO || '').trim() === 'true';
  } catch {
    return false;
  }
}

export const TRANSCRIPT_FOLDER_LABEL = 'Transcribe File';

export const FREE_PROMPT_LIMITS = {
  maxFolders: Infinity,
  maxFiles: Infinity,
  maxPagesPerFile: 20,
  maxToolCalls: 3,
  maxEmbedBoxesPerDay: 3,
};

/** Free teleprompter Script list cap. */
export const FREE_TELEPROMPT_MAX = 6;

/** Free users may keep editing a saved teleprompt for this long after createdAt. */
export const FREE_TELEPROMPT_EDIT_MS = 5 * 60 * 60 * 1000;

export const PRO_PROMPT_LIMITS = {
  maxFolders: Infinity,
  maxFiles: Infinity,
  maxPagesPerFile: Infinity,
  maxToolCalls: 200,
  maxEmbedBoxesPerDay: Infinity,
};

export const PROMPT_LIMIT_COPY = {
  folder: 'El plan gratis permite carpetas ilimitadas.',
  file: 'El plan gratis permite files ilimitados.',
  page: 'El plan gratis incluye 20 páginas por file.',
  tools: 'Se acabaron los 3 clics del plan gratis.',
  storage: 'Llegaste al tope de 5 MB del plan gratis.',
  storagePro: 'Llegaste al tope de 5 GB.',
  coverPro: 'Las imágenes de portada son del plan de pago.',
  imageFrozen: 'Sin espacio para imágenes. Liberá storage o mejorá de plan.',
  embed: 'El plan gratis incluye 3 embeds por día. Mañana podés crear otro.',
  usage: 'No pude revisar las llamadas del plan gratis.',
  teleprompt: 'Create a new file or Upgrade to Pro to Unlock unlimited Features',
  telepromptEdit: 'Upgrade to Pro to keep editing this script.',
};

/** @param {string} [plan] */
export function isPromptPro(plan) {
  return plan === 'pro';
}

/** @param {string} [email] */
export function isDeskFreePreview(email) {
  if (!isDeskFounderProEnabled()) return false;
  return String(email || '').trim().toLowerCase() === DESK_FREE_PREVIEW_EMAIL;
}

/**
 * Plan the desk enforces. Founder email is Pro only when VITE_DESK_FOUNDER_PRO=true.
 * @param {string} [email]
 * @param {string} [profilePlan]
 */
export function deskPlan(email, profilePlan) {
  if (isDeskFreePreview(email)) return 'pro';
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
export function promptStorageBytes(plan) {
  return isPromptPro(plan) ? PRO_PROMPT_STORAGE_BYTES : FREE_PROMPT_STORAGE_BYTES;
}

/** Cover / portada images — paid plans only. */
export function canUsePromptCover(plan) {
  return isPromptPro(plan);
}

/**
 * Whether an image upload may proceed (Pro cover + storage headroom).
 * @param {string} [plan]
 * @param {number} [usedBytes]
 * @param {number} [incomingBytes]
 */
export function canAddPromptImage(plan, usedBytes = 0, incomingBytes = 0) {
  if (!canUsePromptCover(plan)) return false;
  const cap = promptStorageBytes(plan);
  return (Number(usedBytes) || 0) + (Number(incomingBytes) || 0) <= cap;
}

/** @param {string} [plan] */
export function promptLimits(plan) {
  let counts = OPEN_PROMPT_LIMITS;
  if (PROMPT_LIMITS_ENFORCED) {
    counts = isPromptPro(plan) ? PRO_PROMPT_LIMITS : FREE_PROMPT_LIMITS;
  }
  return { ...counts, storageBytes: promptStorageBytes(plan) };
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

/**
 * Free/Pro: file count from promptLimits (Free = unlimited).
 * @param {Array<{ id?: string, prompts?: unknown[] }>} [folders]
 * @param {string} [plan]
 * @param {string} [_folderId]
 */
export function canAddPromptFile(folders, plan, _folderId) {
  const cap = promptLimits(plan).maxFiles;
  if (!Number.isFinite(cap)) return true;
  return countPromptFiles(folders) < cap;
}

/**
 * Free: lifetime create counter (not live library length). Pro: always.
 * @param {number | Array<{ id?: string }>} createdCountOrItems
 * @param {string} [plan]
 */
export function canAddTeleprompt(createdCountOrItems, plan) {
  if (isPromptPro(plan)) return true;
  const used = Array.isArray(createdCountOrItems)
    ? createdCountOrItems.length
    : Math.max(0, Math.floor(Number(createdCountOrItems) || 0));
  return used < FREE_TELEPROMPT_MAX;
}

/**
 * Free: edit allowed only within FREE_TELEPROMPT_EDIT_MS of createdAt.
 * Pro: always.
 * @param {{ createdAt?: string } | null | undefined} item
 * @param {string} [plan]
 * @param {number} [now]
 */
export function canEditTeleprompt(item, plan, now = Date.now()) {
  if (isPromptPro(plan)) return true;
  return telepromptEditRemainingMs(item, now) > 0;
}

/**
 * Free edit window left after createdAt. Pro / missing date → 0 (UI hides countdown).
 * @param {{ createdAt?: string } | null | undefined} item
 * @param {number} [now]
 */
export function telepromptEditRemainingMs(item, now = Date.now()) {
  const created = new Date(item?.createdAt || '').getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, FREE_TELEPROMPT_EDIT_MS - (now - created));
}

/**
 * @param {number} ms
 * @returns {string} H:MM (hours can be 0–2 for the free window; minutes ceil remaining)
 */
export function formatTelepromptEditCountdown(ms) {
  const totalMin = Math.max(0, Math.ceil(Number(ms) / 60000) || 0);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
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
