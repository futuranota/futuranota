import { useCallback } from "react";
import { messages } from "./messages.js";
import { useLocaleStore } from "./localeStore.js";
import { getCachedTranslation, translateText } from "./translateApi.js";

/**
 * @param {string} template
 * @param {Record<string, string | number>} [vars]
 */
function formatMessage(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

/**
 * @param {string} key dot-separated path, e.g. "topbar.scanBlogs"
 * @param {'en' | 'es'} locale
 */
function lookupMessage(key, locale) {
  const parts = key.split(".");
  let value = messages[locale];
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === "string" ? value : null;
}

function resolveTemplate(key, locale, translationRevision) {
  void translationRevision;
  const enTemplate = lookupMessage(key, "en") ?? key;
  if (locale === "en") return enTemplate;

  const manual = lookupMessage(key, locale);
  if (manual) return manual;

  return getCachedTranslation("en", locale, enTemplate) ?? enTemplate;
}

export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);
  const translationRevision = useLocaleStore((s) => s.translationRevision);

  const t = useCallback((key, vars) => {
    const template = resolveTemplate(key, locale, translationRevision);
    return vars ? formatMessage(template, vars) : template;
  }, [locale, translationRevision]);

  const tText = useCallback(async (text) => {
    if (!text || locale === "en") return text;
    return translateText(text, locale, "en");
  }, [locale]);

  return { locale, setLocale, toggleLocale, t, tText };
}

/** Non-hook helper for store callbacks / event handlers. */
export function translate(key, locale, vars) {
  const template = resolveTemplate(key, locale, 0);
  return vars ? formatMessage(template, vars) : template;
}
