import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  attachDomTranslationObserver,
  clearDomPageTranslation,
  syncDomPageTranslation,
  tickDomPageTranslation,
} from "../../i18n/domPageTranslator.js";
import { useLocaleStore } from "../../i18n/localeStore.js";

/**
 * Full-page translation: caches API results and re-applies after every React render.
 */
export function DomPageTranslator() {
  const locale = useLocaleStore((s) => s.locale);
  const translationRevision = useLocaleStore((s) => s.translationRevision);
  const { pathname } = useLocation();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return undefined;

    if (locale === "en") {
      clearDomPageTranslation();
      return undefined;
    }

    const run = () => {
      syncDomPageTranslation(root).catch((err) => {
        console.warn("[i18n] Page translation failed:", err);
      });
    };

    run();

    const observer = attachDomTranslationObserver(root, () => localeRef.current);

    const interval = setInterval(() => {
      if (localeRef.current === "es") tickDomPageTranslation(root);
    }, 350);

    const stopBurst = setTimeout(() => clearInterval(interval), 12000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(stopBurst);
    };
  }, [locale, translationRevision, pathname]);

  return null;
}
