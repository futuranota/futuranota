/**
 * Lifetime count of "save day sheet" pitch exposures (novice vs recurrent copy).
 */

export const GINA_DAY_SHEET_OFFER_STORAGE_KEY = "fn-gina-day-sheet-offer-v1";

function storageKey(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  return `${GINA_DAY_SHEET_OFFER_STORAGE_KEY}:${uid}`;
}

function getStorage() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readRow(userId) {
  try {
    const storage = getStorage();
    if (!storage) return { offerCount: 0 };
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return { offerCount: 0 };
    const parsed = JSON.parse(raw);
    const n = Number(parsed?.offerCount);
    return { offerCount: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0 };
  } catch {
    return { offerCount: 0 };
  }
}

function writeRow(userId, row) {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(storageKey(userId), JSON.stringify({
      offerCount: Math.max(0, Math.floor(Number(row?.offerCount) || 0)),
    }));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} [userId]
 * @returns {number}
 */
export function getDaySheetOfferCount(userId) {
  return readRow(userId).offerCount;
}

/**
 * Increment and return the new count (after increment).
 * @param {string} [userId]
 * @returns {number}
 */
export function incrementDaySheetOfferCount(userId) {
  const next = getDaySheetOfferCount(userId) + 1;
  writeRow(userId, { offerCount: next });
  return next;
}

/**
 * Test helper / reset.
 * @param {string} [userId]
 * @param {number} [count]
 */
export function setDaySheetOfferCount(userId, count = 0) {
  writeRow(userId, { offerCount: count });
}

/**
 * @param {string} [userId]
 */
export function clearDaySheetOfferCount(userId) {
  try {
    const storage = getStorage();
    storage?.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}
