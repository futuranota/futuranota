import { generateId } from "./ids.js";
import { createAffiliateFields } from "./urlTableAffiliate.js";

/** Max length for URL-table / link-vault description fields. */
export const LINK_DESCRIPTION_MAX_LENGTH = 2000;

/** Max length for affiliate requirements text. */
export const LINK_REQUIREMENTS_MAX_LENGTH = 2000;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function clampLinkRequirements(value) {
  return String(value ?? "").slice(0, LINK_REQUIREMENTS_MAX_LENGTH);
}

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

/**
 * @typedef {Object} LinkEntry
 * @property {string} id
 * @property {string} name
 * @property {string} tag
 * @property {string} category
 * @property {string} description
 * @property {string} url
 * @property {string} [imageUrl]
 * @property {string} [requirements]
 * @property {number|null} [commissionRate]
 * @property {number|null} [productPrice]
 * @property {number|null} [cookieDays]
 * @property {string} [affiliateStatus]
 * @property {string|null} [activatedAt]
 * @property {number} [clientsWon]
 */

export function createLinkEntry(patch = {}) {
  const affiliate = createAffiliateFields(patch);
  return {
    id: patch.id || generateId("LNK"),
    name: patch.name || "",
    tag: patch.tag || "",
    category: patch.category || "",
    description: clampLinkDescription(patch.description || ""),
    url: patch.url || "",
    imageUrl: String(patch.imageUrl ?? "").trim(),
    requirements: clampLinkRequirements(patch.requirements || ""),
    commissionRate: affiliate.commissionRate,
    productPrice: affiliate.productPrice,
    cookieDays: affiliate.cookieDays,
    affiliateStatus: affiliate.affiliateStatus,
    activatedAt: affiliate.activatedAt,
    clientsWon: affiliate.clientsWon,
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
    .filter((entry) => (
      entry.name.trim()
      || entry.url.trim()
      || entry.imageUrl.trim()
      || entry.description.trim()
      || entry.requirements.trim()
    ));
}

export function normalizeUrlInput(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}
