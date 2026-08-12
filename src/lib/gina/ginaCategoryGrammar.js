/**
 * Spanish (and EN) phrasing helpers for live category names in Gina copy.
 */

import { foldGinaText } from "./ginaTimeScope.js";

/** @type {Record<string, { es: { article: string, label: string }, en: { article: string, label: string } }>} */
const CATEGORY_PHRASE_OVERRIDES = {
  blogs: {
    es: { article: "los", label: "blogs" },
    en: { article: "the", label: "blogs" },
  },
  blog: {
    es: { article: "los", label: "blogs" },
    en: { article: "the", label: "blogs" },
  },
  script: {
    es: { article: "los", label: "scripts" },
    en: { article: "the", label: "scripts" },
  },
  scripts: {
    es: { article: "los", label: "scripts" },
    en: { article: "the", label: "scripts" },
  },
  "social media": {
    es: { article: "las", label: "redes sociales" },
    en: { article: "the", label: "social media" },
  },
};

/**
 * @param {string} categoryName live category label
 * @param {{ locale?: "es"|"en" }} [opts]
 * @returns {{ label: string, article: string, phrase: string, ofPhrase: string }}
 */
export function formatCategoryPhrase(categoryName, opts = {}) {
  const en = opts.locale === "en";
  const raw = String(categoryName || "").trim();
  const key = foldGinaText(raw);
  const override = CATEGORY_PHRASE_OVERRIDES[key];
  if (override) {
    const row = en ? override.en : override.es;
    return {
      label: row.label,
      article: row.article,
      phrase: `${row.article} ${row.label}`,
      ofPhrase: en ? `of ${row.label}` : `de ${row.article} ${row.label}`,
    };
  }
  const label = en ? raw : raw.toLowerCase();
  const article = en ? "the" : guessSpanishArticle(label);
  return {
    label,
    article,
    phrase: en ? `${article} ${label}` : `${article} ${label}`,
    ofPhrase: en ? `of ${label}` : `de ${article} ${label}`,
  };
}

/**
 * @param {string} label lowercased label
 */
function guessSpanishArticle(label) {
  if (!label) return "la";
  if (/\b(blog|script|folder|documento)s?\b/.test(label)) return "los";
  if (/^(plan|marketing|sales|negocio)/.test(label)) return "el";
  if (label.endsWith("s") && !label.endsWith("as")) return "los";
  if (label.endsWith("a")) return "la";
  return "los";
}

/**
 * @param {string} needle raw search word
 * @param {{ locale?: "es"|"en" }} [opts]
 */
export function formatNeedlePhrase(needle, opts = {}) {
  const en = opts.locale === "en";
  const label = String(needle || "").trim().toLowerCase();
  if (!label) return en ? "that" : "eso";
  return label;
}
