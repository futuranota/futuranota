import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { messages } from "./messages.js";
import { prefetchLocaleCatalog } from "./prefetchLocaleCatalog.js";

const STORAGE_KEY = "futuranota-locale";

/** @returns {'en' | 'es'} */
function readStoredLocale() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "en" || value === "es") return value;
  } catch {
    /* ignore */
  }
  return "en";
}

/** @param {'en' | 'es'} locale */
export function applyDocumentLocale(locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

const initialLocale = readStoredLocale();
applyDocumentLocale(initialLocale);

export const useLocaleStore = create(
  devtools(
    (set) => ({
      locale: initialLocale,
      translationRevision: 0,

      bumpTranslationRevision: () => set((state) => ({
        translationRevision: state.translationRevision + 1,
      })),

      /** @param {'en' | 'es'} locale */
      setLocale: (locale) => {
        if (!messages[locale]) return;
        try {
          localStorage.setItem(STORAGE_KEY, locale);
        } catch {
          /* ignore */
        }
        applyDocumentLocale(locale);
        set({ locale });
        prefetchLocaleCatalog(locale);
      },

      toggleLocale: () => set((state) => {
        const next = state.locale === "en" ? "es" : "en";
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        applyDocumentLocale(next);
        prefetchLocaleCatalog(next);
        return { locale: next };
      }),
    }),
    { name: "locale-store" },
  ),
);

if (initialLocale !== "en") {
  prefetchLocaleCatalog(initialLocale);
}
