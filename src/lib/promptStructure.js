import { liftPromptPlaceholders } from "./promptVariables.js";

/** Selector ids stored on each prompt page. */
export const STRUCTURE_MODEL_IDS = ["openai", "claude", "grok", "gemini"];

const MODEL_ALIASES = {
  openai: "openai",
  chatgpt: "openai",
  "chat gpt": "openai",
  gpt: "openai",
  claude: "claude",
  grok: "grok",
  gemini: "gemini",
  none: "none",
};

const PAGE_LINE = /^---\s*PAGE\s+(\d+)\s*---$/i;
const PLACEHOLDER = /\{\{[^{}\n]+\}\}|\[\[[^\[\]\n]+\]\]|\{[^{}\n]+\}|\[[^\[\]\n]+\]/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const HANDLE = /(?<![\w@])@[A-Za-z0-9_]+/g;
const HASHTAG = /(?<![\w#/])#[A-Za-z0-9_]+/g;
const QUESTION = /¿[^¿?\n]{1,500}\?/g;
const EXCLAIM = /¡[^¡!\n]{1,500}!/g;
const CAPS = /(?<![\p{L}\p{N}])\p{Lu}{2,}(?![\p{L}\p{N}])/gu;

/**
 * Join extracted pages. One page stays plain. Several pages keep `--- PAGE n ---`.
 * @param {string[]} pages
 */
export function joinPdfPageTexts(pages) {
  const ready = [];
  (pages || []).forEach((text, index) => {
    const clean = String(text || "").trim();
    if (clean) ready.push({ n: index + 1, text: clean });
  });
  if (!ready.length) return "";
  if (ready.length === 1) return ready[0].text;
  return ready.map((page) => `--- PAGE ${page.n} ---\n${page.text}`).join("\n\n");
}

function startsSection(line) {
  return /^(?:prompt|pr0mpt|paso\b|step\b|\d{1,2}\s*[/.)-])/i.test(line);
}

/**
 * Number the current sheet. A paragraph is a blank-line block.
 * A new heading ("Paso 01", "Prompt") starts its own block.
 * Page markers stay in the Groq text and never become ids.
 * @param {string} text
 */
export function numberTranscriptParagraphs(text) {
  const map = new Map();
  const lines = [];
  const buffer = [];
  let next = 1;
  const flush = () => {
    const paragraph = buffer.join("\n").trim();
    buffer.length = 0;
    if (!paragraph) return;
    const id = String(next);
    next += 1;
    map.set(id, paragraph);
    lines.push(`[${id}] ${paragraph}`);
  };
  for (const raw of String(text || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const page = line.match(PAGE_LINE);
    if (page) {
      flush();
      lines.push(`--- PAGE ${page[1]} ---`);
      continue;
    }
    if (buffer.length && startsSection(line)) flush();
    buffer.push(line);
  }
  flush();
  return { numbered: lines.join("\n"), map, ids: [...map.keys()] };
}

/**
 * @param {unknown} value
 * @param {string[]} allowed
 */
export function normalizeStructureModel(value, allowed) {
  const key = String(value || "").trim().toLowerCase();
  const id = MODEL_ALIASES[key] || "";
  if (id === "none") return "none";
  if (id && (allowed || []).includes(id)) return id;
  return "none";
}

/**
 * @param {unknown} raw
 */
export function parseStructurePayload(raw) {
  const cleaned = String(raw || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!cleaned) return null;
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : cleaned).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Every paragraph id once. An unknown model becomes "none" and does not fail the rest.
 * @param {unknown} parsed
 * @param {string[]} ids
 * @param {string[]} allowedModels
 */
function asIdList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value === "string") return value.split(/[^0-9]+/).filter(Boolean);
  return null;
}

