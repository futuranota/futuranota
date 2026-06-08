import { LanguageToggle } from "./LanguageToggle.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

/** Language + light/dark toggles for navbar / topbar. */
export function NavPreferences({ className = "" }) {
  return (
    <div className={`nav__prefs notranslate${className ? ` ${className}` : ""}`} data-i18n-skip>
      <LanguageToggle className="nav__lang-toggle" />
      <ThemeToggle className="nav__theme-toggle" />
    </div>
  );
}
