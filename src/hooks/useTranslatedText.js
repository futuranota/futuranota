import { useEffect, useState } from "react";
import { useLocaleStore } from "../i18n/localeStore.js";
import { translateText } from "../i18n/translateApi.js";

/**
 * Translate dynamic user-facing text when locale !== en.
 * @param {string | null | undefined} text
 */
export function useTranslatedText(text) {
  const locale = useLocaleStore((s) => s.locale);
  const translationRevision = useLocaleStore((s) => s.translationRevision);
  const source = text ?? "";
  const [value, setValue] = useState(source);

  useEffect(() => {
    let active = true;
    if (!source || locale === "en") {
      setValue(source);
      return () => { active = false; };
    }

    translateText(source, locale, "en").then((next) => {
      if (active) setValue(next);
    });

    return () => { active = false; };
  }, [source, locale, translationRevision]);

  return value;
}