export function validateStructure(parsed, ids, allowedModels) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sheets)) {
    return { ok: false, reason: "shape" };
  }
  const allowed = new Set((ids || []).map(String));
  const seen = new Set();
  const take = (list) => {
    const source = asIdList(list);
    if (!source) return null;
    const out = [];
    for (const id of source) {
      const key = String(id);
      if (!allowed.has(key) || seen.has(key)) return null;
      seen.add(key);
      out.push(key);
    }
    return out;
  };
  const sheets = [];
  for (const sheet of parsed.sheets) {
    const instruction = take(sheet?.instruction);
    const prompt = take(sheet?.prompt);
    if (!instruction || !prompt) return { ok: false, reason: "ids" };
    if (!instruction.length && !prompt.length) return { ok: false, reason: "empty" };
    sheets.push({
      instruction,
      prompt,
      model: normalizeStructureModel(sheet?.model, allowedModels),
    });
  }
  if (!sheets.length) return { ok: false, reason: "empty" };
  const extra = take(parsed.extra == null ? [] : parsed.extra);
  if (!extra) return { ok: false, reason: "ids" };
  const missing = [...allowed].filter((id) => !seen.has(id));
  if (missing.length) placeMissing(sheets, missing);
  for (const sheet of sheets) {
    sheet.instruction.sort((a, b) => Number(a) - Number(b));
    sheet.prompt.sort((a, b) => Number(a) - Number(b));
  }
  return { ok: true, sheets, extra };
}

function placeMissing(sheets, missing) {
  const sorted = [...missing].sort((a, b) => Number(a) - Number(b));
  for (const id of sorted) {
    const value = Number(id);
    const sheet = sheets.find((item) => item.prompt.some((promptId) => Number(promptId) > value))
      || sheets[sheets.length - 1];
    sheet.instruction.push(id);
  }
}

/**
 * @param {string[]} ids
 * @param {Map<string, string>} map
 */
export function joinParagraphs(ids, map) {
  return (ids || [])
    .map((id) => map.get(String(id)) || "")
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {string[]} ids
 * @param {Map<string, string>} map
 * @param {number} [limit]
 */
export function previewParagraphs(ids, map, limit = 80) {
  const text = (ids || [])
    .map((id) => map.get(String(id)) || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function occupy(ranges, start, end, tag) {
  if (end <= start) return;
  for (const range of ranges) {
    if (start < range.end && end > range.start) return;
  }
  ranges.push({ start, end, tag });
}

function occupyPattern(ranges, source, pattern, tag) {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    occupy(ranges, match.index, match.index + match[0].length, tag);
  }
}

/**
 * Visual marks on the original words. Does not rewrite them.
 * `{{id}}` tokens stay intact so variable chips still resolve.
 * @param {string} value
 */
export function applyMarks(value) {
  const source = String(value ?? "");
  if (!source) return "";
  const ranges = [];
  occupyPattern(ranges, source, PLACEHOLDER, "mark");
  occupyPattern(ranges, source, EMAIL, "u");
  occupyPattern(ranges, source, HANDLE, "u");
  occupyPattern(ranges, source, HASHTAG, "u");
  occupyPattern(ranges, source, QUESTION, "em");
  occupyPattern(ranges, source, EXCLAIM, "strong");
  occupyPattern(ranges, source, CAPS, "strong");
  if (!ranges.length) return source;
  ranges.sort((a, b) => a.start - b.start);
  let html = "";
  let cursor = 0;
  for (const range of ranges) {
    html += escapeHtml(source.slice(cursor, range.start));
    html += `<${range.tag}>${escapeHtml(source.slice(range.start, range.end))}</${range.tag}>`;
    cursor = range.end;
  }
  html += escapeHtml(source.slice(cursor));
  return html;
}

/**
 * Variables come from the prompt text. Marks are applied after, by code.
 * @param {string} instruction
 * @param {string} prompt
 * @param {object[]} variables
 */
export function prepareSheetFields(instruction, prompt, variables) {
  const lifted = liftPromptPlaceholders(prompt, variables);
  return {
    instruction: applyMarks(instruction),
    prompt: applyMarks(lifted.prompt),
    variables: lifted.variables,
  };
}
