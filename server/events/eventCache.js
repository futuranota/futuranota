/** 24h — PredictHQ recommends caching; Calendarific free tier is 500 calls/month. */
export const EVENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { expiresAt: number, payload: unknown }>} */
const memoryCache = new Map();

/**
 * @param {string} cacheKey
 */
export function readEventCache(cacheKey) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

/**
 * @param {string} cacheKey
 * @param {unknown} payload
 */
export function writeEventCache(cacheKey, payload) {
  memoryCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + EVENT_CACHE_TTL_MS,
  });
}
