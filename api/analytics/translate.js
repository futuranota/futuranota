// api/translate.js
// Vercel Function — migrada desde server/translateHandler.js
// El cache en memoria funciona por instancia de función — comportamiento esperado en serverless

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const MAX_BATCH = 100;
const MAX_CACHE_ENTRIES = 4000;

/** @type {Map<string, string>} */
const serverCache = new Map();

function resolveTranslateApiKey() {
  return process.env.GOOGLE_TRANSLATE_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GEMINI_API_KEY
    || null;
}

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

async function callGoogleTranslate(texts, target, source) {
  const apiKey = resolveTranslateApiKey();
  if (!apiKey) return null;

  const url = `${TRANSLATE_URL}?key=${encodeURIComponent(apiKey)}`;
  const body = { q: texts, target, format: "text" };
  if (source) body.source = source;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Translate ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const payload = await res.json();
  const items = payload?.data?.translations;
  if (!Array.isArray(items)) {
    throw new Error("Unexpected Google Translate response");
  }

  return items.map((item) => (typeof item?.translatedText === "string"
    ? item.translatedText
    : ""));
}

async function translateTexts(texts, target, source = "en") {
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

  for (let offset = 0; offset < pending.length; offset += MAX_BATCH) {
    const chunk = pending.slice(offset, offset + MAX_BATCH);
    const chunkIndexes = pendingIndexes.slice(offset, offset + MAX_BATCH);
    const translated = await callGoogleTranslate(chunk, target, source);
    if (!translated) {
      chunk.forEach((text, i) => {
        results[chunkIndexes[i]] = text;
      });
      continue;
    }
    translated.forEach((text, i) => {
      const original = chunk[i];
      results[chunkIndexes[i]] = text;
      serverCache.set(cacheKey(cacheSource, target, original), text);
    });
  }

  trimCache();
  return { translations: results, source: "google" };
}

// ── Vercel Function handler ──────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body ?? {};
    const target = typeof body.target === "string" ? body.target.trim() : "";
    const source = typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : null;
    const texts = Array.isArray(body.texts) ? body.texts : [];

    if (!target) {
      res.status(400).json({ error: "target is required" });
      return;
    }

    if (texts.length > 500) {
      res.status(400).json({ error: "Too many texts (max 500)" });
      return;
    }

    const result = await translateTexts(texts, target, source);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Translation failed",
    });
  }
}