import { useState } from "react";
import { CompletedChip } from "../docs/FolderDocumentRow.jsx";
import { DocListTitle } from "../docs/DocListTitle.jsx";
import { resolveDocSource } from "../../lib/docSources.js";
import { anchorFieldsFromIso, formatScheduleLabel } from "../../lib/nodeAnchor.js";
import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { useI18n } from "../../i18n/useI18n.js";
import { playClosedBoxSound } from "../../lib/closedBoxSound.js";

function startDocDrag(e, docId) {
  setCanvasDragData(e.dataTransfer, { kind: "document", docId });
}

function getNodeDisplayTitle(node) {
  return (node?.sourceQuery || node?.title || "Untitled query").trim() || "Untitled query";
}

function formatCampaignDateTime(iso, emptyLabel) {
  if (!iso) return emptyLabel;
  const { anchorDate, anchorTime } = anchorFieldsFromIso(iso);
  const label = formatScheduleLabel(anchorDate, anchorTime);
  return label.replace(/^schedule:\s*/i, "") || emptyLabel;
}

/**
 * Direct campaign file row inside the Campaigns folder.
 * Disclosure keeps nested research documents without treating the file as a folder box.
 */
export function CampaignFileRow({
  doc,
  nodes = [],
  active = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onSelect,
  onOpen,
  onDelete,
  onCreateResearch,
  onNodeClick,
  onNodeInsert,
  onNodeDelete,
  defaultExpanded = false,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const completed = Boolean(doc?.campaignCompleted);
  const iconSrc = (typeof doc?.icon === "string" && doc.icon.trim())
    ? doc.icon
    : "/uploads/File.svg";
  const activateLabel = formatCampaignDateTime(
    doc?.campaignActivateAt,
    t("sidebar.campaignActivateUnset"),
  );
  const launchLabel = formatCampaignDateTime(
    doc?.launchAt,
    t("sidebar.campaignLaunchUnset"),
  );

  const toggleExpanded = (e) => {
    e?.stopPropagation?.();
    playClosedBoxSound();
    setExpanded((value) => !value);
  };

  return (
    <div
      className={
        "campaign-file-row"
        + (active ? " campaign-file-row--active" : "")
        + (completed ? " campaign-file-row--completed" : "")
        + (selected ? " campaign-file-row--selected" : "")
        + (selectMode ? " campaign-file-row--selecting" : "")
      }
    >
      <div className="campaign-file-row__head">
        {selectMode ? (
          <label className="campaign-file-row__select">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(doc.id)}
              aria-label={t("sidebar.folderSelectDelete")}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="campaign-file-row__disclose"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          title={expanded ? t("sidebar.collapseCampaignFile") : t("sidebar.expandCampaignFile")}
        >
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
        <button
          type="button"
          className="campaign-file-row__main"
          onClick={() => (selectMode ? onToggleSelect?.(doc.id) : onSelect?.(doc.id))}
          onDoubleClick={(e) => {
            e.preventDefault();
            if (!selectMode) onOpen?.(doc.id);
          }}
          title={doc?.title || t("sidebar.campaignFileUntitled")}
        >
          <span
            className="lp-doc-drag-area lp-doc-drag-area--compact"
            draggable={!selectMode}
            onDragStart={(e) => {
              if (selectMode) return;
              e.stopPropagation();
              startDocDrag(e, doc.id);
            }}
            onClick={(e) => e.stopPropagation()}
            title={t("sidebar.dragDocToCanvas")}
          >
            ⋮⋮
          </span>
          <span className="lp-doc-icon lp-doc-icon--compact lp-doc-icon--file">
            <img
              src={iconSrc}
              alt=""
              aria-hidden
              className="lp-item-icon-img lp-icon-white"
            />
          </span>
          <span className="campaign-file-row__text">
            <span className="campaign-file-row__title-row">
              <DocListTitle doc={doc} nestedInGroup />
              {completed ? (
                <>
                  {" "}
                  <CompletedChip />
                </>
              ) : null}
            </span>
            <span className="campaign-file-row__meta">
              <span className="campaign-file-row__meta-item">
                <span className="campaign-file-row__meta-label">
                  {t("sidebar.campaignActivateAt")}
                </span>
                {" "}
                <span className="campaign-file-row__meta-value tnum">{activateLabel}</span>
              </span>
              <span className="campaign-file-row__meta-sep" aria-hidden>·</span>
              <span className="campaign-file-row__meta-item">
                <span className="campaign-file-row__meta-label">
                  {t("sidebar.campaignTargetLaunch")}
                </span>
                {" "}
                <span className="campaign-file-row__meta-value tnum">{launchLabel}</span>
              </span>
            </span>
          </span>
        </button>
        <div className="campaign-file-row__actions">
          <button
            type="button"
            className="lp-node-row-action lp-node-row-action--delete icon-del-btn"
            title={t("common.delete")}
            aria-label={t("common.delete")}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(doc);
            }}
          >
            ×
          </button>
          <button
            type="button"
            className="lp-node-row-action lp-node-row-action--open"
            title={t("sidebar.openDocument")}
            aria-label={t("sidebar.openDocument")}
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(doc.id);
            }}
          >
            ↗
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="campaign-file-row__body">
          {nodes.length ? (
            nodes.map((node) => {
              const source = resolveDocSource(node?.sourceId);
              const icon = source?.src || "/uploads/File.svg";
              const title = getNodeDisplayTitle(node);
              return (
                <div key={node.id} className="lp-doc-nodes-block__node campaign-file-row__child">
                  <button
                    type="button"
                    className="lp-doc-nodes-block__node-main"
                    onClick={() => onNodeClick?.(node)}
                    title={source ? `${title} · ${source.label}` : title}
                  >
                    <span className="lp-node-type-icon lp-node-type-icon--compact lp-node-type-icon--file">
                      <img
                        src={icon}
                        alt=""
                        aria-hidden
                        className="lp-node-type-icon-img lp-icon-white"
                      />
                    </span>
                    <span className="lp-doc-nodes-block__node-title">{title}</span>
                    {node?.completed ? <CompletedChip /> : null}
                  </button>
                  <div className="lp-doc-nodes-block__node-actions">
                    <button
                      type="button"
                      className="lp-node-row-action lp-node-row-action--delete icon-del-btn"
                      title={t("common.delete")}
                      aria-label={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeDelete?.(node);
                      }}
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      className="lp-node-row-action lp-node-row-action--insert"
                      title={t("sidebar.insertNode")}
                      aria-label={t("sidebar.insertNode")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeInsert?.(node);
                      }}
                    >
                      <img
                        src="/uploads/botones/StackPlus.svg"
                        alt=""
                        aria-hidden
                        className="lp-node-row-action__icon"
                      />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="campaign-file-row__empty dim">{t("sidebar.campaignNoResearchYet")}</p>
          )}
          {onCreateResearch ? (
            <button
              type="button"
              className="lp-doc-nodes-block__create-doc"
              onClick={() => onCreateResearch(doc)}
            >
              <img
                src="/uploads/FileDashed.svg"
                alt=""
                aria-hidden
                className="lp-item-icon-img"
              />
              <span>{t("sidebar.createResearchInCampaign")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
