import { useEffect, useRef, useState } from "react";
import {
  AffiliateEntryCard,
  AffiliateQueueThumb,
  AFFILIATE_EMPTY_DRAFT,
} from "./AffiliateEntryCard.jsx";

/**
 * Horizontal queue of saved thumbs + one expanded editor (draft or selected).
 *
 * @param {Object} props
 * @param {import("../../lib/vaultBlocks.js").LinkEntry[]} props.entries
 * @param {Record<string, string>} props.draft
 * @param {(next: Record<string, string>) => void} props.onDraftChange
 * @param {(entry: import("../../lib/vaultBlocks.js").LinkEntry) => unknown} props.onSaveEntry
 * @param {(entryId: string) => void} props.onDeleteEntry
 * @param {(entry: import("../../lib/vaultBlocks.js").LinkEntry) => void} props.onViewEntry
 * @param {number} [props.addFormRequest]
 * @param {string|null} [props.objectId]
 * @param {string|null} [props.tableId]
 * @param {Record<string, string>} [props.labels]
 */
export function AffiliateEntryList({
  entries = [],
  draft,
  onDraftChange,
  onSaveEntry,
  onDeleteEntry,
  onViewEntry,
  addFormRequest = 0,
  objectId = null,
  tableId = null,
  labels = {},
}) {
  const draftAnchorRef = useRef(null);
  const [selectedId, setSelectedId] = useState(/** @type {string|null} */ (null));

  useEffect(() => {
    if (!addFormRequest) return;
    setSelectedId(null);
    onDraftChange?.(AFFILIATE_EMPTY_DRAFT);
    const timer = window.setTimeout(() => {
      draftAnchorRef.current?.scrollIntoView({ block: "nearest" });
      draftAnchorRef.current
        ?.querySelector("input.affiliate-entry-card__name")
        ?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addFormRequest, onDraftChange]);

  useEffect(() => {
    if (!selectedId) return;
    if (!entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [entries, selectedId]);

  const selectedEntry = selectedId
    ? entries.find((entry) => entry.id === selectedId) || null
    : null;

  const handleSaveDraft = (entry) => {
    const result = onSaveEntry?.(entry);
    if (result === false || result === null) return result;
    const savedId = result?.id || entry?.id;
    if (savedId) setSelectedId(savedId);
    return result;
  };

  const handleSaveSelected = (entry) => {
    const result = onSaveEntry?.(entry);
    if (result === false || result === null) return result;
    return result;
  };

  const handleDelete = (entryId) => {
    onDeleteEntry?.(entryId);
    if (selectedId === entryId) setSelectedId(null);
  };

  return (
    <div className="affiliate-entry-list scroll-match-bg">
      {entries.length ? (
        <div className="affiliate-queue" role="list">
          {entries.map((entry) => (
            <div key={entry.id} role="listitem">
              <AffiliateQueueThumb
                entry={entry}
                selected={selectedId === entry.id}
                onSelect={(item) => setSelectedId(item.id)}
                onView={onViewEntry}
                labels={labels}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div ref={draftAnchorRef} className="affiliate-entry-list__editor">
        {selectedEntry ? (
          <AffiliateEntryCard
            key={selectedEntry.id}
            entry={selectedEntry}
            onSave={handleSaveSelected}
            onDelete={handleDelete}
            onView={onViewEntry}
            objectId={objectId}
            tableId={tableId}
            labels={labels}
          />
        ) : (
          <AffiliateEntryCard
            isDraft
            draft={draft}
            onDraftChange={onDraftChange}
            onSave={handleSaveDraft}
            objectId={objectId}
            tableId={tableId}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
