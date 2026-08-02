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
    <li className="gina-viz__doc">
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
 * @param {{ type?: string | null, data?: object | null }} props
 */
export function GinaDataVisualization({ type, data }) {
  if (!type || type === "null" || !data) return null;
  switch (type) {
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
