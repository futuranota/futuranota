import { generateId } from "./ids.js";

/** Max length for URL-table / link-vault description fields. */
export const LINK_DESCRIPTION_MAX_LENGTH = 500;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function clampLinkDescription(value) {
  return String(value ?? "").slice(0, LINK_DESCRIPTION_MAX_LENGTH);
}

export function createPasswordEntry(patch = {}) {
  return {
    id: patch.id || generateId("PWD"),
    description: patch.description || "",
    password: patch.password || "",
    tag: patch.tag || "",
  };
}

export function createLinkEntry(patch = {}) {
  return {
    id: patch.id || generateId("LNK"),
    name: patch.name || "",
    tag: patch.tag || "",
    category: patch.category || "",
    description: clampLinkDescription(patch.description || ""),
    url: patch.url || "",
  };
}

export function normalizePasswordEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => createPasswordEntry(entry))
    .filter((entry) => entry.description.trim() || entry.password.trim());
}

export function normalizeLinkEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => createLinkEntry(entry))
    .filter((entry) => entry.name.trim() || entry.url.trim());
}

export function normalizeUrlInput(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}
