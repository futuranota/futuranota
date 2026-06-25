import { formatWindowDays } from '../lib/docMetaBar.js';

/**
 * Shared "DOC" preview/edit form — mirrors the campaign doc fields from the
 * dashboard (Company, Category, Campaign active/inactive, Launch, Window, Overview).
 * Used by both CampaignDetectorAdminPanel and HorizonScanAdminPanel so a
 * detected/scanned hit is always reviewed in the same shape before saving.
 */
export function CampaignSignalForm({ fields, onFieldsChange, onSubmit, onCancel, saving, editId }) {
  const setField = (key, value) => onFieldsChange((p) => ({ ...p, [key]: value }));

  return (
    <form className="admin-card" onSubmit={onSubmit}>
      <h3 className="h4" style={{ marginBottom: 4 }}>DOC</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Mismos campos que un doc Campaign en el dashboard — Groq ya los llenó, solo corregís
        lo que haga falta antes de guardar.
      </p>

      <div className="admin-form-grid">
        <label className="admin-field">
          <span>Company</span>
          <input
            className="auth-split-input"
            value={fields.brandName}
            onChange={(e) => setField('brandName', e.target.value)}
            required
          />
        </label>

        <label className="admin-field">
          <span>Category</span>
          <input
            className="auth-split-input"
            value={fields.category}
            placeholder="e.g. product launch"
            onChange={(e) => setField('category', e.target.value)}
          />
        </label>

        <div className="admin-field">
          <span>Campaign</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${fields.campaignActive ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setField('campaignActive', true)}
            >
              Active
            </button>
            <button
              type="button"
              className={`btn btn-sm ${!fields.campaignActive ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onFieldsChange((p) => ({ ...p, campaignActive: false, launchDate: '' }))}
            >
              inactive
            </button>
          </div>
        </div>

        <label className="admin-field">
          <span>Launch</span>
          <input
            className="auth-split-input"
            type="date"
            value={fields.launchDate}
            disabled={!fields.campaignActive}
            onChange={(e) => setField('launchDate', e.target.value)}
          />
        </label>

        <div className="admin-field">
          <span>Window</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {fields.launchDate ? formatWindowDays(new Date(), fields.launchDate) : '—'}
          </span>
        </div>
      </div>

      <label className="admin-field" style={{ marginTop: 12 }}>
        <span>Overview</span>
        <textarea
          className="auth-split-input"
          rows={4}
          value={fields.overview}
          onChange={(e) => setField('overview', e.target.value)}
        />
      </label>

      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        avg cadence {fields.averageIntervalMonths || '—'}mo · last launch {fields.lastLaunchDate || '—'} · source {fields.source || '—'}
      </p>

      <div className="admin-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : editId ? 'Save changes' : 'Save signal'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
