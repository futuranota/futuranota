const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const MAX_BATCH = 100;
const MAX_CACHE_ENTRIES = 4000;

/** @type {Map<string, string>} */
const serverCache = new Map();

/** @type {boolean} */
let loggedGoogleTranslateFailure = false;

function resolveTranslateApiKey() {
  return process.env.GOOGLE_TRANSLATE_API_KEY
    || process.env.GOOGLE_API_KEY
    || null;
}

function logGoogleTranslateFailure(message) {
  if (loggedGoogleTranslateFailure) return;
  loggedGoogleTranslateFailure = true;
  console.warn(`[translate] ${message} — returning original text (passthrough). Enable Cloud Translation API for GOOGLE_TRANSLATE_API_KEY in GCP.`);
}

/**
 * @param {string} source
 * @param {string} target
 * @param {string} text
 */
function cacheKey(source, target, text) {
  return `${source}|${target}|${text}`;
}

function trimCache() {
  if (serverCache.size <= MAX_CACHE_ENTRIES) return;
  const drop = serverCache.size - MAX_CACHE_ENTRIES;
  const keys = [...serverCache.keys()];
  for (let i = 0; i < drop; i += 1) {
    serverCache.delete(keys[i]);
  }
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * @param {string[]} texts
 * @param {string} target
 * @param {string | null} source
 * @returns {Promise<string[] | null>}
 */
async function callGoogleTranslate(texts, target, source) {
  const apiKey = resolveTranslateApiKey();
  if (!apiKey) return null;

  const url = `${TRANSLATE_URL}?key=${encodeURIComponent(apiKey)}`;
  const body = { q: texts, target, format: "text" };
  if (source) body.source = source;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logGoogleTranslateFailure(`Google API HTTP ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
      return null;
    }

    const payload = await res.json();
    const items = payload?.data?.translations;
    if (!Array.isArray(items)) {
      logGoogleTranslateFailure("Unexpected Google Translate response shape");
      return null;
    }

    return items.map((item) => (typeof item?.translatedText === "string"
      ? item.translatedText
      : ""));
  } catch (err) {
    logGoogleTranslateFailure(err instanceof Error ? err.message : "request failed");
    return null;
  }
}

/**
 * @param {string[]} texts
 * @param {string} target
 * @param {string | null} [source] omit for auto-detect
 */
export async function translateTexts(texts, target, source = "en") {
  const normalized = texts
    .map((text) => (typeof text === "string" ? text : ""))
    .filter((text) => text.length > 0);

  if (normalized.length === 0) {
    return { translations: [], source: "empty" };
  }

  const cacheSource = source || "auto";

  if (source && target === source) {
    return { translations: [...normalized], source: "identity" };
  }

  const results = new Array(normalized.length).fill("");
  const pending = [];
  const pendingIndexes = [];

  normalized.forEach((text, index) => {
    const cached = serverCache.get(cacheKey(cacheSource, target, text));
    if (cached != null) {
      results[index] = cached;
      return;
    }
    pending.push(text);
    pendingIndexes.push(index);
  });

  if (pending.length === 0) {
    return { translations: results, source: "cache" };
  }

  const apiKey = resolveTranslateApiKey();
  if (!apiKey) {
    for (let i = 0; i < pending.length; i += 1) {
      results[pendingIndexes[i]] = pending[i];
    }
    return { translations: results, source: "passthrough" };
  }

  let googleSucceeded = false;
  let googleFailed = false;

  for (let offset = 0; offset < pending.length; offset += MAX_BATCH) {
    const chunk = pending.slice(offset, offset + MAX_BATCH);
    const chunkIndexes = pendingIndexes.slice(offset, offset + MAX_BATCH);
    const translated = await callGoogleTranslate(chunk, target, source);
    if (!translated) {
      googleFailed = true;
      chunk.forEach((text, i) => {
        results[chunkIndexes[i]] = text;
      });
      continue;
    }
    googleSucceeded = true;
    translated.forEach((text, i) => {
      const original = chunk[i];
      results[chunkIndexes[i]] = text;
      serverCache.set(cacheKey(cacheSource, target, original), text);
    });
  }

  trimCache();

  const sourceKind = googleFailed && !googleSucceeded
    ? "passthrough"
    : googleSucceeded
      ? (googleFailed ? "partial" : "google")
      : "passthrough";

  return { translations: results, source: sourceKind };
}

/**
 * Shared POST handler for dev middleware and Vercel function.
 * @param {Record<string, unknown>} body
 */
export async function handleTranslatePost(body) {
  const target = typeof body.target === "string" ? body.target.trim() : "";
  const source = typeof body.source === "string" && body.source.trim()
    ? body.source.trim()
    : null;
  const texts = Array.isArray(body.texts) ? body.texts : [];

  if (!target) {
    return { status: 400, body: { error: "target is required" } };
  }

  if (texts.length > 500) {
    return { status: 400, body: { error: "Too many texts (max 500)" } };
  }

  const result = await translateTexts(texts, target, source);
  return { status: 200, body: result };
}

/**
 * Vite / Node middleware for POST /api/translate
 */
export function createTranslateMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/translate") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const outcome = await handleTranslatePost(body);

      res.statusCode = outcome.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(outcome.body));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Translation failed",
      }));
    }
  };
}
