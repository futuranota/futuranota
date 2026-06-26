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
 * Jina Reader prefixes responses with Title / URL Source / Markdown Content.
 * @param {string} text
 */
export function extractJinaMarkdownBody(text) {
  const raw = (text || "").trim();
  if (!raw) return "";

  const markerMatch = raw.match(/Markdown Content:\s*\n([\s\S]*)/i);
  if (markerMatch?.[1]) return markerMatch[1].trim();

  const lines = raw.split("\n");
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^Markdown Content:/i.test(line)) {
      bodyStart = i + 1;
      break;
    }
    if (/^(Title:|URL Source:|Published Time:|Warning:)/i.test(line) || line === "") {
      continue;
    }
    bodyStart = i;
    break;
  }
  return lines.slice(bodyStart).join("\n").trim();
}

/** @param {string} text */
export function stripMarkdownToPlain(text) {
  return (text || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const METADATA_LINE = /^(Title:|URL Source:|Published Time:|Markdown Content:|Warning:)/i;
const MAX_READER_PARAGRAPHS = 30;
const MIN_PARAGRAPH_LEN = 48;

/** @param {string} paragraph */
function isReadableParagraph(paragraph) {
  const p = paragraph.trim();
  if (p.length < MIN_PARAGRAPH_LEN) return false;
  if (METADATA_LINE.test(p)) return false;
  if (/^\|/.test(p)) return false;
  if (/^!\[Image \d+]/i.test(p)) return false;
  const letters = (p.match(/[a-zA-Z]/g) || []).length;
  return letters >= 20;
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

/** Split Jina markdown into clean plain-text paragraphs for CleanReader. */
export function splitReaderParagraphs(text) {
  const body = stripMarkdownToPlain(extractJinaMarkdownBody(text));
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(isReadableParagraph)
    .slice(0, MAX_READER_PARAGRAPHS);

  return paragraphs;
}
