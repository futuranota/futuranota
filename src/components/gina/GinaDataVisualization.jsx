import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DocStatusChip } from "../docs/FolderDocumentRow.jsx";
import { BlockAnchorFields } from "../docs/blocks/BlockAnchorFields.jsx";
import {
  formatHierarchyPath,
  formatWorkDurationLabel,
} from "../../lib/gina/buildGinaVisualization.js";
import { buildTodayOverviewDeptBlocks } from "../../lib/gina/ginaReplyChips.js";
import { buildRecoveryEasyLinksLegend, buildRecoverySnoozeMenuOptions, buildRecoverySnoozeExactProtocol, buildRecoveryChangeStatusMenuOptions, buildSheetRowStatusMenuOptions, buildRescheduleBatchApplyProtocol } from "../../lib/gina/ginaScheduleRecovery.js";
import { formatClockRange12h } from "../../lib/clockFormat.js";
import { buildGinaDepartmentRail, buildGinaDepartmentRailRuns, buildGinaCategoryRail, buildGinaWeekdayRail } from "../../lib/gina/ginaDepartmentColors.js";
import { getGinaWeekViewChips } from "../../lib/gina/ginaSyntaxScheduleScope.js";
import { buildGinaStatusRail, buildGinaStatusRailRuns } from "../../lib/gina/ginaStatusColors.js";
import { getGinaPrefs } from "../../lib/gina/ginaPrefs.js";
import { flattenTodayQuickSheetRows } from "../../lib/gina/ginaTodayQuickSheet.js";
import { DOC_WORK_STATUS } from "../../lib/docWorkStatus.js";
import { isoFromAnchorFields, anchorFieldsFromIso } from "../../lib/nodeAnchor.js";
import { todayDateInputValue } from "../../lib/docDates.js";
import { GinaAiMessageText } from "./GinaAnimatedText.jsx";

/**
 * Gray small Depto / Categoría / Folder path above visual blocks.
 * Verbal narration stays in the chat bubble — this is the UI syntax only.
 */
export function GinaHierarchyPath({ department, category, folder, className = "" }) {
  const parts = [department, category, folder].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className={`gina-hierarchy-path ${className}`.trim()} title={formatHierarchyPath({ department, category, folder })}>
      {parts.map((part, i) => (
        <span key={`${part}-${i}`}>
          {i > 0 ? <span className="gina-hierarchy-path__sep"> / </span> : null}
          <span className="gina-hierarchy-path__seg">{part}</span>
        </span>
      ))}
    </p>
  );
}

/** Absolute day badge + clock; relative only as tooltip fallback. */
function GinaTimeCell({ doc, className = "", as: Tag = "span", struck = false }) {
  if (!doc) return null;
  const label = doc.timeLabel || doc.time || "Flexible";
  const title = doc.absoluteDate || doc.relativeDay || undefined;
  const Inner = struck ? "s" : "span";
  const dayBadge = doc.dayBadge || null;
  const clock = doc.timeClock || null;
  if (dayBadge) {
    return (
      <Tag className={`gina-viz__time ${className}`.trim()} title={title}>
        <Inner className="gina-viz__time-inner">
          <span className="gina-viz__time-badge">{dayBadge}</span>
          {clock ? (
            <>
              <br />
              <span className="gina-viz__time-clock">{clock}</span>
            </>
          ) : null}
        </Inner>
      </Tag>
    );
  }
  if (doc.relativeDay) {
    return (
      <Tag className={`gina-viz__time ${className}`.trim()} title={title}>
        <Inner className="gina-viz__time-inner">
          <span className="gina-viz__time-rel">{doc.relativeDay}</span>
          {clock ? (
            <>
              <span className="gina-viz__time-sep"> · </span>
              <span className="gina-viz__time-clock">{clock}</span>
            </>
          ) : null}
        </Inner>
      </Tag>
    );
  }
  return (
    <Tag className={`gina-viz__time ${className}`.trim()} title={title}>
      <Inner className="gina-viz__time-inner">{label}</Inner>
    </Tag>
  );
}

function StatRow({ label, value, tone }) {
  return (
    <div className={`gina-viz__stat gina-viz__stat--${tone || "neutral"}`}>
      <span className="gina-viz__stat-label">{label}</span>
      <span className="gina-viz__stat-value">{value}</span>
    </div>
  );
}

function DocLine({ doc }) {
  if (!doc) return null;
  const h = doc.hierarchy || {};
  return (
    <li className={`gina-viz__doc${doc.passedSlot ? " is-passed-slot" : ""}`}>
      <GinaHierarchyPath
        department={h.department || doc.department}
        category={h.category || doc.category}
        folder={h.folder || doc.folder}
      />
      <div className="gina-viz__doc-main">
        <span className="gina-viz__doc-title">{doc.title}</span>
        {doc.status ? <DocStatusChip status={doc.status} /> : null}
      </div>
      {doc.time ? (
        <GinaTimeCell doc={doc} className="gina-viz__doc-meta" />
      ) : null}
      {doc.passedSlot ? (
        <span className="gina-viz__doc-meta gina-viz__doc-meta--passed">Ya pasó</span>
      ) : null}
      {doc.daysOverdue != null ? (
        <span className="gina-viz__doc-meta gina-viz__doc-meta--warn">
          {doc.daysOverdue === 1 ? "1 día atrás" : `${doc.daysOverdue} días atrás`}
        </span>
      ) : null}
      {doc.daysUntilDue != null && doc.daysUntilDue >= 0 ? (
        <span className="gina-viz__doc-meta">
          {doc.daysUntilDue === 0 ? "hoy" : doc.daysUntilDue === 1 ? "1 día" : `${doc.daysUntilDue} días`}
        </span>
      ) : null}
    </li>
  );
}

