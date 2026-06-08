import { create } from "zustand";
import { devtools } from "zustand/middleware";

const STORAGE_KEY = "futuranota-theme";

/** @returns {'dark' | 'light'} */
function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") return value;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** @param {'dark' | 'light'} theme */
export function applyDocumentTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

const initialTheme = readStoredTheme();
applyDocumentTheme(initialTheme);

export const useThemeStore = create(
  devtools(
    (set) => ({
      theme: initialTheme,

      /** @param {'dark' | 'light'} theme */
      setTheme: (theme) => {
        if (theme !== "dark" && theme !== "light") return;
        try {
          localStorage.setItem(STORAGE_KEY, theme);
        } catch {
          /* ignore */
        }
        applyDocumentTheme(theme);
        set({ theme });
      },

      toggleTheme: () => set((state) => {
        const next = state.theme === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        applyDocumentTheme(next);
        return { theme: next };
      }),
    }),
    { name: "theme-store" },
  ),
);
