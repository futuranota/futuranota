import { DocStatusChip } from "../docs/FolderDocumentRow.jsx";
import { formatHierarchyPath } from "../../lib/gina/buildGinaVisualization.js";

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
      {doc.time ? <span className="gina-viz__doc-meta">{doc.time}</span> : null}
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
                        <span className="gina-viz__dept-time">
                          {doc.timeLabel || doc.time || "Flexible"}
                        </span>
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
                          time={doc.time}
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

function TimeCell({ time, passedSlot, delayHighlights }) {
  return (
    <span className={`gina-viz__sheet-time-wrap${passedSlot && delayHighlights ? " will-highlight" : ""}`}>
      {passedSlot && delayHighlights ? (
        <span className="gina-viz__time-overlay" aria-hidden />
      ) : null}
      <span className="gina-viz__sheet-time">{time || "—"}</span>
    </span>
  );
}

function RecoveryPreviewVisualization({ data }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const isMark = data.intent === "mark_past_due";
  return (
    <div className="gina-viz gina-viz--recovery-preview">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">
          {isMark ? "Marcar como vencidos" : "Reagendar en cadena"}
        </span>
        <h3 className="gina-viz__title">Vista previa</h3>
      </header>
      {docs.length === 0 ? (
        <p className="gina-viz__empty">No hay ítems para recuperar ahora.</p>
      ) : (
        <ul className="gina-viz__recovery-list">
          {docs.map((doc) => (
            <li key={doc.id || doc.title} className="gina-viz__recovery-row">
              <div className="gina-viz__recovery-title">{doc.title}</div>
              {isMark ? (
                <div className="gina-viz__recovery-status">
                  {doc.status ? <DocStatusChip status={doc.status} /> : (
                    <span className="gina-viz__recovery-null">Sin status</span>
                  )}
                  <span className="gina-viz__recovery-arrow" aria-hidden>→</span>
                  <DocStatusChip status="past_due" />
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

function DailyReportVisualization({ data }) {
  const rows = Array.isArray(data.occupiedHours) ? data.occupiedHours : [];
  const pending = Array.isArray(data.pendingBrief) ? data.pendingBrief : [];
  const folders = Array.isArray(data.folderProgress) ? data.folderProgress : [];
  const hasConflicts = Boolean(data.hasConflicts);
  return (
    <div className="gina-viz gina-viz--daily-report">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow gina-viz__eyebrow--gold">Occupied hours</span>
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

function ScheduleSheetVisualization({ data }) {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const delayHighlights = Boolean(data.highlightPassedSlots);
  return (
    <div className="gina-viz gina-viz--schedule-sheet">
      <header className="gina-viz__head">
        <span className="gina-viz__eyebrow">Horarios</span>
        <h3 className="gina-viz__title">{data.dateLabel || data.date || "Hoy"}</h3>
      </header>
      {groups.length === 0 ? (
        <p className="gina-viz__empty">Sin horarios en este alcance.</p>
      ) : (
        <div className="gina-viz__sheet">
          {groups.map((group) => (
            <section key={group.department} className="gina-viz__sheet-dept">
              <h4 className="gina-viz__sheet-dept-name">{group.department}</h4>
              {(group.folders || []).map((folder) => (
                <div key={`${group.department}-${folder.folder}`} className="gina-viz__sheet-folder">
                  <p className="gina-viz__sheet-folder-name">{folder.folder}</p>
                  <ul className="gina-viz__sheet-slots">
                    {(folder.documents || []).map((doc) => (
                      <li
                        key={doc.id || `${doc.title}-${doc.time}`}
                        className="gina-viz__sheet-slot"
                      >
                        <TimeCell
                          time={doc.time}
                          passedSlot={Boolean(doc.passedSlot)}
                          delayHighlights={delayHighlights}
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

function TableVisualization({ data }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const limit = data.listAll ? 80 : 12;
  const view = data.view || {};
  const fromCount = Boolean(data.fromCountDocuments);
  const columns = Array.isArray(data.columns) && data.columns.length
    ? data.columns
    : fromCount
      ? [
        "document",
        "department",
        "category",
        ...(view.showSchedule ? ["time"] : []),
        ...(view.showStatus ? ["status"] : []),
      ]
      : ["document", "path", "status", "time"];

  const colLabel = (key) => {
    switch (key) {
      case "document": return "Document";
      case "department": return "Departamento";
      case "category": return "Categoría";
      case "path": return "Ruta";
      case "status": return "Status";
      case "time": return "Time";
      default: return key;
    }
  };

  const renderCell = (doc, key) => {
    const h = doc.hierarchy || {};
    switch (key) {
      case "document":
        return doc.title || "—";
      case "department":
        return doc.department || h.department || "—";
      case "category":
        return doc.category || h.category || "—";
      case "path":
        return [h.department, h.category, h.folder].filter(Boolean).join(" / ") || "—";
      case "status":
        return doc.status ? <DocStatusChip status={doc.status} /> : "—";
      case "time":
        return doc.timeLabel || doc.time || "Flexible";
      default:
        return "—";
    }
  };

  return (
    <div className="gina-viz gina-viz--table">
      {data.title ? <h3 className="gina-viz__title">{data.title}</h3> : null}
      {data.empty || !docs.length ? (
        <p className="gina-viz__empty">
          {data.department
            ? `Cero documentos en ${data.department}.`
            : data.category
              ? `Cero documentos en ${data.category}.`
              : "Sin documentos en este alcance."}
        </p>
      ) : null}
      {docs.length ? (
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
            {docs.slice(0, limit).map((doc) => (
              <tr key={doc.id || doc.title}>
                {columns.map((key) => (
                  <td key={key}>{renderCell(doc, key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
            <span className="gina-viz__timeline-time">{doc.time || "—"}</span>
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
                onClick={() => onSelectAction?.(opt.text)}
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
              onClick={() => onSelectAction?.(`GinaRevealDocument:${doc.id}`)}
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
 * @param {{
 *   type?: string | null,
 *   data?: object | null,
 *   onSelectDepartment?: (departmentName: string) => void,
 *   onSelectAction?: (text: string) => void,
 * }} props
 */
export function GinaDataVisualization({ type, data, onSelectDepartment, onSelectAction }) {
  if (!type || type === "null" || !data) return null;
  const dept = data.department || "";

  switch (type) {
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
      return <ScheduleSheetVisualization data={data} />;
    case "recovery_preview":
      return <RecoveryPreviewVisualization data={data} />;
    case "today_scope":
      return <TodayScopeVisualization data={data} />;
    case "incomplete":
      return <IncompleteVisualization data={data} />;
    case "folder_summary":
      return <FolderSummaryVisualization data={data} />;
    case "conflicts":
      return <ConflictsVisualization data={data} />;
    case "table":
      return <TableVisualization data={data} />;
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
