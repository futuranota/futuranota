/** Multi-URL references on a prompt file (Home + teleprompter). */

function makeRefId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} [partial]
 * @returns {{ id: string, name: string, url: string }}
 */
export function blankReference(partial = {}) {
  return {
    id: String(partial.id || makeRefId()),
    name: String(partial.name || ''),
    url: String(partial.url || ''),
  };
}

/**
 * @param {unknown} value
 * @returns {{ id: string, name: string, url: string }[]}
 */
export function normalizeReferenceList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && (String(item.url || '').trim() || String(item.name || '').trim()))
    .map((item) => blankReference(item));
}

/**
 * Prefer `references[]`; migrate legacy `referenceUrl` / `referenceName`.
 * @param {object} prompt
 * @returns {{ id: string, name: string, url: string }[]}
 */
export function normalizeReferences(prompt) {
  const fromList = normalizeReferenceList(prompt?.references);
  if (fromList.length) return fromList;
  const legacyUrl = String(prompt?.referenceUrl || '').trim();
  const legacyName = String(prompt?.referenceName || '').trim();
  if (!legacyUrl && !legacyName) return [];
  return [blankReference({ name: legacyName, url: legacyUrl })];
}

/**
 * Mirror first reference into legacy fields (sync / older readers).
 * @param {{ id?: string, name?: string, url?: string }[]} references
 */
export function legacyFieldsFromReferences(references) {
  const list = normalizeReferenceList(references);
  const first = list.find((item) => String(item.url || '').trim()) || list[0] || null;
  return {
    referenceUrl: first ? String(first.url || '') : '',
    referenceName: first ? String(first.name || '') : '',
  };
}

/**
 * @param {object} prompt
 */
export function withNormalizedReferences(prompt) {
  if (!prompt || typeof prompt !== 'object') return prompt;
  const references = normalizeReferences(prompt);
  return {
    ...prompt,
    references,
    ...legacyFieldsFromReferences(references),
  };
}

/**
 * @param {object} prompt
 * @returns {boolean}
 */
export function promptHasReferences(prompt) {
  return normalizeReferences(prompt).some((item) => String(item.url || '').trim());
}

/**
 * All URL entries inside a folder (for teleprompter URLs branch).
 * @param {object} folder
 * @returns {{ fileId: string, fileName: string, id: string, name: string, url: string }[]}
 */
export function folderReferenceEntries(folder) {
  const out = [];
  for (const file of folder?.prompts || []) {
    for (const ref of normalizeReferences(file)) {
      if (!String(ref.url || '').trim()) continue;
      out.push({
        fileId: file.id,
        fileName: file.name || 'Untitled',
        id: ref.id,
        name: ref.name,
        url: ref.url,
      });
    }
  }
  return out;
}
