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
            return (
              <button
                key={dept.name}
                type="button"
                role="listitem"
                className={
                  "gina-viz__dept-card"
                  + (isRec ? " is-recommended" : "")
                }
                onClick={() => onSelectDepartment?.(dept.name)}
              >
                <span className="gina-viz__dept-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 20V10l8-6 8 6v10H4Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <span className="gina-viz__dept-name">{dept.name}</span>
                <span className="gina-viz__dept-meta">
                  {dept.folders ?? 0} folder{(dept.folders ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  {dept.documents ?? 0} doc{(dept.documents ?? 0) === 1 ? "" : "s"}
                  {(dept.pastDue ?? 0) > 0 ? ` · ${dept.pastDue} vencido${dept.pastDue === 1 ? "" : "s"}` : ""}
                </span>
                <span className="gina-hierarchy-path gina-viz__dept-path">
                  departamento de {dept.name}
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
        <StatRow label="Docs hoy" value={data.documents ?? 0} />
      </div>
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
                          delayHighlights={Boolean(data.hasRecoveryOffer)}
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

function ScheduleSheetVisualization({ data }) {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const delayHighlights = Boolean(data.hasRecoveryOffer);
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
  return (
    <div className="gina-viz gina-viz--table">
      {data.title ? <h3 className="gina-viz__title">{data.title}</h3> : null}
      <div className="gina-viz__table-wrap">
        <table className="gina-viz__table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Ruta</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {docs.slice(0, 12).map((doc) => {
              const h = doc.hierarchy || {};
              return (
                <tr key={doc.id || doc.title}>
                  <td>{doc.title}</td>
                  <td>
                    <GinaHierarchyPath
                      department={h.department || doc.department}
                      category={h.category || doc.category}
                      folder={h.folder || doc.folder}
                    />
                  </td>
                  <td>{doc.status ? <DocStatusChip status={doc.status} /> : "—"}</td>
                  <td>{doc.time || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
    case "timeline":
      return <TimelineVisualization data={data} />;
    default:
      return null;
  }
}

export default GinaDataVisualization;
