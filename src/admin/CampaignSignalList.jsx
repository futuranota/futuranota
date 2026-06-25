import { timeAgoLabel } from '../lib/signals.js';

/**
 * Shared "saved signals" list — shows every row in signal_campaigns with
 * Activate/Edit/Delete. Used by both CampaignDetectorAdminPanel and
 * HorizonScanAdminPanel so saving from either place gives visible,
 * actionable feedback instead of silently inserting a row.
 */
export function CampaignSignalList({ signals, loading, busyId, onActivate, onEdit, onDelete, emptyLabel }) {
  if (loading) return <p className="muted">Loading signals…</p>;
  if (signals.length === 0) return <p className="muted">{emptyLabel}</p>;

  return (
    <div className="admin-list">
      {signals.map((s) => (
        <div className="admin-card admin-card--row" key={s.id}>
          <div className="admin-card__main">
            <p className="admin-card__title">
              {s.brand_name}
              {s.active ? <span className="pill ai" style={{ marginLeft: 8 }}>LIVE en el sitio</span> : null}
              {s.campaign_active ? <span className="pill" style={{ marginLeft: 8 }}>campaign active</span> : null}
            </p>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
              {s.launch_date ? `launch ${s.launch_date}` : 'no launch date'} · avg {s.average_interval_months ?? '—'}mo
              {' · '}created {timeAgoLabel(s.created_at)}
            </p>
          </div>
          <div className="admin-card__actions">
            {!s.active ? (
              <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => onActivate(s.id)}>
                Activate
              </button>
            ) : null}
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(s)}>Edit</button>
            <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => onDelete(s.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