function TodayScopeVisualization({ data }) {
  const groups = Array.isArray(data.byHierarchy) ? data.byHierarchy : [];
  return (
    <div className="gina-viz gina-viz--today">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Hoy</span>
        <h3 className="gina-viz__title">{data.dateLabel || data.date || "Hoy"}</h3>
      </header>
      <p className="gina-viz__total">{data.total ?? 0} documentos</p>
      <div className="gina-viz__stats">
        <StatRow label="Sin empezar" value={data.notStarted ?? 0} tone="not-started" />
        <StatRow label="En progreso" value={data.inProgress ?? 0} tone="in-progress" />
        <StatRow label="Vencido" value={data.pastDue ?? 0} tone="past-due" />
      </div>
      {data.nextDeadline ? (
        <p className="gina-viz__next">
          Próximo: <strong>{data.nextDeadline.document}</strong>
          {data.nextDeadline.time ? ` (${data.nextDeadline.time})` : ""}
        </p>
      ) : null}
      {!(data.total > 0) && data.emptyHint ? (
        <p className="gina-viz__empty">{data.emptyHint}</p>
      ) : null}
      {groups.length ? (
        <ul className="gina-viz__list">
          {groups.slice(0, 8).map((g) => (
            <li key={`${g.department}-${g.category}-${g.folder}`} className="gina-viz__doc">
              <GinaHierarchyPath
                department={g.department}
                category={g.category}
                folder={g.folder}
              />
              <div className="gina-viz__doc-main">
                <span className="gina-viz__doc-title">{g.documents} docs</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {Array.isArray(data.documents) && data.documents.length ? (
        <ul className="gina-viz__list">
          {data.documents.slice(0, 8).map((doc) => (
            <DocLine key={doc.id || doc.title} doc={doc} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DepartmentBuildingIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="28"
      height="34"
      viewBox="23 15 28 32"
      fill="none"
      aria-hidden
    >
      <path
        d="M33.4966 40.3457H39.7943"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M33.4966 26.3262H39.7943"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M49.2406 15.3105H24.0496C23.4699 15.3105 23 15.7589 23 16.3119V19.316C23 19.8691 23.4699 20.3174 24.0496 20.3174H49.2406C49.8203 20.3174 50.2903 19.8691 50.2903 19.316V16.3119C50.2903 15.7589 49.8203 15.3105 49.2406 15.3105Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48.1914 20.3184V32.3348M48.1914 32.3348C48.1914 32.6003 48.0808 32.855 47.8839 33.0428C47.6871 33.2306 47.4201 33.3361 47.1417 33.3361H26.1492C25.8709 33.3361 25.6039 33.2306 25.407 33.0428C25.2102 32.855 25.0996 32.6003 25.0996 32.3348M48.1914 32.3348V46.3539M25.0996 32.3348V20.3184M48.1914 42.3484V46.3539H25.0996V32.3348"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategoryScopeVisualization({ data }) {
  const dept = data.department || "—";
  const cat = data.category || "—";
  const docs = Number(data.documentCount) || 0;
  const folders = Number(data.folderCount) || 0;
  return (
    <div className="gina-viz gina-viz--category-scope">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{dept}</span>
        <h3 className="gina-viz__title">{cat}</h3>
      </header>
      <div className="gina-viz__stats">
        <StatRow label="Documentos" value={docs} tone="neutral" />
        <StatRow label="Folders" value={folders} tone="neutral" />
      </div>
    </div>
  );
}

function CategoryListVisualization({ data }) {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const corpus = data.corpusName || null;
  const dept = data.department || null;
  const count = data.count ?? categories.length;
  const eyebrow = dept || corpus || "Categorías";
  return (
    <div className="gina-viz gina-viz--category-list">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{eyebrow}</span>
        <h3 className="gina-viz__title">
          {count === 1 ? "1 categoría" : `${count} categorías`}
        </h3>
      </header>
      {categories.length === 0 ? (
        <p className="gina-viz__empty">
          {data.emptyHint || "Cero categorías en este alcance."}
        </p>
      ) : (
        <ul className="gina-viz__dept-list" role="list">
          {categories.map((cat) => (
            <li key={cat.id || cat.name} className="gina-viz__dept-list-item">
              <div className="gina-viz__dept-card gina-viz__dept-card--ref">
                <span className="gina-viz__dept-name">{cat.name}</span>
                <span className="gina-viz__dept-meta">
                  {cat.folderCount ?? 0} folder{(cat.folderCount ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  {cat.documentCount ?? 0} doc{(cat.documentCount ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FolderListVisualization({ data }) {
  const folders = Array.isArray(data.folders) ? data.folders : [];
  const corpus = data.corpusName || null;
  const dept = data.department || null;
  const count = data.count ?? folders.length;
  const eyebrow = dept || corpus || "Folders";
  return (
    <div className="gina-viz gina-viz--folder-list">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{eyebrow}</span>
        <h3 className="gina-viz__title">
          {count === 1 ? "1 folder" : `${count} folders`}
        </h3>
      </header>
      {folders.length === 0 ? (
        <p className="gina-viz__empty">
          {data.emptyHint
            || "Cero folders. Crea al menos uno para programar citas."}
        </p>
      ) : (
        <ul className="gina-viz__dept-list" role="list">
          {folders.map((folder) => (
            <li key={folder.id || folder.name} className="gina-viz__dept-list-item">
              <div className="gina-viz__dept-card gina-viz__dept-card--ref">
                <span className="gina-viz__dept-name">{folder.name}</span>
                <span className="gina-viz__dept-meta">
                  {folder.documentCount ?? 0} doc{(folder.documentCount ?? 0) === 1 ? "" : "s"}
                  {folder.category ? ` · ${folder.category}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentListVisualization({ data }) {
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const corpus = data.corpusName || null;
  const dept = data.department || null;
  const count = data.count ?? documents.length;
  const eyebrow = dept || corpus || "Documentos";
  return (
    <div className="gina-viz gina-viz--document-list">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{eyebrow}</span>
        <h3 className="gina-viz__title">
          {count === 1 ? "1 documento" : `${count} documentos`}
        </h3>
      </header>
      {documents.length === 0 ? (
        <p className="gina-viz__empty">
          {data.emptyHint || "Cero documentos en este alcance."}
        </p>
      ) : (
        <ul className="gina-viz__dept-list" role="list">
          {documents.slice(0, 12).map((doc) => (
            <li key={doc.id || doc.title} className="gina-viz__dept-list-item">
              <div className="gina-viz__dept-card gina-viz__dept-card--ref">
                <span className="gina-viz__dept-name">{doc.title || "—"}</span>
                <span className="gina-viz__dept-meta">
                  {[doc.folder, doc.category].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Count-only summary — no document cards (table comes on list_all). */
function DocumentCountVisualization({ data }) {
  const corpus = data.corpusName || null;
  const dept = data.department || null;
  const count = Number(data.count) || 0;
  const eyebrow = dept || corpus || "Documentos";
  return (
    <div className="gina-viz gina-viz--document-count">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{eyebrow}</span>
        <h3 className="gina-viz__title">
          {count === 1 ? "1 documento" : `${count} documentos`}
        </h3>
      </header>
      {data.empty || count === 0 ? (
        <p className="gina-viz__empty">
          {data.emptyHint || "Cero documentos en este alcance."}
        </p>
      ) : null}
    </div>
  );
}

/** Grouped by department — schedule/status only when view flags on. */
function DocumentDeptGroupsVisualization({ data }) {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const view = data.view || {};
  const showSchedule = Boolean(view.showSchedule);
  const showStatus = Boolean(view.showStatus);
  const corpus = data.corpusName || null;
  const count = data.count ?? groups.reduce((n, g) => n + (g.documentCount || 0), 0);

  return (
    <div className="gina-viz gina-viz--document-dept-groups">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{corpus || "Documentos"}</span>
        <h3 className="gina-viz__title">
          {count === 1 ? "1 documento" : `${count} documentos`}
        </h3>
      </header>
      {data.empty || !groups.length ? (
        <p className="gina-viz__empty">Sin documentos en este alcance.</p>
      ) : (
        <div className="gina-viz__dept-groups">
          {groups.map((group) => (
            <section
              key={group.department}
              className="gina-viz__dept-group"
            >
              <header className="gina-viz__dept-group-head">
                <h4 className="gina-viz__dept-group-title">
                  {group.department}
                  <span className="gina-viz__dept-group-count">
                    {" · "}
                    {group.documentCount ?? (group.documents || []).length}
                    {" docs"}
                  </span>
                </h4>
                {(group.categories || []).length ? (
                  <p className="gina-viz__dept-group-cats">
                    {(group.categories || []).join(", ")}
                  </p>
                ) : null}
              </header>
              <ul className="gina-viz__dept-group-docs" role="list">
                {(group.documents || []).map((doc) => (
                  <li key={doc.id || doc.title} className="gina-viz__dept-group-doc">
                    <span className="gina-viz__dept-name">{doc.title || "—"}</span>
                    <span className="gina-viz__dept-meta">
                      {showStatus && doc.status ? (
                        <DocStatusChip status={doc.status} />
                      ) : null}
                      {showSchedule ? (
                        <GinaTimeCell doc={doc} className="gina-viz__dept-time" />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentListVisualization({ data, onSelectDepartment }) {
  const depts = Array.isArray(data.departments) ? data.departments : [];
  const corpus = data.corpusName || null;
  const count = data.count ?? depts.length;
  return (
    <div className="gina-viz gina-viz--dept-list">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{corpus || "Corpus"}</span>
        <h3 className="gina-viz__title">
          {count === 1 ? "1 departamento" : `${count} departamentos`}
        </h3>
      </header>
      {depts.length === 0 ? (
        <p className="gina-viz__empty">
          {data.emptyHint || "No hay departamentos en este corpus."}
        </p>
      ) : (
        <ul className="gina-viz__dept-list" role="list">
          {depts.map((dept) => (
            <li key={dept.id || dept.name} className="gina-viz__dept-list-item">
              <button
                type="button"
                className="gina-viz__dept-card gina-viz__dept-card--ref"
                onClick={() => onSelectDepartment?.(dept.name)}
              >
                <span className="gina-viz__dept-name">{dept.name}</span>
                <span className="gina-viz__dept-meta">
                  {dept.folderCount ?? 0} folder{(dept.folderCount ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  {dept.documentCount ?? 0} doc{(dept.documentCount ?? 0) === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DepartmentCardsVisualization({ data, onSelectDepartment }) {
  const depts = Array.isArray(data.departments) ? data.departments : [];
  const recommended = data.recommended || depts[0]?.name;
  return (
    <div className="gina-viz gina-viz--dept-cards">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Hoy</span>
        <h3 className="gina-viz__title">{data.dateLabel || data.date || "Hoy"}</h3>
      </header>
      {!(depts.length > 0) && data.emptyHint ? (
        <p className="gina-viz__empty">{data.emptyHint}</p>
      ) : (
        <div className="gina-viz__dept-grid" role="list">
          {depts.map((dept) => {
            const isRec = dept.name === recommended;
            const docs = dept.documents ?? 0;
            const folders = dept.folders ?? 0;
            return (
              <button
                key={dept.name}
                type="button"
                role="listitem"
                className={
                  "gina-viz__dept-card gina-viz__dept-card--ref"
                  + (isRec ? " is-recommended" : "")
                }
                onClick={() => onSelectDepartment?.(dept.name)}
              >
                <span className="gina-viz__dept-buildings" aria-hidden>
                  <DepartmentBuildingIcon />
                  <DepartmentBuildingIcon />
                  <DepartmentBuildingIcon />
                </span>
                <span className="gina-viz__dept-name">{dept.name}</span>
                <span className="gina-viz__dept-meta">
                  {folders} folder{folders === 1 ? "" : "s"}
                  {" · "}
                  {docs} doc{docs === 1 ? "" : "s"}
                  {(dept.pastDue ?? 0) > 0
                    ? ` · ${dept.pastDue} vencido${dept.pastDue === 1 ? "" : "s"}`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeptSummaryVisualization({ data, onSelectAction }) {
  const dept = data.department || "";
  const docCount = Number(data.documents) || 0;
  const expandModes = [
    {
      id: "expand_categories",
      label: "Categorías",
      text: `Expandir por categorías hoy en ${dept}`,
    },
    {
      id: "expand_status",
      label: "Status",
      text: `Expandir status hoy en ${dept}`,
    },
    {
      id: "expand_folders",
      label: "Folders",
      text: `Expandir por folders hoy en ${dept}`,
    },
  ];
  return (
    <div className="gina-viz gina-viz--dept-summary">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Estás en</span>
        <h3 className="gina-viz__title">{dept || "—"}</h3>
      </header>
      <div className="gina-viz__stats">
        <StatRow label="Folders" value={data.folders ?? 0} />
        <StatRow label="Docs hoy" value={docCount} />
      </div>
      {docCount > 0 ? (
        <>
          <p className="gina-viz__prompt">¿Cómo quieres visualizar los horarios?</p>
          <div className="gina-viz__expand-grid" role="list">
            {expandModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="listitem"
                className="gina-viz__expand-chip"
                onClick={() => onSelectAction?.(mode.text)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="gina-viz__empty">Hoy no hay documentos programados en este departamento.</p>
      )}
    </div>
  );
}

function SelectableMenuVisualization({
  eyebrow,
  title,
  items,
  onSelect,
}) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="gina-viz gina-viz--select-menu">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{eyebrow}</span>
        <h3 className="gina-viz__title">{title}</h3>
      </header>
      {list.length === 0 ? (
        <p className="gina-viz__empty">Sin ítems en este alcance.</p>
      ) : (
        <div className="gina-viz__dept-grid" role="list">
          {list.map((item) => (
            <button
              key={item.id || item.name || item.label}
              type="button"
              role="listitem"
              className="gina-viz__dept-card"
              onClick={() => onSelect?.(item)}
            >
              <span className="gina-viz__dept-name">{item.label || item.name}</span>
              {item.meta ? (
                <span className="gina-viz__dept-meta">{item.meta}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusMenuVisualization({ data, onSelectAction }) {
  const dept = data.department || "";
  const statuses = Array.isArray(data.statuses) ? data.statuses : [];
  return (
    <div className="gina-viz gina-viz--status-menu">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Estás en</span>
        <h3 className="gina-viz__title">{dept || "—"}</h3>
      </header>
      {statuses.length === 0 ? (
        <p className="gina-viz__empty">Sin statuses con docs hoy.</p>
      ) : (
        <div className="gina-viz__status-pickers" role="list">
          {statuses.map((s) => (
            <button
              key={s.key}
              type="button"
              role="listitem"
              className="gina-viz__status-picker"
              onClick={() => onSelectAction?.(`Status ${s.key} hoy en ${dept}`)}
            >
              <DocStatusChip status={s.key} />
              <span className="gina-viz__status-picker-count">{s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocStatusListVisualization({ data }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return (
    <div className="gina-viz gina-viz--status-list">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{data.statusLabel || data.status || "Status"}</span>
        <h3 className="gina-viz__title">{data.department || "—"}</h3>
      </header>
      {docs.length === 0 ? (
        <p className="gina-viz__empty">Sin documentos con este status hoy.</p>
      ) : (
        <ul className="gina-viz__list">
          {docs.map((doc) => (
            <DocLine key={doc.id || doc.title} doc={doc} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryDetailVisualization({ data }) {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  return (
    <div className="gina-viz gina-viz--category-detail">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Categoría</span>
        <h3 className="gina-viz__title">{data.category || "—"}</h3>
      </header>
      {groups.length === 0 ? (
        <p className="gina-viz__empty">Sin folders en esta categoría hoy.</p>
      ) : (
        <div className="gina-viz__sheet">
          {groups.map((group) => (
            <section key={group.category} className="gina-viz__sheet-dept">
              {(group.folders || []).map((folder) => (
                <div key={`${group.category}-${folder.folder}`} className="gina-viz__sheet-folder">
                  <p className="gina-viz__sheet-folder-name">
                    <span className="gina-viz__sheet-cat-tag">
                      [{data.category === "All" ? (group.category || "—") : (data.category || group.category)}]
                    </span>
                    {" "}
                    {folder.folder}
                  </p>
                  <ul className="gina-viz__sheet-slots">
                    {(folder.documents || []).map((doc) => (
                      <li
                        key={doc.id || `${doc.title}-${doc.time}`}
                        className="gina-viz__sheet-slot"
                      >
                        <TimeCell
                          doc={doc}
                          passedSlot={Boolean(doc.passedSlot)}
                          delayHighlights={Boolean(data.highlightPassedSlots)}
                        />
                        <span className="gina-viz__sheet-title">{doc.title}</span>
                        {doc.status ? <DocStatusChip status={doc.status} /> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeCell({ doc, time, passedSlot, delayHighlights, struck = false }) {
  return (
    <span className={`gina-viz__sheet-time-wrap${passedSlot && delayHighlights ? " will-highlight" : ""}`}>
      {passedSlot && delayHighlights ? (
        <span className="gina-viz__time-overlay" aria-hidden />
      ) : null}
      {doc ? (
        <GinaTimeCell doc={doc} className="gina-viz__sheet-time" struck={struck || Boolean(doc.struck)} />
      ) : (
        <span className="gina-viz__sheet-time">{time || "—"}</span>
      )}
    </span>
  );
}

function RecoveryPreviewVisualization({ data }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const intent = data.intent || "mark_past_due";
  const isDelete = intent === "delete_docs";
  const isStatusFlip = intent === "mark_past_due"
    || intent === "mark_completed"
    || intent === "mark_in_progress";
  const targetStatus = intent === "mark_completed"
    ? "completed"
    : intent === "mark_in_progress"
      ? "in_progress"
      : "past_due";
  const eyebrow = intent === "delete_docs"
    ? "Borrar archivos"
    : intent === "mark_completed"
      ? "Marcar como completados"
      : intent === "mark_in_progress"
        ? "Pasar a En Progreso"
        : intent === "mark_past_due"
          ? "Marcar como vencidos"
          : "Reagendar en cadena";
  return (
    <div className="gina-viz gina-viz--recovery-preview">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{eyebrow}</span>
        <h3 className="gina-viz__title">Vista previa</h3>
      </header>
      {docs.length === 0 ? (
        <p className="gina-viz__empty">No hay ítems para recuperar ahora.</p>
      ) : (
        <ul className="gina-viz__recovery-list">
          {docs.map((doc) => (
            <li key={doc.id || doc.title} className="gina-viz__recovery-row">
              <div className="gina-viz__recovery-title">{doc.title}</div>
              {isDelete ? (
                <div className="gina-viz__recovery-status">
                  {doc.status ? <DocStatusChip status={doc.status} /> : (
                    <span className="gina-viz__recovery-null">Sin status</span>
                  )}
                  <span className="gina-viz__recovery-arrow" aria-hidden>→</span>
                  <span className="gina-viz__recovery-null">Borrar</span>
                </div>
              ) : isStatusFlip ? (
                <div className="gina-viz__recovery-status">
                  {doc.status ? <DocStatusChip status={doc.status} /> : (
                    <span className="gina-viz__recovery-null">Sin status</span>
                  )}
                  <span className="gina-viz__recovery-arrow" aria-hidden>→</span>
                  <DocStatusChip status={targetStatus} />
                </div>
              ) : (
                <div className="gina-viz__recovery-times">
                  <span className="gina-viz__recovery-time gina-viz__recovery-time--old">
                    {doc.time || "—"}
                  </span>
                  <span className="gina-viz__recovery-arrow" aria-hidden>→</span>
                  <span className="gina-viz__recovery-time gina-viz__recovery-time--new">
                    {doc.proposedTime || "—"}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function minutesFromHhmm(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function hhmmFromMinutes(value) {
  const hours = Math.floor(value / 60) % 24;
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addDurationToTime(hhmm, durationMs) {
  const base = minutesFromHhmm(hhmm);
  if (base == null) return "";
  const add = Math.max(15, Math.round(Number(durationMs) / 60000) || 60);
  return hhmmFromMinutes(Math.min(24 * 60 - 15, base + add));
}

function seedDraftsFromData(data) {
  const seed = data?.initialDrafts && typeof data.initialDrafts === "object"
    ? data.initialDrafts
    : {};
  const out = {};
  for (const [id, draft] of Object.entries(seed)) {
    if (!id || !draft?.startIso || !draft?.finishIso) continue;
    out[String(id)] = {
      date: draft.date || "",
      startIso: draft.startIso,
      finishIso: draft.finishIso,
      timeLabel: draft.timeLabel || formatClockRange12h(draft.startIso, draft.finishIso, { sep: " – " }) || "",
    };
  }
  return out;
}

function writeDraftFields(date, startTime, finishTime) {
  const startIso = isoFromAnchorFields(date, startTime);
  const finishIso = isoFromAnchorFields(date, finishTime);
  if (!startIso || !finishIso) return null;
  return {
    date,
    startIso,
    finishIso,
    timeLabel: formatClockRange12h(startIso, finishIso, { sep: " – " })
      || `${startTime} – ${finishTime}`,
  };
}

function CascadeSlotPickerVisualization({ data, onSelectAction }) {
  const en = data.locale === "en";
  const dateKey = data.date || todayDateInputValue();
  const moveDocs = Array.isArray(data.moveDocs) ? data.moveDocs : [];
  const occupied = Array.isArray(data.occupied) ? data.occupied : [];
  const seededInitial = seedDraftsFromData(data);
  const [drafts, setDrafts] = useState(seededInitial);
  const seedKeyRef = useRef("");

  useEffect(() => {
    const seedKey = `cascade|${(data.moveDocIds || []).join("|")}|${Object.keys(data.initialDrafts || {}).join("|")}`;
    if (seedKey === seedKeyRef.current) return;
    seedKeyRef.current = seedKey;
    setDrafts(seedDraftsFromData(data));
  }, [data.moveDocIds?.join("|"), Object.keys(data.initialDrafts || {}).join("|")]);

  const draftCount = Object.keys(drafts).length;
  const totalCount = moveDocs.length;
  const canCommit = draftCount > 0;

  const patchCascadeDraft = (docId, patch) => {
    const id = String(docId || "");
    if (!id) return;
    setDrafts((prev) => {
      const cur = prev[id] || {};
      const startFields = cur.startIso
        ? anchorFieldsFromIso(cur.startIso)
        : { anchorDate: dateKey, anchorTime: "" };
      const finishFields = cur.finishIso
        ? anchorFieldsFromIso(cur.finishIso)
        : { anchorTime: "" };
      const nextDate = patch.date != null ? patch.date : (cur.date || startFields.anchorDate || dateKey);
      const nextStart = patch.startTime != null ? patch.startTime : (startFields.anchorTime || "");
      let nextFinish = patch.finishTime != null ? patch.finishTime : (finishFields.anchorTime || "");
      if (patch.startTime != null && patch.finishTime == null) {
        const doc = moveDocs.find((d) => String(d.id) === id);
        const dur = Number(doc?.durationMs || data.durationMs) || 60 * 60 * 1000;
        nextFinish = addDurationToTime(nextStart, dur);
      }
      const written = writeDraftFields(nextDate, nextStart, nextFinish);
      if (!written) return prev;
      return { ...prev, [id]: written };
    });
  };

  const commitDrafts = () => {
    if (!canCommit || !onSelectAction) return;
    const applies = Object.entries(drafts).map(([id, draft]) => ({
      id,
      startIso: draft.startIso,
      finishIso: draft.finishIso,
    }));
    const session = (Array.isArray(data.sessionMoveDocIds) && data.sessionMoveDocIds.length
      ? data.sessionMoveDocIds
      : data.moveDocIds) || [];
    const protocol = buildRescheduleBatchApplyProtocol(applies, session);
    if (!protocol) return;
    onSelectAction(
      protocol,
      en ? "Apply changes" : "Aplicar cambios",
    );
  };

  return (
    <div className="gina-viz gina-viz--slot-picker gina-viz--slot-picker-cascade">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">
          {en ? "Postponed schedule" : "Horario pospuesto"}
        </span>
        <h3 className="gina-viz__title">{data.dateLabel || dateKey}</h3>
        {totalCount > 0 ? (
          <p className="gina-viz__sheet-progress">
            {en
              ? `${draftCount} proposed`
              : `${draftCount} propuesta${draftCount === 1 ? "" : "s"}`}
          </p>
        ) : null}
      </header>
      {moveDocs.length > 0 ? (
        <div className="gina-viz__sheet gina-viz__slot-sheet gina-viz__cascade-sheet">
          <ul className="gina-viz__sheet-slots gina-viz__cascade-slots">
            {moveDocs.map((doc) => {
              const id = String(doc.id || "");
              const draft = drafts[id] || null;
              const startFields = draft?.startIso
                ? anchorFieldsFromIso(draft.startIso)
                : { anchorDate: dateKey, anchorTime: "" };
              const finishFields = draft?.finishIso
                ? anchorFieldsFromIso(draft.finishIso)
                : { anchorTime: "" };
              const rowDate = draft?.date || startFields.anchorDate || dateKey;
              return (
                <li key={doc.id || doc.title} className="gina-viz__cascade-row">
                  <BlockAnchorFields
                    className="gina-viz__cascade-anchor"
                    enableTimeRange
                    hideLabel
                    label={en ? "Proposed slot" : "Horario propuesto"}
                    anchorDate={rowDate}
                    anchorTime={startFields.anchorTime || ""}
                    anchorFinishTime={finishFields.anchorTime || ""}
                    occupied={occupied}
                    overlapHint={en
                      ? "Struck hours are busy or already past — pick a free window."
                      : "Las horas tachadas son ocupadas o ya pasaron — elige un cupo libre."}
                    onAnchorDateChange={(next) => patchCascadeDraft(id, { date: next })}
                    onAnchorTimeChange={(next) => patchCascadeDraft(id, { startTime: next })}
                    onAnchorFinishTimeChange={(next) => patchCascadeDraft(id, { finishTime: next })}
                  />
                  <span className="gina-viz__sheet-title gina-viz__cascade-title">{doc.title}</span>
                  {doc.status || id ? (
                    <GinaSheetRowStatusPicker
                      status={doc.status || DOC_WORK_STATUS.NOT_STARTED}
                      docId={id}
                      locale={en ? "en" : "es"}
                      onSelectAction={onSelectAction}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="gina-viz__empty">
          {en ? "Nothing left to reschedule." : "No queda nada por reagendar."}
        </p>
      )}
      {canCommit ? (
        <div className="gina-viz__slot-actions">
          <button
            type="button"
            className="gina-viz__slot-apply gina-viz__slot-apply--commit"
            onClick={commitDrafts}
          >
            {en ? "Apply changes" : "Aplicar cambios"}
            {draftCount > 0 ? (
              <span className="gina-viz__slot-apply-count">{`(${draftCount})`}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="gina-viz__slot-apply gina-viz__slot-apply--cancel"
            onClick={() => {
              onSelectAction?.(
                en ? "Cancel reschedule" : "Cancelar reagendar horarios",
                en ? "Cancel" : "Cancelar",
              );
            }}
          >
            {en ? "Cancel" : "Cancelar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GapsSlotPickerVisualization({ data, onSelectAction }) {
  const en = data.locale === "en";
  const dateKey = data.date || todayDateInputValue();
  const moveDocs = Array.isArray(data.moveDocs) ? data.moveDocs : [];
  const occupied = Array.isArray(data.occupied) ? data.occupied : [];
  const serverAssigned = new Set(
    (Array.isArray(data.assignedDocIds) ? data.assignedDocIds : [])
      .map((id) => String(id)),
  );
  const seededInitial = seedDraftsFromData(data);
  const initialActive = data.activeDocId
    || moveDocs.find((d) => !d.assigned && !serverAssigned.has(String(d.id)))?.id
    || moveDocs[0]?.id
    || null;
  const initialDraft = initialActive ? seededInitial[String(initialActive)] : null;
  const initialFields = initialDraft?.startIso
    ? anchorFieldsFromIso(initialDraft.startIso)
    : { anchorDate: dateKey, anchorTime: "" };
  const initialFinishFields = initialDraft?.finishIso
    ? anchorFieldsFromIso(initialDraft.finishIso)
    : { anchorTime: "" };
  const [activeDocId, setActiveDocId] = useState(initialActive);
  const [anchorDate, setAnchorDate] = useState(
    initialDraft?.date || initialFields.anchorDate || dateKey,
  );
  const [anchorTime, setAnchorTime] = useState(initialFields.anchorTime || "");
  const [anchorFinishTime, setAnchorFinishTime] = useState(initialFinishFields.anchorTime || "");
  const [drafts, setDrafts] = useState({});
  const lastActiveRef = useRef(initialActive);
  const seedKeyRef = useRef("");

  const applyDraftToFields = (draft) => {
    if (!draft?.startIso || !draft?.finishIso) {
      setAnchorDate(data.date || todayDateInputValue());
      setAnchorTime("");
      setAnchorFinishTime("");
      return;
    }
    const startF = anchorFieldsFromIso(draft.startIso);
    const finishF = anchorFieldsFromIso(draft.finishIso);
    setAnchorDate(draft.date || startF.anchorDate || data.date || todayDateInputValue());
    setAnchorTime(startF.anchorTime || "");
    setAnchorFinishTime(finishF.anchorTime || "");
  };

  useEffect(() => {
    const seedKey = `gaps|${(data.moveDocIds || []).join("|")}|${(data.assignedDocIds || []).join("|")}`;
    if (seedKey !== seedKeyRef.current) {
      seedKeyRef.current = seedKey;
      setDrafts({});
    }
    const next = data.activeDocId
      || moveDocs.find((d) => !d.assigned && !serverAssigned.has(String(d.id)))?.id
      || moveDocs[0]?.id
      || null;
    if (next === lastActiveRef.current) return;
    lastActiveRef.current = next;
    setActiveDocId(next);
    applyDraftToFields(null);
  }, [data.activeDocId, data.assignedDocIds?.join("|"), data.moveDocIds?.join("|")]);

  const activeDoc = moveDocs.find((d) => d.id === activeDocId) || null;
  const durationMs = Number(activeDoc?.durationMs || data.durationMs) || 60 * 60 * 1000;
  const draftCount = Object.keys(drafts).length;
  const totalCount = moveDocs.length;
  const canStage = Boolean(
    activeDoc?.id
    && !serverAssigned.has(String(activeDoc.id))
    && anchorDate
    && anchorTime
    && anchorFinishTime,
  );
  const canCommit = draftCount > 0;
  const dateFeedback = !anchorDate
    ? ""
    : (anchorDate === todayDateInputValue()
      ? (en ? "Today" : "Hoy")
      : anchorDate);

  const stageDraft = () => {
    if (!canStage || !activeDoc?.id) return;
    const written = writeDraftFields(anchorDate, anchorTime, anchorFinishTime);
    if (!written) return;
    const stagedId = String(activeDoc.id);
    const nextDrafts = { ...drafts, [stagedId]: written };
    setDrafts(nextDrafts);
    const nextUnstaged = moveDocs.find((d) => {
      const id = String(d.id || "");
      if (!id || id === stagedId) return false;
      if (d.assigned || serverAssigned.has(id)) return false;
      return !nextDrafts[id];
    });
    if (nextUnstaged?.id) {
      lastActiveRef.current = nextUnstaged.id;
      setActiveDocId(nextUnstaged.id);
      setAnchorDate(data.date || todayDateInputValue());
      setAnchorTime("");
      setAnchorFinishTime("");
    }
  };

  const commitDrafts = () => {
    if (!canCommit || !onSelectAction) return;
    const applies = Object.entries(drafts).map(([id, draft]) => ({
      id,
      startIso: draft.startIso,
      finishIso: draft.finishIso,
    }));
    const session = (Array.isArray(data.sessionMoveDocIds) && data.sessionMoveDocIds.length
      ? data.sessionMoveDocIds
      : data.moveDocIds) || [];
    const protocol = buildRescheduleBatchApplyProtocol(applies, session);
    if (!protocol) return;
    onSelectAction(
      protocol,
      en ? "Apply changes" : "Aplicar cambios",
    );
  };

  const activeIsServerAssigned = Boolean(
    activeDoc && (activeDoc.assigned || serverAssigned.has(String(activeDoc.id))),
  );

  return (
    <div className="gina-viz gina-viz--slot-picker">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">{en ? "Reschedule" : "Reagendar"}</span>
        <h3 className="gina-viz__title">{data.dateLabel || dateKey}</h3>
        {totalCount > 0 ? (
          <p className="gina-viz__sheet-progress">
            {en
              ? `${draftCount}/${totalCount} assigned`
              : `${draftCount}/${totalCount} asignados`}
            {totalCount - draftCount > 0
              ? (en
                ? ` · ${totalCount - draftCount} left`
                : ` · ${totalCount - draftCount} restante${totalCount - draftCount === 1 ? "" : "s"}`)
              : ""}
          </p>
        ) : null}
      </header>
      {data.noCupo && activeDoc && !activeIsServerAssigned && !drafts[String(activeDoc.id || "")] ? (
        <p className="gina-viz__slot-banner" role="status">
          {en
            ? `No free slot today for ${activeDoc.title}`
            : `Sin cupo disponible hoy para ${activeDoc.title}`}
        </p>
      ) : null}
      {moveDocs.length > 0 ? (
        <div className="gina-viz__sheet gina-viz__slot-sheet">
          <ul className="gina-viz__sheet-slots">
            {moveDocs.map((doc) => {
              const id = String(doc.id || "");
              const active = id === String(activeDocId || "");
              const draft = drafts[id] || null;
              const assigned = Boolean(doc.assigned || serverAssigned.has(id) || draft);
              return (
                <li key={doc.id || doc.title} className="gina-viz__slot-doc-row">
                  <button
                    type="button"
                    className={
                      "gina-viz__sheet-slot gina-viz__slot-doc-btn"
                      + (active ? " gina-viz__slot-doc-btn--active" : "")
                      + (assigned ? " gina-viz__slot-doc-btn--assigned" : "")
                      + (!assigned ? " gina-viz__sheet-slot--urgency" : "")
                    }
                    onClick={() => {
                      if (doc.assigned || serverAssigned.has(id)) return;
                      lastActiveRef.current = doc.id;
                      setActiveDocId(doc.id);
                      applyDraftToFields(draft);
                    }}
                    disabled={Boolean(doc.assigned || serverAssigned.has(id))}
                  >
                    <TimeCell
                      doc={draft
                        ? { ...doc, timeClock: draft.timeLabel, timeLabel: draft.timeLabel, relativeDay: null }
                        : doc}
                      passedSlot={!assigned}
                      delayHighlights={!assigned}
                      struck={false}
                    />
                    <span className="gina-viz__sheet-title">{doc.title}</span>
                    {assigned ? (
                      <span className="gina-viz__slot-check" aria-label={en ? "Assigned" : "Asignado"}>✓</span>
                    ) : null}
                  </button>
                  {doc.status || id ? (
                    <GinaSheetRowStatusPicker
                      status={doc.status || DOC_WORK_STATUS.NOT_STARTED}
                      docId={id}
                      locale={en ? "en" : "es"}
                      onSelectAction={onSelectAction}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="gina-viz__empty">
          {en ? "Nothing left to reschedule." : "No queda nada por reagendar."}
        </p>
      )}
      {activeDoc && !activeIsServerAssigned ? (
        <>
          <div className="gina-viz__slot-date-row">
            <BlockAnchorFields
              className="gina-viz__slot-anchor"
              enableTimeRange
              hideLabel={false}
              label={en
                ? `Free slot for ${activeDoc.title}`
                : `Cupo libre para ${activeDoc.title}`}
              anchorDate={anchorDate}
              anchorTime={anchorTime}
              anchorFinishTime={anchorFinishTime}
              occupied={occupied}
              overlapHint={en
                ? "Struck hours are busy or already past — pick a free window."
                : "Las horas tachadas son ocupadas o ya pasaron — elige un cupo libre."}
              onAnchorDateChange={(next) => setAnchorDate(next)}
              onAnchorTimeChange={(next) => {
                setAnchorTime(next);
                setAnchorFinishTime(addDurationToTime(next, durationMs));
              }}
              onAnchorFinishTimeChange={(next) => setAnchorFinishTime(next)}
            />
            {dateFeedback ? (
              <span className="gina-viz__slot-date-feedback" aria-live="polite">
                {dateFeedback}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="gina-viz__slot-apply"
            disabled={!canStage}
            onClick={stageDraft}
          >
            {en
              ? `Assign to ${activeDoc.title}`
              : `Asignar a ${activeDoc.title}`}
          </button>
        </>
      ) : null}
      {canCommit ? (
        <button
          type="button"
          className="gina-viz__slot-apply gina-viz__slot-apply--commit"
          onClick={commitDrafts}
        >
          {en ? "Apply changes" : "Aplicar cambios"}
          {draftCount > 0 ? ` (${draftCount})` : ""}
        </button>
      ) : null}
    </div>
  );
}

function ScheduleSlotPickerVisualization({ data, onSelectAction }) {
  if (data?.rescheduleMode === "cascade") {
    return <CascadeSlotPickerVisualization data={data} onSelectAction={onSelectAction} />;
  }
  return <GapsSlotPickerVisualization data={data} onSelectAction={onSelectAction} />;
}


function DailyReportVisualization({ data }) {
  const rows = Array.isArray(data.occupiedHours) ? data.occupiedHours : [];
  const pending = Array.isArray(data.pendingBrief) ? data.pendingBrief : [];
  const folders = Array.isArray(data.folderProgress) ? data.folderProgress : [];
  const hasConflicts = Boolean(data.hasConflicts);
  return (
    <div className="gina-viz gina-viz--daily-report">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow gina-viz__eyebrow--gold">
          {data.occupiedHoursOnly
            ? (data.locale === "en" ? "Taken hours" : "Horas tomadas")
            : "Occupied hours"}
        </span>
        <h3 className="gina-viz__title">{data.dateLabel || data.date || "Hoy"}</h3>
      </header>
      {rows.length > 0 ? (
        <ul className="gina-viz__occupied-list">
          {rows.map((row) => (
            <li
              key={row.id || `${row.time}-${row.title}`}
              className="gina-viz__occupied-row"
            >
              <span
                className={
                  "gina-viz__sheet-time-wrap"
                  + (row.hasConflict && hasConflicts ? " will-highlight" : "")
                }
              >
                {row.hasConflict && hasConflicts ? (
                  <span className="gina-viz__time-overlay" aria-hidden />
                ) : null}
                {row.struck ? (
                  <s className="gina-viz__sheet-time gina-viz__occupied-time">{row.time || "—"}</s>
                ) : (
                  <span className="gina-viz__sheet-time gina-viz__occupied-time">{row.time || "—"}</span>
                )}
              </span>
              <span className="gina-viz__occupied-sep">·</span>
              <span className="gina-viz__occupied-title">{row.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {folders.length > 0 ? (
        <section className="gina-viz__daily-section">
          <h4 className="gina-viz__daily-section-title">Progreso</h4>
          <ul className="gina-viz__folder-progress">
            {folders.map((f) => (
              <li key={f.folderId || f.folder} className="gina-viz__folder-progress-row">
                <span className="gina-viz__folder-progress-name">{f.folder}</span>
                <span className="gina-viz__folder-progress-pct">{f.percent}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {pending.length > 0 ? (
        <section className="gina-viz__daily-section">
          <h4 className="gina-viz__daily-section-title">Pendientes</h4>
          <ul className="gina-viz__pending-brief">
            {pending.map((row) => (
              <li key={row.id || row.title} className="gina-viz__pending-brief-row">
                <span className="gina-viz__pending-brief-time">{row.time || "—"}</span>
                <span className="gina-viz__occupied-sep">·</span>
                <span className="gina-viz__pending-brief-title">{row.title}</span>
                {row.status ? <DocStatusChip status={row.status} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DailyReportMovePreviewVisualization({ data }) {
  const proposals = Array.isArray(data.proposals) ? data.proposals : [];
  return (
    <div className="gina-viz gina-viz--daily-report-move">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Mover conflictos</span>
        <h3 className="gina-viz__title">Vista previa</h3>
      </header>
      {proposals.length === 0 ? (
        <p className="gina-viz__empty">No hay propuestas de movimiento.</p>
      ) : (
        <ul className="gina-viz__recovery-list">
          {proposals.map((p) => (
            <li key={p.id || p.title} className="gina-viz__recovery-row">
              <div className="gina-viz__recovery-title">{p.title}</div>
              <div className="gina-viz__recovery-times">
                <span className="gina-viz__recovery-time gina-viz__recovery-time--old">{p.fromTime}</span>
                <span className="gina-viz__recovery-arrow" aria-hidden>→</span>
                <span className="gina-viz__recovery-time gina-viz__recovery-time--new">{p.toTime}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeptHoursLegend({ items, locale = "es" }) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return null;
  return (
    <ul className="gina-viz__dept-legend" aria-label="Departments">
      {rows.map((row) => (
        <li key={row.name || row.key} className="gina-viz__dept-legend-item">
          <span
            className="gina-viz__dept-dot"
            style={{ background: row.color || row.fill || "#8a8a8a" }}
            aria-hidden
          />
          <span className="gina-viz__dept-legend-name">{row.name}</span>
          {row.hoursLabel || (row.minutes != null && row.minutes > 0) ? (
            <span className="gina-viz__dept-legend-hours">
              {row.hoursLabel || formatWorkDurationLabel(row.minutes, locale, { short: true })}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TodayHoursPie({ data, locale = "es" }) {
  const chart = Array.isArray(data?.hoursChart) ? data.hoursChart : [];
  if (!chart.length) return null;
  return (
    <div className="gina-viz__hours-pie gina-viz__hours-pie--side">
      <div className="gina-viz__hours-pie-chart">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload || {};
                return (
                  <div className="gina-viz__hours-pie-tooltip">
                    <span className="gina-viz__hours-pie-tooltip-name">{row.name}</span>
                    <span className="gina-viz__hours-pie-tooltip-val">
                      {formatWorkDurationLabel(row.minutes || 0, locale)}
                    </span>
                  </div>
                );
              }}
            />
            <Pie
              data={chart}
              dataKey="minutes"
              nameKey="name"
              innerRadius={26}
              outerRadius={68}
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
            >
              {chart.map((entry) => (
                <Cell key={entry.key || entry.name} fill={entry.fill} stroke="none" />
              ))}
              <LabelList
                dataKey="minutes"
                stroke="none"
                fontSize={11}
                fontWeight={600}
                fill="#f0f0f0"
                formatter={(value) => formatWorkDurationLabel(Number(value) || 0, locale, { short: true })}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Inline **bold** spans for dept body copy. */
function renderInlineBold(text) {
  const raw = String(text || "");
  if (!raw) return null;
  const parts = raw.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={`b-${i}`} className="gina-viz__overview-dept-em">
          {m[1]}
        </strong>
      );
    }
    return part ? <span key={`t-${i}`}>{part}</span> : null;
  });
}

/** Dept headlines with color dots (matches pie) under the bubble intro. */
function TodayOverviewDeptNarrative({ overview, locale = "es" }) {
  const blocks = buildTodayOverviewDeptBlocks({
    overviewByDepartment: overview,
    locale,
  });
  if (!blocks.length) return null;
  return (
    <div className="gina-viz__overview-depts">
      {blocks.map((block) => (
        <section key={block.name} className="gina-viz__overview-dept">
          <h4 className="gina-viz__overview-dept-head">
            <span
              className="gina-viz__overview-dept-dot"
              style={{ background: block.color }}
              aria-hidden
            />
            <span className="gina-chat-card__ai-headline">{block.headline}</span>
          </h4>
          <p className="gina-chat-card__ai-body gina-viz__overview-dept-body">
            {renderInlineBold(block.body)}
          </p>
        </section>
      ))}
    </div>
  );
}

function StatusUnassignedChip({ locale = "es" }) {
  const label = locale === "en" ? "No status assigned" : "Sin status asignado";
  return (
    <span className="doc-status-chip doc-status-chip--status_unassigned" title={label}>
      {label}
    </span>
  );
}

/**
 * Dual timeline for one long block vs the blocks it overlaps.
 * @param {{ conflictRails: object, locale?: string }} props
 */
function TodayConflictDualTimeline({ conflictRails, locale = "es" }) {
  if (!conflictRails || typeof conflictRails !== "object") return null;
  const long = conflictRails.longBlock;
  const others = Array.isArray(conflictRails.overlappingBlocks)
    ? conflictRails.overlappingBlocks
    : [];
  if (!long) return null;
  const rangeStart = conflictRails.rangeStart
    ? new Date(conflictRails.rangeStart).getTime()
    : NaN;
  const rangeEnd = conflictRails.rangeEnd
    ? new Date(conflictRails.rangeEnd).getTime()
    : NaN;
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    return null;
  }
  const span = rangeEnd - rangeStart;
  const en = locale === "en";
  const pct = (ms) => {
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.min(100, ((ms - rangeStart) / span) * 100));
  };
  const widthPct = (startMs, finishMs) => {
    const a = pct(startMs);
    const b = pct(finishMs);
    return Math.max(2, b - a);
  };
  const rangeLabel = `${formatClockLabel(conflictRails.rangeStart)} – ${formatClockLabel(conflictRails.rangeEnd)}`;

  // Hour ticks across the range (inclusive-ish)
  const tickCount = Math.min(6, Math.max(3, Math.ceil(span / (90 * 60 * 1000)) + 1));
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = rangeStart + (span * i) / (tickCount - 1);
    return { ms: t, label: formatClockLabel(new Date(t).toISOString()), pct: (i / (tickCount - 1)) * 100 };
  });

  // Overlap zone = intersection of long with union of others
  let overlapStart = Infinity;
  let overlapEnd = -Infinity;
  for (const o of others) {
    const a = Math.max(long.startMs || 0, o.startMs || 0);
    const b = Math.min(long.finishMs || 0, o.finishMs || 0);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      overlapStart = Math.min(overlapStart, a);
      overlapEnd = Math.max(overlapEnd, b);
    }
  }
  const hasOverlapZone = Number.isFinite(overlapStart) && Number.isFinite(overlapEnd) && overlapEnd > overlapStart;
  const overlapMinutes = hasOverlapZone ? Math.round((overlapEnd - overlapStart) / 60000) : 0;
  const overlapHours = Math.floor(overlapMinutes / 60);
  const overlapRem = overlapMinutes % 60;
  const overlapDur = overlapHours > 0
    ? (en
      ? `${overlapHours}h${overlapRem ? ` ${overlapRem}m` : ""}`
      : `${overlapHours}h${overlapRem ? ` ${overlapRem}m` : ""}`)
    : (en ? `${overlapMinutes}m` : `${overlapMinutes}m`);

  const barColor = (block, isLong) => {
    if (isLong) return undefined;
    const dept = String(block.department || "").toLowerCase();
    if (dept.includes("market") || dept.includes("blog")) return "#599FFF";
    if (dept.includes("estrateg") || dept.includes("plan") || dept.includes("negocio")) return "#EAA65D";
    return undefined;
  };

  return (
    <div className="gina-viz__dual-timeline">
      <header className="gina-viz__dual-timeline-head">
        <span className="gina-viz__dual-timeline-badge" aria-hidden>!</span>
        <div>
          <p className="gina-viz__dual-timeline-title">
            {en
              ? `CONFLICTING HOURS (${rangeLabel})`
              : `HORARIOS EN CONFLICTO (${rangeLabel})`}
          </p>
        </div>
      </header>

      <div className="gina-viz__dual-timeline-axis" aria-hidden>
        {ticks.map((tick) => (
          <span
            key={tick.ms}
            className="gina-viz__dual-timeline-tick"
            style={{ left: `${tick.pct}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <div className="gina-viz__dual-timeline-rail">
        <p className="gina-viz__dual-timeline-label">
          {en ? "Rail A (continuous block)" : "Riel A (bloque continuo)"}
        </p>
        <div className="gina-viz__dual-timeline-track">
          {hasOverlapZone ? (
            <div
              className="gina-viz__dual-timeline-overlap"
              style={{
                left: `${pct(overlapStart)}%`,
                width: `${widthPct(overlapStart, overlapEnd)}%`,
              }}
            />
          ) : null}
          <div
            className="gina-viz__dual-timeline-bar gina-viz__dual-timeline-bar--long"
            style={{
              left: `${pct(long.startMs)}%`,
              width: `${widthPct(long.startMs, long.finishMs)}%`,
            }}
            title={long.label || long.title}
          >
            <span>{long.label || long.title}: {formatClockLabel(long.anchorAt)} – {formatClockLabel(long.anchorFinishAt)}</span>
          </div>
        </div>
      </div>
      <div className="gina-viz__dual-timeline-rail">
        <p className="gina-viz__dual-timeline-label">
          {en ? "Rail B (split blocks)" : "Riel B (bloques fraccionados)"}
        </p>
        <div className="gina-viz__dual-timeline-track">
          {hasOverlapZone ? (
            <div
              className="gina-viz__dual-timeline-overlap"
              style={{
                left: `${pct(overlapStart)}%`,
                width: `${widthPct(overlapStart, overlapEnd)}%`,
              }}
            />
          ) : null}
          {others.map((block) => (
            <div
              key={block.id || `${block.anchorAt}-${block.title}`}
              className="gina-viz__dual-timeline-bar gina-viz__dual-timeline-bar--frag"
              style={{
                left: `${pct(block.startMs)}%`,
                width: `${widthPct(block.startMs, block.finishMs)}%`,
                background: barColor(block, false),
              }}
              title={block.label || block.title}
            >
              <span>
                {block.label || block.title}
                {block.anchorAt && block.anchorFinishAt
                  ? `: ${formatClockLabel(block.anchorAt)}–${formatClockLabel(block.anchorFinishAt)}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {hasOverlapZone ? (
        <p className="gina-viz__dual-timeline-overlap-note">
          {en
            ? `Overlap zone: ${formatClockLabel(new Date(overlapStart).toISOString())} – ${formatClockLabel(new Date(overlapEnd).toISOString())} (${overlapDur} of conflict)`
            : `Área de solapamiento: ${formatClockLabel(new Date(overlapStart).toISOString())} – ${formatClockLabel(new Date(overlapEnd).toISOString())} (${overlapDur} de conflicto)`}
        </p>
      ) : null}
    </div>
  );
}

function formatClockLabel(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function collectTodayOverviewTableDocs(data = {}) {
  const fromFlat = flattenTodayQuickSheetRows(data.quickSheet);
  if (fromFlat.length) return fromFlat;
  if (Array.isArray(data.documents) && data.documents.length) {
    return data.documents.map((d) => ({
      ...d,
      sheetSection: d.sheetSection || "pending",
    }));
  }
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const fromGroups = [];
  for (const g of groups) {
    const folders = Array.isArray(g?.folders) ? g.folders : [];
    for (const f of folders) {
      const docs = Array.isArray(f?.documents) ? f.documents : [];
      for (const d of docs) {
        fromGroups.push({
          ...d,
          department: d.department || g.department || g.name || d.hierarchy?.department,
          category: d.category || f.category || d.hierarchy?.category,
          sheetSection: d.sheetSection || "pending",
        });
      }
    }
  }
  return fromGroups;
}

function TodayQuickSheet({
  quickSheet,
  documents,
  groups,
  locale = "es",
  title = null,
  eyebrow = null,
  folderProgress = null,
  dayProgress = null,
}) {
  const rows = collectTodayOverviewTableDocs({ quickSheet, documents, groups });
  const en = locale === "en";
  const sheetTitle = title
    || (en ? "Today's schedule" : "Horario del día");
  const sheetEyebrow = eyebrow != null ? eyebrow : null;
  const folders = Array.isArray(folderProgress) ? folderProgress : [];
  const day = dayProgress && typeof dayProgress === "object" ? dayProgress : null;
  if (!rows.length) {
    return (
      <div className="gina-viz__quick-sheet gina-viz gina-viz--table">
        <header className="gina-viz__quick-sheet-head">
          {sheetEyebrow ? <span className="gina-viz__eyebrow">{sheetEyebrow}</span> : null}
          <h3 className="gina-viz__title">{sheetTitle}</h3>
        </header>
        <p className="gina-viz__empty">
          {en ? "No timed items for today." : "Sin ítems con horario para hoy."}
        </p>
      </div>
    );
  }
  // Contiguous runs in chronological row order (same pattern as week status rail)
  const statusRail = buildGinaStatusRailRuns(rows, locale);

  return (
    <div className="gina-viz__quick-sheet gina-viz gina-viz--table gina-viz--table-rail">
      <header className="gina-viz__quick-sheet-head">
        {sheetEyebrow ? <span className="gina-viz__eyebrow">{sheetEyebrow}</span> : null}
        <h3 className="gina-viz__title">{sheetTitle}</h3>
      </header>
      <div className="gina-viz__table-layout">
        {statusRail.length ? (
          <div className="gina-viz__dept-rail" aria-hidden="true">
            <div className="gina-viz__dept-rail-head" />
            <div className="gina-viz__dept-rail-body">
              {statusRail.map((seg) => (
                <div
                  key={`${seg.id}-${seg.name}`}
                  className="gina-viz__dept-rail-seg"
                  style={{
                    flexGrow: Math.max(1, seg.count),
                    background: seg.color,
                  }}
                  title={`${seg.name} · ${seg.count}`}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="gina-viz__table-wrap">
          <table className="gina-viz__table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Departamento</th>
                <th>Categoría</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => {
                const struck = Boolean(
                  doc.sheetSection === "completed"
                  || doc.struck
                  || doc.completed
                  || doc.status === DOC_WORK_STATUS.COMPLETED,
                );
                const isUrgency = doc.sheetSection === "urgency";
                const hasStatus = Boolean(doc.status) || struck;
                return (
                  <tr
                    key={doc.id || `${doc.title}-${doc.timeLabel}`}
                    className={isUrgency ? "gina-viz__quick-sheet-row--urgency" : undefined}
                  >
                    <td>
                      {struck ? (
                        <span className="gina-viz__table-title gina-viz__table-title--struck">
                          <s>{doc.title || "—"}</s>
                        </span>
                      ) : (doc.title || "—")}
                    </td>
                    <td>{doc.department || doc.hierarchy?.department || "—"}</td>
                    <td>{doc.category || doc.hierarchy?.category || "—"}</td>
                    <td>
                      <GinaTimeCell doc={doc} struck={struck} />
                    </td>
                    <td>
                      {struck ? (
                        <DocStatusChip status={DOC_WORK_STATUS.COMPLETED} />
                      ) : hasStatus ? (
                        <DocStatusChip status={doc.status} />
                      ) : (
                        <StatusUnassignedChip locale={locale} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {statusRail.length ? (
        <ul className="gina-viz__dept-legend" aria-label="Status">
          {statusRail.map((seg) => (
            <li key={seg.id || seg.name} className="gina-viz__dept-legend-item">
              <span
                className="gina-viz__dept-legend-dot"
                style={{ background: seg.color }}
                aria-hidden
              />
              <span className="gina-viz__dept-legend-name">{seg.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {(folders.length > 0 || day) ? (
        <footer className="gina-viz__day-folder-foot">
          {day && day.total > 0 ? (
            <p className="gina-viz__day-folder-foot-day">
              {en
                ? `${day.total} timed document${day.total === 1 ? "" : "s"} · ${day.percent ?? 0}%`
                : `${day.total} documento${day.total === 1 ? "" : "s"} con horario · ${day.percent ?? 0}%`}
            </p>
          ) : null}
          {folders.length > 0 ? (
            <ul className="gina-viz__day-folder-foot-list">
              {folders.map((f) => (
                <li key={f.folderId || f.folder} className="gina-viz__day-folder-foot-row">
                  <span className="gina-viz__day-folder-foot-name">{f.folder}</span>
                  <span className="gina-viz__day-folder-foot-meta">
                    {en
                      ? `${f.todayCount || 0} on schedule · ${f.percent}% (${f.done}/${f.total})`
                      : `${f.todayCount || 0} en horario · ${f.percent}% (${f.done}/${f.total})`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

/**
 * Today overview: dept narrative + pie + TABLA DE HOY (side-by-side).
 * @param {{ data: object, showTable?: boolean }} props
 */
function TodayOverviewVisualization({ data, showTable = true }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const overview = Array.isArray(data.overviewByDepartment) ? data.overviewByDepartment : [];
  const colorByDept = Object.fromEntries(overview.map((d) => [d.name, d.color]));
  const shown = docs.slice(0, 80);
  const locale = data.locale === "en" ? "en" : "es";
  // Default ON — only hide if explicitly false.
  const tableVisible = showTable !== false && data.overviewShowTable !== false;

  // Contiguous runs in row order so colors align when departments interleave
  const departmentRail = buildGinaDepartmentRailRuns(shown, { colorByDept });

  const legendItems = overview.length
    ? overview.map((d) => ({
      name: d.name,
      color: d.color,
      minutes: d.minutes,
      hoursLabel: d.hoursLabel,
    }))
    : departmentRail.map((s) => ({ name: s.name, color: s.color }));

  return (
    <div className="gina-viz gina-viz--today-overview">
      <TodayOverviewDeptNarrative overview={overview} locale={locale} />
      <div className={
        "gina-viz__today-overview-layout"
        + (tableVisible ? "" : " gina-viz__today-overview-layout--infographic-only")
      }
      >
        <TodayHoursPie data={data} />
        {tableVisible ? (
          <div className="gina-viz__today-overview-table gina-viz gina-viz--table gina-viz--table-rail">
            <header className="gina-viz__head">
              <span className="gina-viz__eyebrow">Tabla de hoy</span>
              <h3 className="gina-viz__title">{data.dateLabel || data.date || "Hoy"}</h3>
            </header>
            {shown.length === 0 ? (
              <p className="gina-viz__empty">Sin horarios en este alcance.</p>
            ) : (
              <>
                <div className="gina-viz__table-layout">
                  {departmentRail.length ? (
                    <div className="gina-viz__dept-rail" aria-hidden="true">
                      <div className="gina-viz__dept-rail-head" />
                      <div className="gina-viz__dept-rail-body">
                        {departmentRail.map((seg) => (
                          <div
                            key={seg.name}
                            className="gina-viz__dept-rail-seg"
                            style={{
                              flexGrow: Math.max(1, seg.count),
                              background: seg.color,
                            }}
                            title={`${seg.name} · ${seg.count}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="gina-viz__table-wrap">
                    <table className="gina-viz__table">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Categoría</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((doc) => (
                          <tr key={doc.id || doc.title}>
                            <td>{doc.title || "—"}</td>
                            <td>{doc.category || doc.hierarchy?.category || "—"}</td>
                            <td><GinaTimeCell doc={doc} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <DeptHoursLegend items={legendItems} />
                {(Array.isArray(data.folderProgress) && data.folderProgress.length) || data.dayProgress ? (
                  <footer className="gina-viz__day-folder-foot">
                    {data.dayProgress?.total > 0 ? (
                      <p className="gina-viz__day-folder-foot-day">
                        {locale === "en"
                          ? `${data.dayProgress.total} timed document${data.dayProgress.total === 1 ? "" : "s"} · ${data.dayProgress.percent ?? 0}%`
                          : `${data.dayProgress.total} documento${data.dayProgress.total === 1 ? "" : "s"} con horario · ${data.dayProgress.percent ?? 0}%`}
                      </p>
                    ) : null}
                    {Array.isArray(data.folderProgress) && data.folderProgress.length ? (
                      <ul className="gina-viz__day-folder-foot-list">
                        {data.folderProgress.map((f) => (
                          <li key={f.folderId || f.folder} className="gina-viz__day-folder-foot-row">
                            <span className="gina-viz__day-folder-foot-name">{f.folder}</span>
                            <span className="gina-viz__day-folder-foot-meta">
                              {locale === "en"
                                ? `${f.todayCount || 0} on schedule · ${f.percent}% (${f.done}/${f.total})`
                                : `${f.todayCount || 0} en horario · ${f.percent}% (${f.done}/${f.total})`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </footer>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScheduleSheetVisualization({ data, onSelectAction, onToggleDaySheetDoc, compact = false }) {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const delayHighlights = Boolean(data.highlightPassedSlots);
  const isDaySheet = Boolean(data.isDaySheet);
  const progress = data.progress || null;
  const locale = data.locale === "en" ? "en" : "es";
  const step = data.currentStep || null;
  const showDual = Boolean(
    step === "conflict_resolve"
    || ((data.notifyBrief || data.recoveryPhase === "brief") && data.conflictRails && step !== "overdue_check"),
  );
  const hideGroups = step === "conflict_resolve" || step === "summary";
  const useCompactChecklist = Boolean(compact || data.compact) && isDaySheet && !showDual && !hideGroups;

  if (data.todayOverview) {
    return (
      <TodayOverviewVisualization
        data={data}
        showTable={data.overviewShowTable !== false}
      />
    );
  }

  if (data.offerDayReady || data.postRescheduleDaySheet) {
    const en = locale === "en";
    return (
      <TodayQuickSheet
        quickSheet={data.quickSheet}
        documents={data.documents}
        groups={groups}
        locale={locale}
        eyebrow={null}
        title={en ? "Today's schedule" : "Horario del día"}
        folderProgress={data.folderProgress}
        dayProgress={data.dayProgress}
      />
    );
  }

  if (step === "summary") {
    return null;
  }

  const flatDocs = (() => {
    if (Array.isArray(data.documents) && data.documents.length) return data.documents;
    const out = [];
    for (const group of groups) {
      for (const folder of group.folders || []) {
        for (const doc of folder.documents || []) out.push(doc);
      }
    }
    return out;
  })();

  if (useCompactChecklist) {
    const done = progress?.completed ?? flatDocs.filter((d) => (
      d.struck || d.completed || d.status === "completed"
    )).length;
    const left = progress?.remaining ?? Math.max(0, flatDocs.length - done);
    return (
      <div className="gina-viz gina-viz--schedule-sheet gina-viz--day-sheet-compact">
        <header className="gina-viz__head gina-viz__head--compact">
          <h3 className="gina-viz__title gina-viz__title--compact">
            {locale === "en" ? "Day schedule" : "Horario del día"}
          </h3>
          {flatDocs.length > 0 ? (
            <p className="gina-viz__sheet-progress gina-viz__sheet-progress--compact">
              <span>
                {done}
                {" "}
                {locale === "en" ? "done" : (done === 1 ? "tachado" : "tachados")}
              </span>
              <span className="gina-viz__sheet-progress-sep" aria-hidden>·</span>
              <span>
                {left}
                {" "}
                {locale === "en" ? "left" : (left === 1 ? "restante" : "restantes")}
              </span>
            </p>
          ) : null}
        </header>
        {flatDocs.length === 0 ? (
          <p className="gina-viz__empty">
            {data.missingAnchor
              ? (locale === "en"
                ? "No day schedule saved yet. Open today’s schedule from Assistance and save it."
                : "Aún no hay horario del día guardado. Ábrelo desde Assistance y guárdalo.")
              : (locale === "en" ? "Nothing on today’s schedule." : "Sin ítems en el horario del día.")}
          </p>
        ) : (
          <ul className="gina-viz__checklist" role="list">
            {flatDocs.map((doc) => {
              const completed = Boolean(doc.struck || doc.completed || doc.status === "completed");
              const pendingIds = Array.isArray(data.pendingSelectedIds)
                ? data.pendingSelectedIds.map(String)
                : [];
              const pending = Boolean(doc.id && !completed && pendingIds.includes(String(doc.id)));
              const checked = completed || pending;
              const status = doc.status || null;
              const h = doc.hierarchy || {};
              const department = h.department || doc.department || null;
              const category = h.category || doc.category || null;
              const folder = h.folder || doc.folder || null;
              return (
                <li
                  key={doc.id || `${doc.title}-${doc.time}`}
                  className={
                    "gina-viz__checklist-row"
                    + (completed ? " gina-viz__checklist-row--done" : "")
                    + (pending ? " gina-viz__checklist-row--pending" : "")
                    + (doc.id && doc.id === data.nextDocumentId ? " gina-viz__checklist-row--next" : "")
                  }
                >
                  <label className="gina-viz__checklist-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!doc.id || !onToggleDaySheetDoc || completed}
                      aria-label={
                        locale === "en"
                          ? (completed
                            ? `${doc.title} completed`
                            : (pending ? `Unselect ${doc.title}` : `Select ${doc.title}`))
                          : (completed
                            ? `${doc.title} completed`
                            : (pending ? `Quitar ${doc.title}` : `Seleccionar ${doc.title}`))
                      }
                      onChange={(e) => {
                        if (!doc.id || !onToggleDaySheetDoc || completed) return;
                        onToggleDaySheetDoc(doc.id, e.target.checked);
                      }}
                    />
                    <span className="gina-viz__checklist-box" aria-hidden />
                  </label>
                  <div className="gina-viz__checklist-body">
                    <div className="gina-viz__checklist-top">
                      <span className={"gina-viz__checklist-time" + (completed ? " is-struck" : "")}>
                        {doc.timeClock || doc.timeLabel || doc.time || "—"}
                      </span>
                      {status ? <DocStatusChip status={status} /> : null}
                    </div>
                    <span className={"gina-viz__checklist-title" + (completed ? " is-struck" : "")}>
                      {completed ? <s>{doc.title}</s> : doc.title}
                    </span>
                    <GinaHierarchyPath
                      department={department}
                      category={category}
                      folder={folder}
                      className="gina-viz__checklist-path"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="gina-viz gina-viz--schedule-sheet">
        {!showDual ? (
          <header className="gina-viz__head">
            <span className="gina-viz__eyebrow">
              {step === "overdue_check"
                ? (data.recoveryOfferMode === "late_start"
                  ? (locale === "en" ? "Pending start" : "Inicio pendiente")
                  : (locale === "en" ? "Expired windows" : "Horarios vencidos"))
                : (isDaySheet ? "Horario del día" : "Horarios")}
            </span>
            <h3 className="gina-viz__title">{data.dateLabel || data.date || "Hoy"}</h3>
            {progress && progress.total > 0 ? (
              <p className="gina-viz__sheet-progress">
                {progress.completed}/{progress.total} completados
                {progress.remaining > 0 ? ` · ${progress.remaining} restante${progress.remaining === 1 ? "" : "s"}` : ""}
              </p>
            ) : null}
          </header>
        ) : null}
        {showDual ? (
          <TodayConflictDualTimeline conflictRails={data.conflictRails} locale={locale} />
        ) : null}
        {hideGroups ? null : groups.length === 0 ? (
          <p className="gina-viz__empty">
            {data.missingAnchor
              ? "Aún no hay tabla de referencia guardada. Mira los horarios de hoy y guárdala."
              : "Sin horarios en este alcance."}
          </p>
        ) : (
          <div className="gina-viz__sheet">
            {groups.map((group) => (
              <section key={group.department} className="gina-viz__sheet-dept">
                <h4 className="gina-viz__sheet-dept-name">{group.department}</h4>
                {(group.folders || []).map((folder) => (
                  <div key={`${group.department}-${folder.folder}`} className="gina-viz__sheet-folder">
                    <p className="gina-viz__sheet-folder-name">{folder.folder}</p>
                    <ul className="gina-viz__sheet-slots">
                      {(folder.documents || []).map((doc) => {
                        const struck = Boolean(doc.struck || doc.completed || doc.status === "completed");
                        const passed = Boolean(doc.passedSlot || delayHighlights);
                        return (
                          <li
                            key={doc.id || `${doc.title}-${doc.time}`}
                            className={
                              "gina-viz__sheet-slot"
                              + (struck ? " gina-viz__sheet-slot--done" : "")
                              + (passed && delayHighlights ? " gina-viz__sheet-slot--urgency" : "")
                              + (doc.id && doc.id === data.nextDocumentId ? " gina-viz__sheet-slot--next" : "")
                            }
                          >
                            <TimeCell
                              doc={doc}
                              passedSlot={Boolean(doc.passedSlot)}
                              delayHighlights={delayHighlights}
                              struck={struck}
                            />
                            <span className={"gina-viz__sheet-title" + (struck ? " gina-viz__sheet-title--struck" : "")}>
                              {struck ? <s>{doc.title}</s> : doc.title}
                            </span>
                            {(step === "overdue_check" || data.rowStatusEditable) && doc.id ? (
                              <GinaSheetRowStatusPicker
                                status={doc.status || DOC_WORK_STATUS.NOT_STARTED}
                                docId={doc.id}
                                locale={locale}
                                onSelectAction={onSelectAction}
                              />
                            ) : (
                              doc.status ? <DocStatusChip status={doc.status} /> : null
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      {step === "overdue_check" || step === "conflict_resolve" ? (
        <RecoveryEasyLinksLegend
          locale={locale}
          onSelectAction={onSelectAction}
          recoveryOfferMode={data.recoveryOfferMode}
          currentStep={step}
          urgencyCount={data.urgencyCount}
          lateStartCount={data.lateStartCount}
          openDocId={data.openDocId}
          openDocTitle={data.openDocTitle}
          ready={!data.recoveryWizard || data.easyLinksReady === true}
        />
      ) : null}
    </>
  );
}

/** Stable ids for future SFX (no playback yet — gina-audio-deferred). */
const EASY_LINK_SFX_BY_ID = {
  mark_completed: "easy_link_completed",
  mark_past_due: "easy_link_past_due",
  delete_overdue_docs: "easy_link_delete",
  move_end_of_day: "easy_link_reschedule",
  recovery_snooze: "easy_link_snooze",
  mark_in_progress_batch: "easy_link_in_progress",
  open_late_start_doc: "easy_link_open",
};

/**
 * Highlight first case-insensitive occurrence of phrase inside body text.
 * @param {string} body
 * @param {string} phrase
 */
function highlightEasyLinkPhrase(body, phrase) {
  const text = String(body || "");
  const needle = String(phrase || "").trim();
  if (!text || !needle) return text;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + needle.length);
  const after = text.slice(idx + needle.length);
  return (
    <>
      {before}
      <mark className="gina-viz__easy-link-mark">{match}</mark>
      {after}
    </>
  );
}

function RecoverySnoozeMenu({ locale = "es", onSelectAction }) {
  const en = locale === "en";
  const options = buildRecoverySnoozeMenuOptions({ locale });
  const [open, setOpen] = useState(false);
  const [exactOpen, setExactOpen] = useState(false);
  const [exactTime, setExactTime] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setExactOpen(false);
      }
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setExactOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const confirmExact = () => {
    const protocol = buildRecoverySnoozeExactProtocol(exactTime, { locale });
    if (!protocol) return;
    onSelectAction?.(protocol, en ? "Snooze" : "Posponer");
    setOpen(false);
    setExactOpen(false);
  };

  return (
    <div className="gina-viz__snooze-menu" ref={rootRef}>
      <button
        type="button"
        className="gina-viz__snooze-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <img
          className="gina-viz__snooze-trigger-icon"
          src="/uploads/CalendarDots.svg"
          alt=""
          aria-hidden
        />
        {en ? "Snooze" : "Posponer"}
        <span aria-hidden> ▾</span>
      </button>
      {open ? (
        <div className="gina-viz__snooze-popover" role="menu">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="gina-viz__snooze-option"
              role="menuitem"
              onClick={() => {
                if (opt.exactTime) {
                  setExactOpen(true);
                  return;
                }
                if (opt.text) {
                  onSelectAction?.(opt.text, opt.label);
                  setOpen(false);
                }
              }}
            >
              {opt.label}
            </button>
          ))}
          {exactOpen ? (
            <div className="gina-viz__snooze-exact">
              <input
                type="time"
                className="gina-viz__snooze-exact-input"
                value={exactTime}
                step={900}
                onChange={(e) => setExactTime(e.target.value)}
                aria-label={en ? "Exact reminder time" : "Hora exacta del recordatorio"}
              />
              <button
                type="button"
                className="gina-viz__snooze-exact-confirm"
                disabled={!exactTime}
                onClick={confirmExact}
              >
                {en ? "Set" : "Listo"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecoveryChangeStatusMenu({ locale = "es", recoveryOfferMode, onSelectAction }) {
  const en = locale === "en";
  const options = buildRecoveryChangeStatusMenuOptions({ locale, recoveryOfferMode });
  const [open, setOpen] = useState(false);
  const [appliedId, setAppliedId] = useState(/** @type {string | null} */ (null));
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="gina-viz__snooze-menu gina-viz__status-menu" ref={rootRef}>
      <button
        type="button"
        className="gina-viz__snooze-trigger gina-viz__status-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {en ? "Change status" : "Cambiar status"}
        <span aria-hidden> ▾</span>
      </button>
      {open ? (
        <div className="gina-viz__snooze-popover" role="menu">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="gina-viz__snooze-option"
              role="menuitem"
              onClick={() => {
                if (!opt.text) return;
                onSelectAction?.(opt.text, opt.label);
                setAppliedId(opt.id);
                setOpen(false);
              }}
            >
              {opt.label}
              {appliedId === opt.id ? (
                <span className="gina-viz__status-applied" aria-hidden>✓</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Per-row status chip → menu. Used inside schedule / reschedule tables so each
 * block can be updated without a global Easy Links action.
 */
function GinaSheetRowStatusPicker({
  status,
  docId,
  locale = "es",
  onSelectAction,
}) {
  const en = locale === "en";
  const id = String(docId || "").trim();
  const [open, setOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState(status || null);
  const rootRef = useRef(null);
  const options = buildSheetRowStatusMenuOptions({ locale, docId: id });

  useEffect(() => {
    setLocalStatus(status || null);
  }, [status, id]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!id || !localStatus) {
    return localStatus ? <DocStatusChip status={localStatus} /> : null;
  }

  return (
    <div className="gina-viz__row-status-picker" ref={rootRef}>
      <button
        type="button"
        className="gina-viz__row-status-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={en ? "Change status" : "Cambiar status"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DocStatusChip status={localStatus} />
        <span className="gina-viz__row-status-caret" aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="gina-viz__snooze-popover gina-viz__row-status-popover" role="menu">
          {options.map((opt) => {
            const active = opt.status === localStatus;
            return (
              <button
                key={opt.id}
                type="button"
                className={
                  "gina-viz__snooze-option"
                  + (active ? " gina-viz__snooze-option--active" : "")
                }
                role="menuitem"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!opt.text) return;
                  setLocalStatus(opt.status);
                  onSelectAction?.(opt.text, opt.label);
                  setOpen(false);
                }}
              >
                <DocStatusChip status={opt.status} />
                {active ? (
                  <span className="gina-viz__status-applied" aria-hidden>✓</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Easy Links — star Reagendar + secondary alternatives + status/snooze menus.
 */
function RecoveryEasyLinksLegend({
  locale = "es",
  onSelectAction,
  recoveryOfferMode,
  currentStep,
  urgencyCount,
  lateStartCount,
  openDocId,
  openDocTitle,
  ready = true,
}) {
  const en = locale === "en";
  const rows = buildRecoveryEasyLinksLegend({
    locale,
    recoveryOfferMode,
    currentStep,
    urgencyCount,
    lateStartCount,
    openDocId,
    openDocTitle,
  });
  const star = rows.find((r) => r.tier === "star") || null;
  const secondary = rows.filter((r) => r.tier === "secondary");
  const status = rows.find((r) => r.tier === "status") || null;
  const snooze = rows.find((r) => r.tier === "snooze") || null;
  const cards = rows.filter((r) => r.tier === "card");

  /** star → status → alt intro → secondary… → snooze → card (delete last). */
  const steps = [];
  if (star) steps.push({ kind: "row", row: star });
  if (status) steps.push({ kind: "row", row: status });
  if (star && (secondary.length || cards.length)) {
    steps.push({
      kind: "intro",
      text: en
        ? "As an alternative, you can also take any of these actions:"
        : "Como alternativa, también puedes realizar cualquiera de estas acciones:",
    });
  }
  for (const row of secondary) steps.push({ kind: "row", row });
  if (snooze) steps.push({ kind: "row", row: snooze });
  for (const row of cards) steps.push({ kind: "row", row });

  const [stepIdx, setStepIdx] = useState(0);
  const typingKeyRef = useRef(0);

  useEffect(() => {
    if (!ready) {
      setStepIdx(0);
      typingKeyRef.current += 1;
    }
  }, [ready]);

  if (!ready || !steps.length) return null;

  const advance = (from) => {
    setStepIdx((n) => (n === from ? from + 1 : n));
  };

  return (
    <div
      className="gina-viz__easy-links gina-viz__easy-links--stacked"
      aria-label={en ? "Easy Links" : "Easy Links"}
    >
      {steps.map((step, index) => {
        if (index > stepIdx) return null;
        const isTyping = index === stepIdx;
        const isDone = index < stepIdx;

        if (step.kind === "intro") {
          return (
            <div key="alt-intro" className="gina-viz__easy-links-block">
              {isTyping ? (
                <GinaAiMessageText
                  key={`easy-intro-${typingKeyRef.current}-${index}`}
                  text={step.text}
                  onComplete={() => advance(index)}
                />
              ) : (
                <p className="gina-viz__easy-links-alt-intro gina-chat-card__ai-headline">
                  {step.text}
                </p>
              )}
            </div>
          );
        }

        const row = step.row;
        const blockText = `${row.title}:\n${row.body}`;
        return (
          <div key={row.id} className="gina-viz__easy-links-block">
            <section
              className={
                "gina-viz__easy-link"
                + (row.tier === "star" ? " gina-viz__easy-link--star" : "")
                + (row.tier === "snooze" || row.tier === "card" ? " gina-viz__easy-link--snooze" : "")
                + (row.tier === "status" ? " gina-viz__easy-link--status" : "")
                + (row.tier === "secondary" ? " gina-viz__easy-link--secondary gina-viz__easy-link--flat" : "")
              }
              data-sfx-id={EASY_LINK_SFX_BY_ID[row.id] || `easy_link_${row.id}`}
            >
              <div className="gina-viz__easy-link-head">
                <span
                  className="gina-viz__overview-dept-dot"
                  style={{ background: row.statusColor || (row.tier === "star" ? "#c9b896" : "#8a8a8a") }}
                  aria-hidden
                />
                <div className="gina-viz__easy-link-copy">
                  {isTyping ? (
                    <GinaAiMessageText
                      key={`easy-row-${typingKeyRef.current}-${row.id}-${index}`}
                      text={blockText}
                      onComplete={() => advance(index)}
                    />
                  ) : null}
                  {isDone ? (
                    <>
                      <div className="gina-viz__easy-link-headline-row">
                        <span className="gina-chat-card__ai-headline">{`${row.title}:`}</span>
                      </div>
                      <p className="gina-chat-card__ai-body gina-viz__easy-link-body">
                        {row.bodyHighlight
                          ? highlightEasyLinkPhrase(row.body, row.bodyHighlight)
                          : row.body}
                        {row.control === "link" && row.actionText && row.tier !== "card" ? (
                          <>
                            {" "}
                            <button
                              type="button"
                              className="gina-viz__easy-link-inline"
                              onClick={() => onSelectAction?.(
                                row.actionText,
                                row.ctaLabel || row.title,
                              )}
                            >
                              {row.ctaLabel || row.title}
                            </button>
                          </>
                        ) : null}
                      </p>
                      {row.control === "link" && row.actionText && row.tier === "card" ? (
                        <button
                          type="button"
                          className={
                            "gina-viz__snooze-trigger"
                            + (row.id === "delete_overdue_docs"
                              ? " gina-viz__snooze-trigger--danger"
                              : "")
                          }
                          onClick={() => onSelectAction?.(
                            row.actionText,
                            row.ctaLabel || row.title,
                          )}
                        >
                          {row.ctaLabel || row.title}
                        </button>
                      ) : null}
                      {row.control === "status_menu" ? (
                        <RecoveryChangeStatusMenu
                          locale={locale}
                          recoveryOfferMode={recoveryOfferMode}
                          onSelectAction={onSelectAction}
                        />
                      ) : null}
                      {row.control === "snooze_menu" ? (
                        <RecoverySnoozeMenu locale={locale} onSelectAction={onSelectAction} />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}

function IncompleteVisualization({ data }) {
  const sections = [
    { key: "pastDue", title: "Vencidos", items: data.pastDue },
    { key: "upcoming", title: "Próximos", items: data.upcoming },
    { key: "longTerm", title: "Largo plazo / reserved", items: data.longTerm },
  ];
  return (
    <div className="gina-viz gina-viz--incomplete">
      {sections.map((sec) => {
        const items = Array.isArray(sec.items) ? sec.items : [];
        if (!items.length) return null;
        return (
          <section key={sec.key} className="gina-viz__section">
            <h3 className="gina-viz__section-title">
              {sec.title} ({items.length})
            </h3>
            <ul className="gina-viz__list">
              {items.slice(0, 8).map((doc) => (
                <DocLine key={doc.id || doc.title} doc={doc} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FolderSummaryVisualization({ data }) {
  const h = data.hierarchy || {};
  return (
    <div className="gina-viz gina-viz--folder">
      <GinaHierarchyPath
        department={h.department || data.department}
        category={h.category || data.category}
        folder={h.folder || data.folderName}
      />
      <h3 className="gina-viz__title">{data.folderName || data.department || "Summary"}</h3>
      <p className="gina-viz__total">Total: {data.total ?? 0} documentos</p>
      <div className="gina-viz__stats">
        <StatRow label="Completados" value={data.completed ?? 0} tone="completed" />
        <StatRow label="En progreso" value={data.inProgress ?? 0} tone="in-progress" />
        <StatRow label="Sin empezar" value={data.notStarted ?? 0} tone="not-started" />
      </div>
      <div className="gina-viz__progress" aria-hidden>
        <div
          className="gina-viz__progress-bar"
          style={{ width: `${Math.min(100, Math.max(0, data.percentComplete || 0))}%` }}
        />
      </div>
      <p className="gina-viz__next">{data.percentComplete ?? 0}% completado</p>
      {Array.isArray(data.documents) && data.documents.length ? (
        <ul className="gina-viz__list">
          {data.documents.slice(0, 6).map((doc) => (
            <DocLine key={doc.id || doc.title} doc={doc} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ConflictsVisualization({ data }) {
  const list = Array.isArray(data.conflicts) ? data.conflicts : [];
  return (
    <div className="gina-viz gina-viz--conflicts">
      <h3 className="gina-viz__title">Conflictos ({data.total ?? list.length})</h3>
      {!list.length ? (
        <p className="gina-viz__empty">Sin solapes detectados.</p>
      ) : (
        <ul className="gina-viz__list">
          {list.map((c, i) => (
            <li key={i} className="gina-viz__conflict">
              {c.date ? <span className="gina-viz__doc-meta">{c.date}</span> : null}
              <p className="gina-viz__doc-title">
                {c.a?.title || "—"} ↔ {c.b?.title || "—"}
              </p>
              {c.overlap ? <span className="gina-viz__doc-meta gina-viz__doc-meta--warn">{c.overlap}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WeekFolderPctPie({ data, locale = "es", onSelectAction }) {
  const chart = Array.isArray(data?.folderPctChart) ? data.folderPctChart : [];
  const week = data?.weekProgress && typeof data.weekProgress === "object"
    ? data.weekProgress
    : null;
  const en = locale === "en";
  if (!chart.length && !(week && week.total > 0)) {
    return (
      <p className="gina-viz__empty">
        {en
          ? "No folder progress for this week’s schedules."
          : "Sin avance de folders en los horarios de esta semana."}
      </p>
    );
  }
  return (
    <div className="gina-viz__week-pct">
      {chart.length ? (
        <div className="gina-viz__hours-pie gina-viz__hours-pie--side">
          <div className="gina-viz__hours-pie-chart">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload || {};
                    return (
                      <div className="gina-viz__hours-pie-tooltip">
                        <span className="gina-viz__hours-pie-tooltip-name">{row.name}</span>
                        <span className="gina-viz__hours-pie-tooltip-val">
                          {`${row.percent ?? 0}% (${row.done ?? 0}/${row.total ?? 0})`}
                        </span>
                      </div>
                    );
                  }}
                />
                <Pie
                  data={chart}
                  dataKey="minutes"
                  nameKey="name"
                  innerRadius={26}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                >
                  {chart.map((entry) => (
                    <Cell key={entry.key || entry.name} fill={entry.fill} stroke="none" />
                  ))}
                  <LabelList
                    dataKey="percent"
                    stroke="none"
                    fontSize={11}
                    fontWeight={600}
                    fill="#f0f0f0"
                    formatter={(value) => `${Number(value) || 0}%`}
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
      {Array.isArray(data.folderProgress) && data.folderProgress.length ? (
        <ul className="gina-viz__day-folder-foot-list gina-viz__week-folder-list">
          {data.folderProgress.map((f) => {
            const folderId = String(f.folderId || "").trim();
            const name = String(f.folder || "").trim() || "Folder";
            const meta = en
              ? `${f.todayCount || 0} on week · ${f.percent}% (${f.done}/${f.total})`
              : `${f.todayCount || 0} en semana · ${f.percent}% (${f.done}/${f.total})`;
            if (folderId && onSelectAction) {
              return (
                <li key={folderId || name} className="gina-viz__day-folder-foot-row">
                  <button
                    type="button"
                    className="gina-viz__week-folder-open"
                    onClick={() => onSelectAction(
                      `GinaOpenDocument:${folderId}`,
                      name,
                    )}
                  >
                    <span className="gina-viz__day-folder-foot-name">{name}</span>
                    <span className="gina-viz__day-folder-foot-meta">{meta}</span>
                  </button>
                </li>
              );
            }
            return (
              <li key={folderId || name} className="gina-viz__day-folder-foot-row">
                <span className="gina-viz__day-folder-foot-name">{name}</span>
                <span className="gina-viz__day-folder-foot-meta">{meta}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {week && week.total > 0 ? (
        <p className="gina-viz__week-pct-foot">
          {en
            ? `${week.total} timed document${week.total === 1 ? "" : "s"} · ${week.percent ?? 0}%`
            : `${week.total} documento${week.total === 1 ? "" : "s"} con horario · ${week.percent ?? 0}%`}
        </p>
      ) : null}
    </div>
  );
}

function TableVisualization({ data, onSelectAction }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const limit = data.listAll ? 80 : 12;
  const view = data.view || {};
  const locale = data.locale === "en" ? "en" : "es";
  const en = locale === "en";
  const fromCount = Boolean(data.fromCountDocuments);
  const weekDisplayMode = data.weekDisplayMode || view.weekDisplayMode || "schedule";
  const isWeekLayout = view.layout === "schedules_week" || data.railMode === "weekday";
  const highlightCats = (Array.isArray(view.highlightCategories) && view.highlightCategories.length
    ? view.highlightCategories
    : [])
    .map((c) => String(c || "").trim().toLowerCase())
    .filter(Boolean);
  const deferMs = highlightCats.length > 0
    ? (Number.isFinite(Number(data.highlightDelayMs))
      ? Number(data.highlightDelayMs)
      : (data.deferredCategoryHighlight ? 2000 : 0))
    : 0;
  const highlightKey = highlightCats.join("|");
  const [highlightReady, setHighlightReady] = useState(deferMs <= 0);

  useEffect(() => {
    if (deferMs <= 0) {
      setHighlightReady(true);
      return undefined;
    }
    setHighlightReady(false);
    const t = window.setTimeout(() => setHighlightReady(true), deferMs);
    return () => window.clearTimeout(t);
  }, [deferMs, highlightKey]);

  const shown = docs.slice(0, limit);
  const railModeRaw = data.railMode || view.railMode || "department";
  const railMode = railModeRaw === "status"
    || railModeRaw === "category"
    || railModeRaw === "weekday"
    || railModeRaw === "none"
    ? railModeRaw
    : "department";
  const weekStartsOn = getGinaPrefs().weekStartsOn === 0 ? 0 : 1;
  // Rail must match visible rows so segment height lines up with tbody
  const tableRail = fromCount && railMode !== "none" && weekDisplayMode !== "folder_pct"
    ? (railMode === "status"
      ? buildGinaStatusRail(shown, locale)
      : (railMode === "category"
        ? buildGinaCategoryRail(shown)
        : (railMode === "weekday"
          ? buildGinaWeekdayRail(shown, { locale, weekStartsOn })
          : buildGinaDepartmentRail(shown))))
    : [];
  const showTableRail = fromCount && tableRail.length > 0 && shown.length > 0;
  const railLegendLabel = railMode === "status"
    ? "Status"
    : (railMode === "category"
      ? "Categorías"
      : (railMode === "weekday" ? (locale === "en" ? "Days" : "Días") : "Departamentos"));
  const legendName = (seg) => {
    if (railMode === "weekday") {
      const abbr = seg.abbr || seg.letter;
      return abbr ? `${abbr} · ${seg.name}` : seg.name;
    }
    return seg.name;
  };
  const categoryIsHighlighted = (doc) => {
    if (!fromCount || !highlightCats.length || !highlightReady) return false;
    const cat = String(doc.category || doc.hierarchy?.category || "").trim().toLowerCase();
    if (!cat) return false;
    return highlightCats.some((h) => cat === h || cat.includes(h) || h.includes(cat));
  };
  const columns = Array.isArray(data.columns) && data.columns.length
    ? data.columns.filter((key) => !(fromCount && key === "department" && railMode === "department"))
    : fromCount
      ? (() => {
        const secondary = view.secondaryColumn === "folder" ? "folder" : "category";
        if (view.layout === "schedules_all" || view.layout === "schedules_week") {
          return [
            "document",
            secondary,
            "time",
            ...(view.showStatus !== false ? ["status"] : []),
          ];
        }
        return [
          "document",
          secondary,
          // Prefer all_docs order: Status before Fecha y Hora
          ...(view.showStatus || view.layout === "all_docs" ? ["status"] : []),
          ...(view.showSchedule || view.layout === "all_docs" ? ["time"] : []),
        ];
      })()
      : ["document", "path", "status", "time"];

  const colLabel = (key) => {
    switch (key) {
      case "document": return en ? "Document" : "Documento";
      case "department": return en ? "Department" : "Departamento";
      case "category": return en ? "Category" : "Categoría";
      case "folder": return "Folder";
      case "path": return en ? "Path" : "Ruta";
      case "status": return en ? "Status" : "Estado";
      case "time": return en ? "Date and time" : "Fecha y Hora";
      case "weekday": return en ? "Day" : "Día";
      default: return key;
    }
  };

  const renderCell = (doc, key) => {
    const h = doc.hierarchy || {};
    switch (key) {
      case "document": {
        const struck = Boolean(doc.struck || doc.completed || doc.status === "completed");
        const title = doc.title || "—";
        if (!struck) return title;
        return (
          <span className="gina-viz__table-title gina-viz__table-title--struck">
            <s>{title}</s>
          </span>
        );
      }
      case "department":
        return doc.department || h.department || "—";
      case "category":
        return doc.category || h.category || "—";
      case "folder":
        return doc.folder || h.folder || "—";
      case "path":
        return [h.department, h.category, h.folder].filter(Boolean).join(" / ") || "—";
      case "status":
        return doc.status ? <DocStatusChip status={doc.status} /> : "—";
      case "time":
        return <GinaTimeCell doc={doc} struck={Boolean(doc.struck || doc.completed)} />;
      case "weekday":
        return doc.weekday || "—";
      default:
        return "—";
    }
  };

  const weekModeButtons = isWeekLayout
    ? (weekDisplayMode === "schedule"
      ? getGinaWeekViewChips(locale).map((c) => ({
        id: c.id,
        mode: c.mode,
        label: c.label,
        text: c.text,
      }))
      : [{
        id: "week_back_schedule",
        mode: "schedule",
        label: en ? "Back" : "atrás",
        text: en ? "back to this week's schedules" : "volver a horarios de la semana",
      }])
    : [];

  const emptyCopy = weekDisplayMode === "overdue"
    ? (en
      ? "No overdue timed slots this week that still need a status change."
      : "Esta semana no hay horarios vencidos que aún necesiten cambio de status.")
    : (data.department
      ? `Cero documentos en ${data.department}.`
      : data.category
        ? `Cero documentos en ${data.category}.`
        : "Sin documentos en este alcance.");

  return (
    <div className={"gina-viz gina-viz--table" + (showTableRail ? " gina-viz--table-rail" : "")}>
      {data.title ? <h3 className="gina-viz__title">{data.title}</h3> : null}
      {weekDisplayMode === "folder_pct" ? (
        <WeekFolderPctPie
          data={data}
          locale={locale}
          onSelectAction={onSelectAction}
        />
      ) : (
        <>
          {(data.empty || !docs.length) ? (
            <p className="gina-viz__empty">{emptyCopy}</p>
          ) : null}
          {shown.length ? (
            <>
              <div className="gina-viz__table-layout">
                {showTableRail ? (
                  <div
                    className={
                      "gina-viz__dept-rail"
                      + (railMode === "weekday" ? " gina-viz__dept-rail--weekday" : "")
                    }
                    aria-hidden="true"
                  >
                    <div className="gina-viz__dept-rail-head" />
                    <div className="gina-viz__dept-rail-body">
                      {tableRail.map((seg) => (
                        <div
                          key={seg.id || seg.name}
                          className={
                            "gina-viz__dept-rail-seg"
                            + (railMode === "weekday" ? " gina-viz__dept-rail-seg--weekday" : "")
                          }
                          style={{
                            flexGrow: Math.max(1, seg.count),
                            background: seg.color,
                          }}
                          title={`${seg.name} · ${seg.count}`}
                        >
                          {railMode === "weekday" && (seg.abbr || seg.letter) ? (
                            <span className="gina-viz__dept-rail-letter">
                              {seg.abbr || seg.letter}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="gina-viz__table-wrap">
                  <table className="gina-viz__table">
                    <thead>
                      <tr>
                        {columns.map((key) => (
                          <th key={key}>{colLabel(key)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((doc) => (
                        <tr key={doc.id || doc.title}>
                          {columns.map((key) => (
                            <td
                              key={key}
                              className={
                                key === "category" && categoryIsHighlighted(doc)
                                  ? "gina-viz__table-cell--highlight"
                                  : undefined
                              }
                            >
                              {renderCell(doc, key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {showTableRail ? (
                <ul className="gina-viz__dept-legend" aria-label={railLegendLabel}>
                  {tableRail.map((seg) => (
                    <li key={seg.id || seg.name} className="gina-viz__dept-legend-item">
                      <span
                        className="gina-viz__dept-legend-dot"
                        style={{ background: seg.color }}
                        aria-hidden
                      />
                      <span className="gina-viz__dept-legend-name">
                        {legendName(seg)}
                        {seg.count != null ? ` · ${seg.count}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      )}
      {weekModeButtons.length && onSelectAction ? (
        <div className="gina-viz__week-modes" role="group">
          {weekModeButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              className={
                "gina-viz__week-mode-btn"
                + (weekDisplayMode === btn.mode ? " is-active" : "")
              }
              onClick={() => onSelectAction?.(btn.text, btn.label)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TimelineVisualization({ data }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return (
    <div className="gina-viz gina-viz--timeline">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Horarios</span>
        <h3 className="gina-viz__title">{data.dateLabel || data.date || "Timeline"}</h3>
      </header>
      <ol className="gina-viz__timeline">
        {docs.map((doc) => (
          <li key={doc.id || doc.title} className="gina-viz__timeline-item">
            <GinaTimeCell doc={doc} className="gina-viz__timeline-time" />
            <div className="gina-viz__timeline-body">
              <GinaHierarchyPath
                department={doc.hierarchy?.department || doc.department}
                category={doc.hierarchy?.category || doc.category}
                folder={doc.hierarchy?.folder || doc.folder}
              />
              <span className="gina-viz__doc-title">{doc.title}</span>
              {doc.status ? <DocStatusChip status={doc.status} /> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FindResultsVisualization({ data, onSelectAction }) {
  const results = Array.isArray(data.results) ? data.results : [];
  const clarify = Array.isArray(data.clarifyOptions) ? data.clarifyOptions : [];
  if (data.needsClarify && clarify.length) {
    return (
      <div className="gina-viz gina-viz--find-results">
        <header className="gina-viz__head">
          <span className="gina-viz__eyebrow">Buscar</span>
          <h3 className="gina-viz__title">Necesito precisar el alcance</h3>
        </header>
        <ul className="gina-viz__find-clarify">
          {clarify.map((opt) => (
            <li key={opt.label}>
              <button
                type="button"
                className="gina-viz__find-clarify-btn"
                onClick={() => onSelectAction?.(opt.text, opt.label)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!results.length) {
    return (
      <div className="gina-viz gina-viz--find-results">
        <header className="gina-viz__head">
          <span className="gina-viz__eyebrow">Buscar</span>
          <h3 className="gina-viz__title">Sin coincidencias</h3>
        </header>
        <p className="gina-viz__empty">No encontré documentos con esos filtros.</p>
      </div>
    );
  }
  return (
    <div className="gina-viz gina-viz--find-results">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Buscar</span>
        <h3 className="gina-viz__title">
          {results.length === 1 ? "1 coincidencia" : `${data.total || results.length} opciones`}
        </h3>
      </header>
      <ul className="gina-viz__find-list">
        {results.map((doc) => (
          <li key={doc.id || doc.title} className="gina-viz__find-row">
            <button
              type="button"
              className="gina-viz__find-open"
              onClick={() => onSelectAction?.(
                `GinaRevealDocument:${doc.id}`,
                doc.title ? `Abrir «${doc.title}»` : "Abrir documento",
              )}
            >
              <span className="gina-viz__find-title">{doc.title}</span>
              <GinaHierarchyPath
                department={doc.department}
                category={doc.category}
                folder={doc.folder}
              />
              {doc.excerpt ? (
                <span className="gina-viz__find-excerpt">{doc.excerpt}</span>
              ) : null}
              <span className="gina-viz__find-meta">
                {doc.matchWhere === "title"
                  ? "título"
                  : doc.matchWhere === "body"
                    ? "contenido"
                    : "alcance"}
              </span>
              {doc.status ? <DocStatusChip status={doc.status} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Success ack after saving today's schedule — checkmark fly-in, no table.
 * @param {{ data?: object, onReady?: () => void }} props
 */
function DaySheetSavedVisualization({ data, onReady }) {
  const firedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const locale = data?.locale === "en" ? "en" : "es";

  useEffect(() => {
    if (firedRef.current) return undefined;
    const t = window.setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onReadyRef.current?.();
    }, 720);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="gina-viz gina-viz--day-sheet-saved" role="status" aria-live="polite">
      <motion.div
        className="gina-viz__saved-plate"
        initial={{ opacity: 0, scale: 0.55, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 22, mass: 0.85 }}
      >
        <motion.img
          className="gina-viz__saved-check"
          src="/uploads/gina-day-sheet-saved-check.png"
          alt=""
          aria-hidden
          initial={{ opacity: 0, scale: 0.4, rotate: -18 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 420, damping: 18 }}
        />
      </motion.div>
      <p className="gina-viz__saved-caption">
        {locale === "en" ? "Schedule saved" : "Horario guardado"}
      </p>
    </div>
  );
}

/**
 * @param {{
 *   type?: string | null,
 *   data?: object | null,
 *   onSelectDepartment?: (departmentName: string) => void,
 *   onSelectAction?: (text: string, displayText?: string) => void,
 *   onToggleDaySheetDoc?: (docId: string, nextCompleted: boolean) => void,
 *   compact?: boolean,
 *   onReady?: () => void,
 * }} props
 */
export function GinaDataVisualization({
  type,
  data,
  onSelectDepartment,
  onSelectAction,
  onToggleDaySheetDoc,
  compact = false,
  onReady,
}) {
  if (!type || type === "null" || !data) return null;
  const dept = data.department || "";

  switch (type) {
    case "day_sheet_saved":
      return <DaySheetSavedVisualization data={data} onReady={onReady} />;
    case "category_scope":
      return <CategoryScopeVisualization data={data} />;
    case "category_list":
      return <CategoryListVisualization data={data} />;
    case "folder_list":
      return <FolderListVisualization data={data} />;
    case "document_list":
      return <DocumentListVisualization data={data} />;
    case "document_count":
      return <DocumentCountVisualization data={data} />;
    case "document_dept_groups":
      return <DocumentDeptGroupsVisualization data={data} />;
    case "department_list":
      return (
        <DepartmentListVisualization
          data={data}
          onSelectDepartment={onSelectDepartment}
        />
      );
    case "department_cards":
      return (
        <DepartmentCardsVisualization
          data={data}
          onSelectDepartment={onSelectDepartment}
        />
      );
    case "dept_summary":
      return (
        <DeptSummaryVisualization
          data={data}
          onSelectAction={onSelectAction}
        />
      );
    case "dept_status_menu":
      return (
        <StatusMenuVisualization
          data={data}
          onSelectAction={onSelectAction}
        />
      );
    case "dept_folder_menu":
      return (
        <SelectableMenuVisualization
          eyebrow="Folders"
          title={dept}
          items={(data.folders || []).map((f) => ({
            id: f.id || f.name,
            name: f.name,
            label: f.name,
            meta: f.documents != null ? `${f.documents} docs` : undefined,
            text: `Folder ${f.name} hoy en ${dept}`,
          }))}
          onSelect={(item) => onSelectAction?.(item.text)}
        />
      );
    case "dept_category_menu":
      return (
        <SelectableMenuVisualization
          eyebrow="Categorías"
          title={dept}
          items={[
            {
              id: "all",
              name: "All",
              label: "All",
              meta: data.documents != null ? `${data.documents} docs` : undefined,
              text: `Categoría All hoy en ${dept}`,
            },
            ...(data.categories || []).map((c) => ({
              id: c.name,
              name: c.name,
              label: c.name,
              meta: c.documents != null ? `${c.documents} docs` : undefined,
              text: `Categoría ${c.name} hoy en ${dept}`,
            })),
          ]}
          onSelect={(item) => onSelectAction?.(item.text)}
        />
      );
    case "dept_status_list":
      return <DocStatusListVisualization data={data} />;
    case "dept_folder_detail":
      return (
        <DocStatusListVisualization
          data={{
            ...data,
            statusLabel: data.folder,
            status: "folder",
          }}
        />
      );
    case "dept_category_detail":
      return <CategoryDetailVisualization data={data} />;
    case "daily_report":
      return <DailyReportVisualization data={data} />;
    case "daily_report_move_preview":
      return <DailyReportMovePreviewVisualization data={data} />;
    case "schedule_sheet":
      return (
        <ScheduleSheetVisualization
          data={data}
          onSelectAction={onSelectAction}
          onToggleDaySheetDoc={onToggleDaySheetDoc}
          compact={compact}
        />
      );
    case "today_quick_sheet":
      return (
        <TodayQuickSheet
          quickSheet={data.quickSheet || null}
          documents={data.documents}
          groups={data.groups}
          locale={data.locale === "en" ? "en" : "es"}
          folderProgress={data.folderProgress}
          dayProgress={data.dayProgress}
        />
      );
    case "recovery_preview":
      return <RecoveryPreviewVisualization data={data} />;
    case "schedule_slot_picker":
      return (
        <ScheduleSlotPickerVisualization
          data={data}
          onSelectAction={onSelectAction}
        />
      );
    case "today_scope":
      return <TodayScopeVisualization data={data} />;
    case "incomplete":
      return <IncompleteVisualization data={data} />;
    case "folder_summary":
      return <FolderSummaryVisualization data={data} />;
    case "conflicts":
      return <ConflictsVisualization data={data} />;
    case "table":
      return (
        <TableVisualization
          data={data}
          onSelectAction={onSelectAction}
        />
      );
    case "find_results":
      return (
        <FindResultsVisualization
          data={data}
          onSelectAction={onSelectAction}
        />
      );
    case "timeline":
      return <TimelineVisualization data={data} />;
    default:
      return null;
  }
}

export default GinaDataVisualization;
