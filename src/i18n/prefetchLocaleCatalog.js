import { flattenMessages } from "./flattenMessages.js";
import { messages } from "./messages.js";
import { prefetchMessageCatalog } from "./translateApi.js";
import { useLocaleStore } from "./localeStore.js";

/** @type {Promise<void> | null} */
let inflightPrefetch = null;

/**
 * Prefetch Google Translate strings for static UI catalog.
 * @param {'en' | 'es'} locale
 */
export async function prefetchLocaleCatalog(locale) {
  if (locale === "en") return;

  if (inflightPrefetch) {
    await inflightPrefetch;
    return;
  }

  inflightPrefetch = (async () => {
    const enFlat = flattenMessages(messages.en);
    const manualFlat = flattenMessages(messages[locale] || {});
    await prefetchMessageCatalog(enFlat, manualFlat, locale);
    useLocaleStore.getState().bumpTranslationRevision();
  })().finally(() => {
    inflightPrefetch = null;
  });

  await inflightPrefetch;
}
