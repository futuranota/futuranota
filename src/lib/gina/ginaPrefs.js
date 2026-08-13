/**
 * Gina session preferences (table + calendar).
 * UI settings can call setGinaPrefs later; defaults are product-safe.
 *
 * weekStartsOn: 0 = Sunday, 1 = Monday (default ES labor week).
 * secondaryColumn: "category" | "folder" — Doc + this in default listados.
 */

const STORAGE_KEY = "futuranota-gina-prefs";

/** @typedef {{ weekStartsOn: 0 | 1, secondaryColumn: "category" | "folder" }} GinaPrefs */

/** @type {GinaPrefs} */
const DEFAULTS = {
  weekStartsOn: 1,
  secondaryColumn: "category",
};

/** @type {GinaPrefs} */
let prefs = { ...DEFAULTS };

function readStored() {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(next) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function normalize(partial = {}) {
  const weekStartsOn = partial.weekStartsOn === 0 || partial.weekStartsOn === 1
    ? partial.weekStartsOn
    : DEFAULTS.weekStartsOn;
  const secondaryColumn = partial.secondaryColumn === "folder" ? "folder" : "category";
  return { weekStartsOn, secondaryColumn };
}

/** Hydrate from localStorage once (safe to call repeatedly). */
export function hydrateGinaPrefs() {
  const stored = readStored();
  if (stored) prefs = normalize({ ...DEFAULTS, ...stored });
  return { ...prefs };
}

hydrateGinaPrefs();

/** @returns {GinaPrefs} */
export function getGinaPrefs() {
  return { ...prefs };
}

/**
 * @param {Partial<GinaPrefs>} partial
 * @returns {GinaPrefs}
 */
export function setGinaPrefs(partial = {}) {
  prefs = normalize({ ...prefs, ...partial });
  writeStored(prefs);
  return { ...prefs };
}

/** Reset to product defaults (tests). */
export function resetGinaPrefs() {
  prefs = { ...DEFAULTS };
  writeStored(prefs);
  return { ...prefs };
}
