import { fetchTranslations } from "./translateApi.js";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG", "PATH"]);
const ATTRS = ["placeholder", "title", "aria-label"];
const CHUNK_SIZE = 80;

/** @type {Map<string, string>} */
const translationCache = new Map();

/** @type {Set<string>} */
const pendingSources = new Set();

/** @type {Promise<void> | null} */
let flushPromise = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let flushTimer = null;

let observerPaused = false;

function normalizeKey(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function shouldSkipElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest(".notranslate, .lang-toggle, [data-i18n-skip]")) return true;
  if (el.isContentEditable) return true;
  if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && document.activeElement === el) {
    return true;
  }
  return false;
}

function isTranslatableString(value) {
  const text = normalizeKey(value);
  if (!text || text.length < 2) return false;
  if (/^[\d\s.,:;+\-–—/\\|°%$€£#@&*()[\]{}<>→]+$/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  return true;
}

function readAttrOrigin(el, attr) {
  return el.getAttribute(`data-i18n-orig-${attr}`);
}

function writeAttrOrigin(el, attr, value) {
  el.setAttribute(`data-i18n-orig-${attr}`, value);
}

/**
 * @param {HTMLElement} root
 * @returns {Set<string>}
 */
function collectMissingSources(root) {
  /** @type {Set<string>} */
  const missing = new Set();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      const text = normalizeKey(node.textContent);
      if (!isTranslatableString(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    const text = normalizeKey(node.textContent);
    if (!translationCache.has(text)) missing.add(text);
    node = walker.nextNode();
  }

  root.querySelectorAll("*").forEach((el) => {
    if (shouldSkipElement(el)) return;
    for (const attr of ATTRS) {
      const current = el.getAttribute(attr);
      if (!isTranslatableString(current)) continue;
      if (!readAttrOrigin(el, attr)) writeAttrOrigin(el, attr, current);
      const source = readAttrOrigin(el, attr) || current;
      if (!translationCache.has(source)) missing.add(source);
    }
  });

  return missing;
}

/**
 * @param {HTMLElement} root
 */
function applyCachedTranslations(root) {
  if (observerPaused) return;

  observerPaused = true;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const textNode = /** @type {Text} */ (node);
      const current = normalizeKey(textNode.textContent);
      const translated = translationCache.get(current);
      if (translated && translated !== textNode.textContent) {
        textNode.textContent = translated;
      }
      node = walker.nextNode();
    }

    root.querySelectorAll("*").forEach((el) => {
      if (shouldSkipElement(el)) return;
      for (const attr of ATTRS) {
        const origin = readAttrOrigin(el, attr);
        if (!origin) continue;
        const translated = translationCache.get(origin);
        if (translated && el.getAttribute(attr) !== translated) {
          el.setAttribute(attr, translated);
        }
      }
    });
  } finally {
    observerPaused = false;
  }
}

async function fetchTranslationsChunked(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    const translated = await fetchTranslations(chunk, "es");
    out.push(...translated);
  }
  return out;
}

async function flushPendingTranslations(root) {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const batch = [...pendingSources].filter((s) => !translationCache.has(s));
    pendingSources.clear();
    if (!batch.length) return;

    try {
      const translated = await fetchTranslationsChunked(batch);
      batch.forEach((source, index) => {
        translationCache.set(source, translated[index] ?? source);
      });
    } catch (err) {
      console.warn("[i18n] Page translation batch failed:", err);
      batch.forEach((source) => translationCache.set(source, source));
    }

    applyCachedTranslations(root);
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

function scheduleFlush(root) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPendingTranslations(root);
  }, 120);
}

/**
 * @param {HTMLElement} root
 */
export async function syncDomPageTranslation(root) {
  if (!root) return;

  const missing = collectMissingSources(root);
  missing.forEach((source) => pendingSources.add(source));
  applyCachedTranslations(root);
  if (missing.size > 0) {
    await flushPendingTranslations(root);
  }
}

export function clearDomPageTranslation() {
  translationCache.clear();
  pendingSources.clear();
}

/**
 * @param {HTMLElement} root
 * @param {'en' | 'es'} locale
 */
export async function translateDomPage(root, locale) {
  if (!root) return;
  if (locale === "en") {
    clearDomPageTranslation();
    return;
  }
  await syncDomPageTranslation(root);
}

/**
 * @param {HTMLElement} root
 * @param {() => 'en' | 'es'} getLocale
 */
/** Re-apply cached Spanish without new API calls (call after React renders). */
export function tickDomPageTranslation(root) {
  if (!root) return;
  applyCachedTranslations(root);
}

export function attachDomTranslationObserver(root, getLocale) {
  const observer = new MutationObserver(() => {
    if (observerPaused || getLocale() !== "es") return;
    const missing = collectMissingSources(root);
    missing.forEach((source) => pendingSources.add(source));
    applyCachedTranslations(root);
    if (missing.size > 0) scheduleFlush(root);
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });

  return observer;
}
