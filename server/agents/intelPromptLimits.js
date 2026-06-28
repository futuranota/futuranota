/** Max snippets sent to Groq/Gemini in analyst + deep-extract prompts. */
export const MAX_LLM_SNIPPETS = 8;

/** Max chars per snippet body in prompts. */
export const MAX_SNIPPET_CHARS = 240;

/** Max total chars for search corpus block in analyst user message. */
export const MAX_ANALYST_CORPUS_CHARS = 8_000;

/**
 * @param {string} text
 * @param {number} [max]
 */
export function truncateText(text, max = MAX_SNIPPET_CHARS) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * @param {Array<{ title?: string, snippet?: string, link?: string, date?: string|null, body?: string }>} snippets
 * @param {number} [maxCount]
 */
export function trimSnippetsForPrompt(snippets, maxCount = MAX_LLM_SNIPPETS) {
  return (snippets || []).slice(0, maxCount).map((s) => ({
    ...s,
    title: truncateText(s.title || "", 120),
    snippet: truncateText(s.snippet || s.body || "", MAX_SNIPPET_CHARS),
    body: truncateText(s.body || s.snippet || "", MAX_SNIPPET_CHARS),
  }));
}

/**
 * @param {string} corpus
 * @param {number} [maxChars]
 */
export function trimCorpusForPrompt(corpus, maxChars = MAX_ANALYST_CORPUS_CHARS) {
  const t = (corpus || "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[… recortado por límite del modelo — priorizadas las fuentes más recientes]`;
}
