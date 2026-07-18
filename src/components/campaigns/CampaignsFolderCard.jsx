import { useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { playClosedBoxSound } from "../../lib/closedBoxSound.js";
import { CampaignFileRow } from "./CampaignFileRow.jsx";

/**
 * One special collapsible Campaigns folder listing campaign files directly.
 */
export function CampaignsFolderCard({
  docs = [],
  nodesByDocId,
  activeId = null,
  selectMode = false,
  selectedIds = [],
  onToggleSelect,
  onSelectDoc,
  onOpenDoc,
  onDeleteDoc,
  onCreateCampaignFile,
  onCreateResearch,
  onNodeClick,
  onNodeInsert,
  onNodeDelete,
  defaultExpanded = true,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const count = docs.length;

  return (
    <article className="lp-doc-nodes-block lp-doc-nodes-block--docs campaigns-folder-card">
      <div className="lp-doc-nodes-block__head">
        <button
          type="button"
          className="lp-doc-nodes-block__head-main"
          onClick={() => {
            playClosedBoxSound();
            setExpanded((value) => !value);
          }}
          aria-expanded={expanded}
        >
          <span className={"lp-doc-icon lp-doc-icon--box" + (expanded ? " lp-doc-icon--box-open" : "")}>
            <img
              src={expanded ? "/uploads/open-box.svg" : "/uploads/box-closed.svg"}
              alt=""
              aria-hidden
              className="lp-item-icon-img lp-box-icon-img"
              key={expanded ? "open" : "closed"}
            />
          </span>
          <div className="fn-card-body">
            <span className="lp-doc-group-category">{t("sidebar.campaignsFolder")}</span>
            <span className="fn-card-meta">
              {t("sidebar.docsInBlock", { count })}
            </span>
          </div>
          <span
            className={"lp-doc-nodes-block__chevron" + (expanded ? "" : " is-collapsed")}
            aria-hidden
          >
            <img
              src="/uploads/control.svg"
              alt=""
              className="lp-doc-nodes-block__chevron-img"
            />
          </span>
        </button>
      </div>

      {expanded ? (
        <div className="lp-doc-nodes-block__body lp-doc-nodes-block__body--docs campaigns-folder-card__body">
          {docs.length ? (
            docs.map((doc) => (
              <CampaignFileRow
                key={doc.id}
                doc={doc}
                nodes={nodesByDocId?.get?.(doc.id) || []}
                active={activeId === doc.id}
                selectMode={selectMode}
                selected={selectedIds.includes(doc.id)}
                onToggleSelect={onToggleSelect}
                onSelect={onSelectDoc}
                onOpen={onOpenDoc}
                onDelete={onDeleteDoc}
                onCreateResearch={onCreateResearch}
                onNodeClick={onNodeClick}
                onNodeInsert={onNodeInsert}
                onNodeDelete={onNodeDelete}
              />
            ))
          ) : (
            <div className="lp-empty campaigns-folder-card__empty">
              <p className="dim">{t("sidebar.noCampaignsYet")}</p>
              <p className="dim">{t("sidebar.useNewCampaign")}</p>
            </div>
          )}
          {onCreateCampaignFile ? (
            <button
              type="button"
              className="lp-doc-nodes-block__create-doc"
              onClick={onCreateCampaignFile}
            >
              <img
                src="/uploads/FileDashed.svg"
                alt=""
                aria-hidden
                className="lp-item-icon-img"
              />
              <span>{t("sidebar.createDocumentInBox")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
