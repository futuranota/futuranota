import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { normalizeCodeLanguage } from "./codeBlockLanguages.js";

const LANGUAGE_REGISTRATIONS = [
  ["bash", bash],
  ["c", c],
  ["cpp", cpp],
  ["css", css],
  ["go", go],
  ["java", java],
  ["javascript", javascript],
  ["json", json],
  ["kotlin", kotlin],
  ["markdown", markdown],
  ["php", php],
  ["python", python],
  ["ruby", ruby],
  ["rust", rust],
  ["sql", sql],
  ["swift", swift],
  ["typescript", typescript],
  ["xml", xml],
  ["yaml", yaml],
];

for (const [name, grammar] of LANGUAGE_REGISTRATIONS) {
  if (!hljs.getLanguage(name)) {
    hljs.registerLanguage(name, grammar);
  }
}

const HIGHLIGHT_LANGUAGE_MAP = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  html: "xml",
  css: "css",
  json: "json",
  sql: "sql",
  bash: "bash",
  java: "java",
  go: "go",
  rust: "rust",
  c: "c",
  cpp: "cpp",
  php: "php",
  ruby: "ruby",
  swift: "swift",
  kotlin: "kotlin",
  yaml: "yaml",
  markdown: "markdown",
  plaintext: null,
};

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightCodeSnippet(code, language) {
  const source = String(code ?? "");
  if (!source.trim()) return "";

  const normalized = normalizeCodeLanguage(language);
  const hlLanguage = HIGHLIGHT_LANGUAGE_MAP[normalized];

  if (!hlLanguage || !hljs.getLanguage(hlLanguage)) {
    return escapeHtml(source);
  }

  try {
    return hljs.highlight(source, { language: hlLanguage, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(source);
  }
}
