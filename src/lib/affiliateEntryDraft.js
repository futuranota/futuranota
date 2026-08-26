import { createLinkEntry, normalizeUrlInput } from "./vaultBlocks.js";
import { applyAffiliateStatusChange } from "./urlTableAffiliate.js";

/**
 * @param {Record<string, unknown>|null|undefined} draft
 */
export function isAffiliateDraftComplete(draft) {
  const name = String(draft?.name ?? "").trim();
  if (!name) return false;
  return Boolean(
    String(draft?.imageUrl ?? "").trim()
    || String(draft?.description ?? "").trim()
    || String(draft?.requirements ?? "").trim()
    || String(draft?.tag ?? "").trim()
    || String(draft?.category ?? "").trim()
    || String(draft?.url ?? "").trim(),
  );
}

/**
 * @param {Record<string, unknown>} draft
 * @param {string} [entryId]
 */
export function affiliateDraftToLinkEntry(draft, entryId = undefined) {
  const withStatus = applyAffiliateStatusChange(
    { ...draft, affiliateStatus: draft.affiliateStatus || "pending" },
    draft.affiliateStatus || "pending",
  );
  const rawUrl = String(draft.url ?? "").trim();
  return createLinkEntry({
    ...draft,
    ...withStatus,
    id: entryId,
    url: rawUrl ? normalizeUrlInput(rawUrl) : "",
    imageUrl: String(draft.imageUrl ?? "").trim(),
    requirements: String(draft.requirements ?? "").trim(),
    affiliateStatus: withStatus.affiliateStatus || "pending",
  });
}

/** @param {import("./vaultBlocks.js").LinkEntry} entry */
export function linkEntryToAffiliateDraft(entry) {
  const link = createLinkEntry(entry);
  return {
    name: link.name ?? "",
    tag: link.tag ?? "",
    category: link.category ?? "",
    description: link.description ?? "",
    url: link.url ?? "",
    imageUrl: link.imageUrl ?? "",
    requirements: link.requirements ?? "",
    affiliateStatus: link.affiliateStatus ?? "pending",
  };
}

/**
 * Merge page-1 draft with staged page-2 fields (commission, etc.).
 *
 * @param {Record<string, unknown>} draft
 * @param {import("./vaultBlocks.js").LinkEntry|null|undefined} stagingEntry
 * @param {string|null|undefined} editingEntryId
 */
export function mergeAffiliateDraftAndStaging(draft, stagingEntry, editingEntryId = null) {
  const page1 = affiliateDraftToLinkEntry(
    draft,
    editingEntryId || stagingEntry?.id,
  );
  if (!stagingEntry) return page1;
  return createLinkEntry({
    ...stagingEntry,
    name: page1.name,
    tag: page1.tag,
    category: page1.category,
    description: page1.description,
    url: page1.url,
    imageUrl: page1.imageUrl,
    requirements: page1.requirements,
    affiliateStatus: page1.affiliateStatus,
    activatedAt: page1.activatedAt,
  });
}
