import { useI18n } from "../../i18n/useI18n.js";
import { useThemeStore } from "../../stores/themeStore.js";

export function ThemeToggle({ className = "" }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { t } = useI18n();

  return (
    <div
      className={`theme-toggle notranslate${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={t("theme.label")}
      data-i18n-skip
    >
      <button
        type="button"
        className={`theme-toggle__btn${theme === "light" ? " is-active" : ""}`}
        aria-pressed={theme === "light"}
        title={t("theme.lightTitle")}
        onClick={() => setTheme("light")}
      >
        <span className="theme-toggle__icon" aria-hidden>☀</span>
      </button>
      <button
        type="button"
        className={`theme-toggle__btn${theme === "dark" ? " is-active" : ""}`}
        aria-pressed={theme === "dark"}
        title={t("theme.darkTitle")}
        onClick={() => setTheme("dark")}
      >
        <span className="theme-toggle__icon" aria-hidden>☾</span>
      </button>
    </div>
  );
}
