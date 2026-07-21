import { useUrlTableStore } from "../stores/urlTableStore.js";
import { normalizeTagKey } from "./urlTableTags.js";
import { requestUrlTableOpen } from "./urlTableSession.js";

/**
 * Open the URL table that owns a @mention's entry, with the tag text
 * prefilled in the overlay search bar (live filter — no extra click needed).
 *
 * Resolution: `sourceEntryId` snapshot first; if the entry was deleted,
 * fall back to any entry with the same tag (case-insensitive).
 *
 * @param {import("./docMentions.js").DocMention|null|undefined} mention
 * @returns {boolean} whether the overlay open was dispatched
 */
export function openUrlTableForMention(mention) {
  if (!mention) return false;

  const entries = useUrlTableStore.getState().entries;
  let entry = mention.sourceEntryId
    ? entries.find((item) => item.id === mention.sourceEntryId)
    : null;

  if (!entry && mention.tag) {
    const key = normalizeTagKey(mention.tag);
    entry = entries.find((item) => normalizeTagKey(item.tag) === key) || null;
  }
  if (!entry) return false;

  return requestUrlTableOpen({
    tableId: entry.tableId || null,
    objectId: entry.objectId || null,
    searchQuery: String(mention.tag ?? ""),
  });
}
