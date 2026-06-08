import { apiClient } from "../api/client.js";

const CLIENT_CACHE_KEY = "futuranota-translate-cache";
const MAX_CLIENT_CACHE = 2000;

/** @type {Map<string, string>} */
const memoryCache = new Map();

/** @type {Map<string, Promise<string[]>>} */
const inflightBatches = new Map();

function storageCacheKey(source, target, text) {
  return `${source}|${target}|${text}`;
}

function readStorageCache() {
  try {
    const raw = localStorage.getItem(CLIENT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorageCache(map) {
  try {
    localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function getCached(source, target, text) {
  const key = storageCacheKey(source, target, text);
  if (memoryCache.has(key)) return memoryCache.get(key);
  const stored = readStorageCache()[key];
  if (typeof stored === "string") {
    memoryCache.set(key, stored);
    return stored;
  }
  return null;
}

function setCached(source, target, text, translated) {
  const key = storageCacheKey(source, target, text);
  memoryCache.set(key, translated);
  const stored = readStorageCache();
  stored[key] = translated;
  const keys = Object.keys(stored);
  if (keys.length > MAX_CLIENT_CACHE) {
    for (const oldKey of keys.slice(0, keys.length - MAX_CLIENT_CACHE)) {
      delete stored[oldKey];
      memoryCache.delete(oldKey);
    }
  }
  writeStorageCache(stored);
}

/**
 * @param {string[]} texts
 * @param {string} target
 * @param {string} [source]
 */
export async function fetchTranslations(texts, target, source = "en") {
  const normalized = texts.map((text) => (typeof text === "string" ? text : ""));
  const cacheSource = source || "auto";
  if (source && target === source) return normalized;

  const missing = [];
  const missingIndexes = [];
  const results = [...normalized];

  normalized.forEach((text, index) => {
    if (!text) return;
    const cached = getCached(cacheSource, target, text);
    if (cached != null) {
      results[index] = cached;
      return;
    }
    missing.push(text);
    missingIndexes.push(index);
  });

  if (missing.length === 0) return results;

  const batchKey = `${cacheSource}|${target}|${missing.join("\u0001")}`;
  let request = inflightBatches.get(batchKey);
  if (!request) {
    const payloadBody = { texts: missing, target };
    if (source) payloadBody.source = source;
    request = apiClient("/api/translate", {
      method: "POST",
      body: JSON.stringify(payloadBody),
    }).then((payload) => {
      const translations = Array.isArray(payload?.translations) ? payload.translations : missing;
      return translations.map((value, i) => {
        const original = missing[i];
        const translated = typeof value === "string" ? value : original;
        setCached(cacheSource, target, original, translated);
        return translated;
      });
    }).catch(() => missing).finally(() => {
      inflightBatches.delete(batchKey);
    });
    inflightBatches.set(batchKey, request);
  }

  const translatedChunk = await request;
  missingIndexes.forEach((index, i) => {
    results[index] = translatedChunk[i] ?? normalized[index];
  });

  return results;
}

/**
 * @param {string} text
 * @param {string} target
 * @param {string} [source]
 */
export async function translateText(text, target, source = "en") {
  if (!text || target === source) return text;
  const cached = getCached(source, target, text);
  if (cached != null) return cached;
  const [translated] = await fetchTranslations([text], target, source);
  return translated ?? text;
}

/**
 * @param {Record<string, string>} enByKey English catalog keyed by i18n path
 * @param {Record<string, string>} manualTarget Manual overrides for target locale
 * @param {string} target
 */
export async function prefetchMessageCatalog(enByKey, manualTarget, target) {
  const entries = Object.entries(enByKey).filter(([key, enText]) => {
    if (!enText) return false;
    if (manualTarget[key]) return false;
    return getCached("en", target, enText) == null;
  });

  if (entries.length === 0) return 0;

  const texts = entries.map(([, text]) => text);
  const translated = await fetchTranslations(texts, target, "en");
  return translated.length;
}

/** Sync read from client cache (memory + localStorage). */
export function getCachedTranslation(source, target, text) {
  return getCached(source, target, text);
}
