import { fetchJinaArticle, splitReaderParagraphs } from "./jinaReader.js";
import { fetchProxiedPage } from "./webProxy.js";

/** @typedef {'html'|'reader'|'snippet'} SourcePreviewMode */

/**
 * @typedef {Object} SourcePreviewResult
 * @property {SourcePreviewMode} mode
 * @property {string} label
 * @property {string} [html]
 * @property {string[]} [paragraphs]
 * @property {string} [fallbackNote]
 */

/**
 * Preview ladder: proxy HTML → Jina reader text → Serper snippet.
 * @param {{ url: string, snippet?: string, accessToken?: string }} params
 * @returns {Promise<SourcePreviewResult>}
 */
export async function loadSourcePreview({ url, snippet, accessToken }) {
  let proxyError = "Preview unavailable";

  try {
    const html = await fetchProxiedPage(url, accessToken);
    return {
      mode: "html",
      label: "Live preview",
      html,
    };
  } catch (err) {
    proxyError = err instanceof Error ? err.message : proxyError;
  }

  try {
    const markdown = await fetchJinaArticle(url);
    const paragraphs = splitReaderParagraphs(markdown);
    if (paragraphs.length) {
      return {
        mode: "reader",
        label: "Reader mode",
        paragraphs,
        fallbackNote: proxyError,
      };
    }
  } catch {
    /* try snippet next */
  }

  const excerpt = (snippet || "").trim();
  if (excerpt) {
    return {
      mode: "snippet",
      label: "Search excerpt",
      paragraphs: [excerpt],
      fallbackNote: proxyError,
    };
  }

  throw new Error(proxyError);
}
