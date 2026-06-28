import { isFutureLaunchDate } from "./campaignWindow.js";

/**
 * Drop obvious noise from Tavily/Serper hits (app stores, generic podcasts).
 * @param {Array<{ link?: string, title?: string, snippet?: string }>} hits
 * @param {string} [brandName]
 */
export function filterIntelSnippets(hits, brandName = "") {
  if (!Array.isArray(hits)) return [];

  const brand = (brandName || "").trim().toLowerCase();
  const noisePatterns = [
    /apps\.apple\.com/i,
    /podcasts\.apple\.com/i,
    /play\.google\.com/i,
    /google\.com\/news/i,
    /news\.google\.com/i,
  ];

  return hits.filter((hit) => {
    const url = (hit.link || "").trim();
    const title = (hit.title || "").trim();
    const snippet = (hit.snippet || "").trim();
    if (!url && !snippet && !title) return false;

    if (noisePatterns.some((re) => re.test(url))) {
      if (brand && (title.toLowerCase().includes(brand) || snippet.toLowerCase().includes(brand))) {
        return true;
      }
      return false;
    }

    return true;
  });
}

/**
 * Prefer future launch signals; keep undated rumors for analyst review.
 * @param {Array<{ phrase?: string, dateHint?: string|null, url?: string, quote?: string }>} signals
 * @param {Date} [today]
 */
export function filterForwardLaunchSignals(signals, today = new Date()) {
  if (!Array.isArray(signals)) return [];

  return signals.filter((sig) => {
    const hint = sig?.dateHint || "";
    if (!hint || !String(hint).trim()) return true;
    return isFutureLaunchDate(hint, today);
  });
}
