import {
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { normalizePasswordEntries } from "./vaultBlocks.js";
import { usePasswordTableStore } from "../stores/passwordTableStore.js";
import { generateId } from "./ids.js";

const PREVIEW_MAX = 120;

/**
 * @typedef {Object} PasswordTableRef
 * @property {string} id
 * @property {string} docId
 * @property {string} blockId
 * @property {string} title
 * @property {string} preview
 * @property {number} entryCount
 * @property {string|null} objectId
 * @property {string} docKind
 * @property {string} category
 * @property {import("./vaultBlocks.js").PasswordEntry[]} entries
 */

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function passwordTableTitleFrom(doc, entries) {
  const docTitle = String(doc.title ?? "").trim();
  if (docTitle) return docTitle;
  const first = entries.map((entry) => entry.description).find(Boolean);
  return first ? truncate(first, 60) : "Password table";
}

function entryPreview(entries) {
  return entries
    .map((entry) => entry.description)
    .filter(Boolean)
    .join(", ");
}

function blocksForDoc(doc) {
  if (Array.isArray(doc?.blocks) && doc.blocks.length) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc?.body || doc?.content || "");
}

/**
 * Collect password tables for library UI — one virtual table per company from SQL store.
 * @param {Record<string, import("../types/docs.js").Doc>} [_docs]
 * @param {{ objectId?: string|null }} [options]
 * @returns {PasswordTableRef[]}
 */
export function collectSavedPasswordTables(_docs, { objectId = null } = {}) {
  /** @type {PasswordTableRef[]} */
  const tables = [];
  const allEntries = usePasswordTableStore.getState().entries;
  const byObject = new Map();

  for (const entry of allEntries) {
    if (!entry.objectId) continue;
    if (objectId && entry.objectId !== objectId) continue;
    if (!byObject.has(entry.objectId)) byObject.set(entry.objectId, []);
    byObject.get(entry.objectId).push(entry);
  }

  for (const [oid, stored] of byObject) {
    const entries = normalizePasswordEntries(stored);
    if (!entries.length) continue;
    tables.push({
      id: `password-table:${oid}`,
      docId: "",
      blockId: "",
      title: passwordTableTitleFrom({ title: "Password table" }, entries),
      preview: truncate(entryPreview(entries), PREVIEW_MAX),
      entryCount: entries.length,
      objectId: oid,
      docKind: "standard",
      category: "",
      entries,
    });
  }

  return tables.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/**
 * @param {import("./vaultBlocks.js").PasswordEntry[]} entries
 * @param {string} query
 */
export function filterPasswordTableEntries(entries, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return entries;

  return entries.filter((entry) => (
    String(entry.description ?? "").toLowerCase().includes(normalized)
    || String(entry.tag ?? "").toLowerCase().includes(normalized)
  ));
}

/**
 * Find the dedicated company Password table doc (toolbar overlay), not slash
 * blocks embedded in regular documents.
 * @param {string} objectId
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {string} defaultTitle
 * @returns {{ doc: import("../types/docs.js").Doc, block: object }|null}
 */
export function findDedicatedCompanyPasswordTableDoc(objectId, docs, defaultTitle = "Password table") {
  if (!objectId) return null;

  for (const doc of Object.values(docs || {})) {
    if (doc?.parentObjectId !== objectId) continue;
    if (String(doc.title ?? "").trim() !== defaultTitle) continue;

    const blocks = blocksForDoc(doc);
    const vaultBlocks = blocks.filter((block) => block.type === DOC_BLOCK_TYPES.PASSWORD_VAULT);
    if (vaultBlocks.length !== 1) continue;
    if (blocks.length > 1) continue;

    return { doc, block: vaultBlocks[0] };
  }

  return null;
}

/**
 * Load company Password table session from the SQL-backed store.
 * @param {string|null} objectId
 * @param {string} [defaultTitle]
 */
export function loadCompanyPasswordTableSession(objectId, defaultTitle = "Password table") {
  if (!objectId) {
    return {
      objectId: null,
      docId: null,
      blockId: "",
      title: defaultTitle,
      entries: [],
      saved: false,
    };
  }

  // Backward-compatible: old callers passed (objectId, docs, defaultTitle).
  if (defaultTitle && typeof defaultTitle === "object") {
    defaultTitle = arguments[2] || "Password table";
  }

  const stored = usePasswordTableStore.getState().getEntriesForObject(objectId);
  const entries = normalizePasswordEntries(stored);

  return {
    objectId,
    docId: null,
    blockId: generateId("BLK"),
    title: typeof defaultTitle === "string" ? defaultTitle : "Password table",
    entries: entries.map((entry) => ({
      id: entry.id,
      description: entry.description,
      password: entry.password,
      tag: entry.tag,
    })),
    saved: entries.length > 0,
  };
}

/**
 * Clear all password entries for a company from the SQL store.
 * @param {PasswordTableRef} table
 * @returns {{ docRemoved: boolean }}
 */
export function removePasswordTableFromDoc(table) {
  const objectId = table?.objectId;
  if (!objectId) return { docRemoved: false };
  usePasswordTableStore.getState().replaceEntriesForObject(objectId, []);
  return { docRemoved: true };
}
