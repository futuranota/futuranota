/** Normalize user/citation URLs for Jina Reader. */
export function normalizeArticleUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) throw new Error("Missing article URL");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Build fetch URL: dev uses Vite proxy to avoid CORS. */
export function jinaReaderEndpoint(articleUrl) {
  const full = normalizeArticleUrl(articleUrl);
  if (import.meta.env.DEV) {
    return `/jina/${full}`;
  }
  return `https://r.jina.ai/${full}`;
}

/**
 * Fetch article text via Jina Reader (markdown).
 * @param {string} articleUrl
 * @returns {Promise<string>}
 */
export async function fetchJinaArticle(articleUrl) {
  const endpoint = jinaReaderEndpoint(articleUrl);
  const res = await fetch(endpoint, {
    headers: {
      Accept: "text/markdown, text/plain, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`Could not load article (${res.status})`);
  }

  const text = await res.text();
  if (!text?.trim()) {
    throw new Error("Article returned empty content");
  }
  return text;
}

/** Split markdown/plain text into display paragraphs. */
export function splitReaderParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
