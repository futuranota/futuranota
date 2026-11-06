/** Local library of saved teleprompter scripts (list + status). */

export const TELEPROMPTER_LIBRARY_STORE = 'fn-teleprompter-library-v1';

/** Lifetime free creates (does not decrease on delete). */
export const TELEPROMPTER_CREATED_STORE = 'fn-teleprompter-created-v1';

export const TELEPROMPT_STATUS = {
  pending: 'pending',
  completed: 'completed',
};

/**
 * @returns {string}
 */
function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tp-lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {unknown} value
 * @returns {'pending' | 'completed'}
 */
export function normalizeTelepromptStatus(value) {
  return value === TELEPROMPT_STATUS.completed
    ? TELEPROMPT_STATUS.completed
    : TELEPROMPT_STATUS.pending;
}

/**
 * @param {object} [partial]
 * @returns {{ id: string, name: string, createdAt: string, updatedAt: string, status: 'pending' | 'completed', nodes: object[] }}
 */
export function blankTeleprompt(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: String(partial.id || makeId()),
    name: String(partial.name || '').trim(),
    createdAt: String(partial.createdAt || now),
    updatedAt: String(partial.updatedAt || now),
    status: normalizeTelepromptStatus(partial.status),
    nodes: Array.isArray(partial.nodes) ? partial.nodes : [],
  };
}

/**
 * @param {unknown} value
 * @returns {ReturnType<typeof blankTeleprompt>[]}
 */
export function normalizeTelepromptLibrary(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => blankTeleprompt(item))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/**
 * @returns {ReturnType<typeof blankTeleprompt>[]}
 */
export function readTelepromptLibrary() {
  try {
    const raw = localStorage.getItem(TELEPROMPTER_LIBRARY_STORE);
    if (!raw) return [];
    return normalizeTelepromptLibrary(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * @param {ReturnType<typeof blankTeleprompt>[]} items
 */
export function writeTelepromptLibrary(items) {
  const next = normalizeTelepromptLibrary(items);
  try {
    localStorage.setItem(TELEPROMPTER_LIBRARY_STORE, JSON.stringify(next));
  } catch {
    /* Private mode / quota */
  }
  return next;
}

/**
 * Free plan lifetime create counter. Seeded once from library length if unset.
 * @returns {number}
 */
export function readTelepromptCreatedCount() {
  try {
    const raw = localStorage.getItem(TELEPROMPTER_CREATED_STORE);
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
  } catch {
    /* ignore */
  }
  const seeded = readTelepromptLibrary().length;
  writeTelepromptCreatedCount(seeded);
  return seeded;
}

/** @param {number} count @returns {number} */
export function writeTelepromptCreatedCount(count) {
  const next = Math.max(0, Math.floor(Number(count) || 0));
  try {
    localStorage.setItem(TELEPROMPTER_CREATED_STORE, String(next));
  } catch {
    /* Private mode / quota */
  }
  return next;
}

/** @returns {number} */
export function bumpTelepromptCreatedCount() {
  return writeTelepromptCreatedCount(readTelepromptCreatedCount() + 1);
}

/**
 * @param {string | Date | number} value
 * @returns {string}
 */
export function formatTelepromptUploaded(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}
