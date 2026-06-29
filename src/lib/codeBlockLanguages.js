export const CODE_BLOCK_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
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
