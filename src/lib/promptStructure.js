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
  return /^(?:prompt|pr0mpt|paso\b|step\b|actúa como|actua como|you are\b|\d{1,2}\s*[/.)-])/i.test(line);
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
 * Mark the original paragraphs so the user can check instruction vs prompt.
 * The title is not included. Marker lines are not part of the text.
 * @param {{ instruction?: string[], prompt?: string[] }[]} sheets
 * @param {Map<string, string>} map
 */
export function markAssistanceText(sheets, map) {
  return (sheets || []).map((sheet, index) => {
    const page = String(index + 1).padStart(2, "0");
    const instruction = joinParagraphs(sheet.instruction, map);
    const prompt = joinParagraphs(sheet.prompt, map);
    const instructionMark = `<strong>--//Página ${page} · Instrucción//--</strong>`;
    const promptMark = `<strong>--//Página ${page} · Prompt//--</strong>`;
    const done = "<strong>--//terminado//--</strong>";
    return [
      instructionMark,
      instruction,
      done,
      promptMark,
      prompt,
      done,
    ].join("\n");
  }).join("\n\n");
}

const CARD_LINE = /^prompt\s+\d+\b/i;
const PASTE_LINE = /^(?:actúa como|actua como|you are)\b/i;
const FOOTER_LINE = /p[aá]gina\s+\d+\s+de\s+\d+|gu[ií]a de implementaci[oó]n/i;

function stripTags(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "");
}

/**
 * Text Groq should read: no review marks and no marker lines.
 * @param {unknown} text
 */
export function plainForStructure(text) {
  return stripTags(text)
    .replace(/^--\/\/.*\/\/--$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Yellow highlight on every slice that contains "prompt", including "Prompt:".
 * @param {unknown} text
 */
export function paintReviewHighlights(text) {
  const source = String(text ?? "");
  return source.split(/(<mark\b[^>]*>[\s\S]*?<\/mark>|<strong>[\s\S]*?<\/strong>)/gi).map((part) => {
    if (/^<mark\b/i.test(part)) return part;
    if (/^<strong>/i.test(part)) {
      const inner = part.slice(8, -9);
      return `<strong>${inner.replace(/prompt/gi, (found) => `<mark>${found}</mark>`)}</strong>`;
    }
    return part.replace(/prompt/gi, (found) => `<mark>${found}</mark>`);
  }).join("");
}

/**
 * Split a guide into cards when "Prompt N" holds a description
 * and a pasteable block that starts with "Actúa como" or "You are".
 * @param {unknown} text
 */
export function markCardsFromTranscript(text) {
  const plain = plainForStructure(text).replace(/\r\n/g, "\n");
  const cards = [];
  let card = null;
  const ensure = () => {
    if (card) return;
    card = { instruction: [], prompt: [], paste: false };
    cards.push(card);
  };
  for (const raw of plain.split("\n")) {
    const line = raw.trim();
    if (!line) {
      if (!card) continue;
      (card.paste ? card.prompt : card.instruction).push("");
      continue;
    }
    if (FOOTER_LINE.test(line) && line.length < 120) continue;
    if (CARD_LINE.test(line)) {
      card = { instruction: [line], prompt: [], paste: false };
      cards.push(card);
      continue;
    }
    ensure();
    if (!card.paste && PASTE_LINE.test(line)) card.paste = true;
    (card.paste ? card.prompt : card.instruction).push(line);
  }
  const ready = cards.filter((item) => item.prompt.some((line) => line.trim()));
  return ready.map((item, index) => {
    const page = String(index + 1).padStart(2, "0");
    const instruction = item.instruction.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const prompt = item.prompt.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const done = "<strong>--//terminado//--</strong>";
    return [
      `<strong>--//Página ${page} · Instrucción//--</strong>`,
      instruction,
      done,
      `<strong>--//Página ${page} · Prompt//--</strong>`,
      prompt,
      done,
    ].join("\n");
  }).join("\n\n");
}

/**
 * @param {unknown} text
 */
export function transcriptHasMarkers(text) {
  return /--\/\/[^/\n]*p[aá]gina\s+\d+/i.test(stripTags(text));
}

/**
 * Read reviewed markers into instruction and prompt text, without marker lines or highlights.
 * @param {unknown} text
 * @returns {{ instruction: string, prompt: string }[]}
 */
export function readAssistanceMarkers(text) {
  const lines = stripTags(text).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    blocks.push({
      page: current.page,
      kind: current.kind,
      text: current.lines.join("\n").trim(),
    });
    current = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const marker = line.match(/^--\/\/\s*(.+?)\s*\/\/--$/);
    if (marker) {
      const label = marker[1];
      if (/terminado/i.test(label)) {
        flush();
        continue;
      }
      const page = label.match(/p[aá]gina\s+(\d+)/i);
      const kind = /prompt/i.test(label) ? "prompt" : /instrucci[oó]n/i.test(label) ? "instruction" : "";
      if (page && kind) {
        flush();
        current = { page: String(Number(page[1])), kind, lines: [] };
        continue;
      }
    }
    if (current) current.lines.push(raw);
  }
  flush();
  const pages = new Map();
  for (const block of blocks) {
    if (!pages.has(block.page)) pages.set(block.page, { instruction: "", prompt: "" });
    pages.get(block.page)[block.kind] = block.text;
  }
  return [...pages.values()].filter((sheet) => sheet.instruction || sheet.prompt);
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
