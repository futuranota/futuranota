import { useI18n } from "../../i18n/useI18n.js";

export function LanguageToggle({ className = "" }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`lang-toggle notranslate${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={t("lang.label")}
      data-i18n-skip
    >
      <button
        type="button"
        className={`lang-toggle__btn${locale === "en" ? " is-active" : ""}`}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        {t("lang.en")}
      </button>
      <button
        type="button"
        className={`lang-toggle__btn${locale === "es" ? " is-active" : ""}`}
        aria-pressed={locale === "es"}
        onClick={() => setLocale("es")}
      >
        {t("lang.es")}
      </button>
    </div>
  );
}
