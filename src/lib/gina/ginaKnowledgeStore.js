/**
 * Gina Knowledge store — Meeting-taught memory + prompt builder for folder docs.
 * Folder corpus: Documents → Knowledge (docKind knowledge). Taught: Meetings saves.
 */

import {
  listKnowledgeDocs,
  resolveKnowledgeDocDisplayTitle,
} from "../templateDoc.js";
import { extractKnowledgeDocBody } from "../agents/resolveAgentKnowledgeContext.js";

const STORAGE_KEY = "fn-gina-knowledge-v1";
export const GINA_KNOWLEDGE_CHANGED = "fn-gina-knowledge-changed";

/** Marker Gina must emit when proposing a LEARN card (stripped from UI). */
export const GINA_LEARN_START = "<<<GINA_LEARN";
export const GINA_LEARN_END = ">>>";

export const GINA_KNOWLEDGE_SOURCES = /** @type {const} */ ([
  "skill",
  "voice",
  "tasks",
  "taught",
]);

/**
 * @returns {{ id: string, title: string, body: string, source: string, updatedAt: string }[]}
 */
export function readLocalGinaKnowledge() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.body === "string");
  } catch {
    return [];
  }
}

/**
 * @param {{ id: string, title: string, body: string, source?: string, updatedAt?: string }[]} entries
 */
export function writeLocalGinaKnowledge(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notifyGinaKnowledgeChanged();
}

export function notifyGinaKnowledgeChanged() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_KNOWLEDGE_CHANGED));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Infer source tag from title/body when not explicit.
 * @param {{ title?: string, body?: string, source?: string }} entry
 * @returns {"skill" | "voice" | "tasks" | "taught"}
 */
export function inferGinaKnowledgeSource(entry = {}) {
  const explicit = String(entry.source || "").trim().toLowerCase();
  if (GINA_KNOWLEDGE_SOURCES.includes(/** @type {*} */ (explicit))) {
    return /** @type {"skill" | "voice" | "tasks" | "taught"} */ (explicit);
  }
  const hay = `${entry.title || ""}\n${entry.body || ""}`.toLowerCase();
  if (/\b(voice|voz|tono|expres|cómo habla|como habla|speak|tone)\b/.test(hay)) {
    return "voice";
  }
  if (/\b(tasks?|tareas?|loop|día a día|dia a dia|daily|workflow|rutina)\b/.test(hay)) {
    return "tasks";
  }
  if (/\b(skill|habilidad|claude|canonical|can[oó]nico)\b/.test(hay)) {
    return "skill";
  }
  return "skill";
}

/**
 * @param {{ title: string, body: string, source?: string }} entry
 */
export function addLocalGinaKnowledge(entry) {
  const list = readLocalGinaKnowledge();
  const title = String(entry.title || "Note").trim() || "Note";
  const body = String(entry.body || "").trim();
  if (!body) return list;

  const source = inferGinaKnowledgeSource({ title, body, source: entry.source });
  const existingIdx = list.findIndex(
    (e) => e.title.toLowerCase() === title.toLowerCase(),
  );
  const next = {
    id: existingIdx >= 0 ? list[existingIdx].id : `local:${Date.now()}`,
    title,
    body,
    source,
    updatedAt: new Date().toISOString(),
  };
  const out = existingIdx >= 0
    ? list.map((e, i) => (i === existingIdx ? next : e))
    : [next, ...list];
  writeLocalGinaKnowledge(out);
  return out;
}

/**
 * Install from a resolved skill/doc brief (canvas selection or paste).
 * @param {{ title?: string, body?: string, source?: string } | null} brief
 */
export function installGinaKnowledgeFromBrief(brief) {
  if (!brief?.body?.trim()) return readLocalGinaKnowledge();
  return addLocalGinaKnowledge({
    title: brief.title || "Installed skill",
    body: brief.body,
    source: brief.source || inferGinaKnowledgeSource(brief),
  });
}

/**
 * @param {string} id
 */
export function removeLocalGinaKnowledge(id) {
  const out = readLocalGinaKnowledge().filter((e) => e.id !== id);
  writeLocalGinaKnowledge(out);
  return out;
}

/**
 * Knowledge folder docs + Meeting-taught memory for prompt injection.
 * @param {Record<string, object> | null} [docsById]
 * @returns {string}
 */
export function buildGinaKnowledgePromptBlock(docsById = null) {
  const chunks = [];

  if (docsById && typeof docsById === "object") {
    const docs = listKnowledgeDocs(docsById);
    for (const doc of docs) {
      const body = extractKnowledgeDocBody(doc);
      const title = resolveKnowledgeDocDisplayTitle(doc) || doc.title || "Knowledge";
      const file = doc.knowledgeImport?.fileName;
      if (body) {
        chunks.push(`### ${title}${file ? ` (${file})` : ""} [folder]\n${body.slice(0, 4000)}`);
      } else if (file) {
        chunks.push(
          `### ${title} (${file}) [folder]\n(File attached; no extractable text in this doc yet.)`,
        );
      }
    }
  }

  const local = readLocalGinaKnowledge();
  for (const e of local) {
    chunks.push(`### ${e.title} [${e.source || "taught"}]\n${e.body.slice(0, 4000)}`);
  }

  if (!chunks.length) {
    return [
      "GINA KNOWLEDGE: (empty)",
      "Admin can insert documents/files in Documents → Knowledge, or teach Gina in Meetings.",
      "If Meeting ANSWER and the topic is not here → say you were not taught it yet.",
    ].join("\n");
  }

  return [
    "GINA KNOWLEDGE (Knowledge folder files/docs + Meeting-taught — do not invent beyond this):",
    ...chunks,
  ].join("\n\n");
}

/**
 * Parse LEARN proposal from Gina reply. Returns display text + optional proposal.
 * @param {string} reply
 * @returns {{ displayText: string, learnProposal: { title: string, body: string, source?: string } | null }}
 */
export function parseGinaLearnReply(reply) {
  const raw = String(reply || "");
  const start = raw.indexOf(GINA_LEARN_START);
  const end = raw.indexOf(GINA_LEARN_END, start + GINA_LEARN_START.length);
  if (start < 0 || end < 0) {
    return { displayText: raw.trim(), learnProposal: null };
  }

  const block = raw.slice(start + GINA_LEARN_START.length, end).trim();
  const displayText = `${raw.slice(0, start)}${raw.slice(end + GINA_LEARN_END.length)}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let title = "Taught note";
  let body = block;
  const titleMatch = block.match(/^title:\s*(.+)$/im);
  const bodyMatch = block.match(/^body:\s*([\s\S]+)$/im);
  if (titleMatch) title = titleMatch[1].trim() || title;
  if (bodyMatch) body = bodyMatch[1].trim();
  else {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines[0]?.toLowerCase().startsWith("title:")) {
      title = lines[0].slice(6).trim() || title;
      body = lines.slice(1).join("\n").replace(/^body:\s*/i, "").trim();
    }
  }

  if (!body) return { displayText, learnProposal: null };
  return {
    displayText,
    learnProposal: { title, body, source: "taught" },
  };
}

/**
 * User confirmation to persist the pending LEARN proposal.
 * @param {string} text
 * @returns {boolean}
 */
export function isGinaLearnSaveConfirm(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t) return false;
  return (
    /^(si|yes|ok|okay|dale|guarda|guardar|guardalo|guardala|save|save it|save that)(?:\s|[.!?,]|$)/.test(t)
    || /\b(guarda(r|lo|la)?|save (it|that|this)|confirm(o|a)?)\b/.test(t)
  );
}
