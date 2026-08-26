import {
  AffiliateEntryCard,
  AffiliateNewTile,
  AffiliateQueueCard,
} from "./AffiliateEntryCard.jsx";

/**
 * @typedef {'queue'|'create'|'edit'} AffiliatePanelMode
 */

/**
 * Queue row or page-1 editor — never both at once.
 */
export function AffiliateEntryList({
  panelMode = "queue",
  entries = [],
  draft,
  onDraftChange,
  onStartCreate,
  onStartEdit,
  onViewStats,
  onDeleteEntry,
  onNext,
  onClose,
  objectId = null,
  tableId = null,
  labels = {},
}) {
  if (panelMode === "create" || panelMode === "edit") {
    return (
      <div className="affiliate-entry-list affiliate-entry-list--create affiliate-entry-list--immersive scroll-match-bg">
        <AffiliateEntryCard
          draft={draft}
          onDraftChange={onDraftChange}
          onNext={onNext}
          onClose={onClose}
          immersive
          objectId={objectId}
          tableId={tableId}
          labels={labels}
        />
      </div>
    );
  }

  return (
    <div className="affiliate-entry-list scroll-match-bg">
      <div className="affiliate-queue" role="list">
        {entries.map((entry) => (
          <div key={entry.id} role="listitem">
            <AffiliateQueueCard
              entry={entry}
              onViewStats={onViewStats}
              onStartEdit={onStartEdit}
              onDelete={onDeleteEntry}
              labels={labels}
            />
          </div>
        ))}
        <div role="listitem">
          <AffiliateNewTile
            onClick={onStartCreate}
            label={labels.newTile || "+ new"}
          />
        </div>
      </div>
    </div>
  );
}
