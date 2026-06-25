import { timeAgoLabel } from '../lib/signals.js';

/**
 * Shared pending queue list — rows in signal_campaigns with status pending.
 * Publish moves them to hero_signals and marks status published.
 */
export function CampaignSignalList({ signals, loading, busyId, onActivate, onEdit, onDelete, emptyLabel }) {
  if (loading) return <p className="muted">Loading queue…</p>;
  if (signals.length === 0) return <p className="muted">{emptyLabel}</p>;

  return (
    <div className="admin-list">
      {signals.map((s) => (
        <div className="admin-card admin-card--row" key={s.id}>
          <div className="admin-card__main">
            <p className="admin-card__title">
              {s.brand_name}
              {s.campaign_active ? <span className="pill" style={{ marginLeft: 8 }}>campaign active</span> : null}
            </p>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
              {s.launch_date ? `launch ${s.launch_date}` : 'no launch date'} · avg {s.average_interval_months ?? '—'}mo
              {' · '}created {timeAgoLabel(s.created_at)}
            </p>
          </div>
          <div className="admin-card__actions">
            <button className="btn btn-primary btn-sm" disabled={busyId === s.id} onClick={() => onActivate(s.id)}>
              {busyId === s.id ? 'Publishing…' : 'Publish to Signals'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(s)}>Edit</button>
            <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => onDelete(s.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
