export const CODE_BLOCK_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "tsx", label: "TSX (React)" },
  { id: "python", label: "Python" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "sql", label: "SQL" },
  { id: "bash", label: "Bash" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "yaml", label: "YAML" },
  { id: "markdown", label: "Markdown" },
  { id: "plaintext", label: "Plain text" },
];

export const DEFAULT_CODE_LANGUAGE = "javascript";

export function normalizeCodeLanguage(language) {
  const normalized = String(language ?? "").trim().toLowerCase();
  if (CODE_BLOCK_LANGUAGES.some((entry) => entry.id === normalized)) {
    return normalized;
  }
  return DEFAULT_CODE_LANGUAGE;
}

export function codeLanguageLabel(language) {
  const match = CODE_BLOCK_LANGUAGES.find((entry) => entry.id === normalizeCodeLanguage(language));
  return match?.label ?? "JavaScript";
}

/** Prompt box formats: Text (default) + code languages (no duplicate plaintext). */
export const DEFAULT_PROMPT_FORMAT = "text";

export const PROMPT_FORMATS = [
  { id: "text", label: "Text" },
  ...CODE_BLOCK_LANGUAGES.filter((entry) => entry.id !== "plaintext"),
];

/**
 * @param {unknown} format
 * @param {{ promptMd?: boolean }} [opts]
 */
export function normalizePromptFormat(format, opts = {}) {
  const raw = String(format ?? "").trim().toLowerCase();
  if (raw === "plaintext") return DEFAULT_PROMPT_FORMAT;
  if (PROMPT_FORMATS.some((entry) => entry.id === raw)) return raw;
  if (!raw && Boolean(opts.promptMd)) return "markdown";
  return DEFAULT_PROMPT_FORMAT;
}

export function promptFormatLabel(format) {
  const id = normalizePromptFormat(format);
  const match = PROMPT_FORMATS.find((entry) => entry.id === id);
  return match?.label ?? "Text";
}
