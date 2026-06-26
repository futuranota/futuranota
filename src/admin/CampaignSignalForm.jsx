import { useState } from 'react';
import { formatWindowDays } from '../lib/docMetaBar.js';

function detectionBadge(mode, cadenceStatus) {
  if (mode === 'confirmed_campaign') return { label: 'Verified campaign', className: 'pill ai' };
  if (mode === 'cadence_only' && cadenceStatus === 'watch') {
    return { label: 'Pendiente · cadencia', className: 'pill ai' };
  }
  if (mode === 'cadence_only' && cadenceStatus === 'discard') {
    return { label: 'Ventana larga', className: 'pill' };
  }
  if (mode === 'cadence_only') return { label: 'Cadence only', className: 'pill' };
  if (cadenceStatus === 'no_data') return { label: 'Sin evidencia', className: 'pill' };
  return null;
}

/**
 * Shared campaign review form for Horizon Scan / Campaign Detector.
 */
export function CampaignSignalForm({
  fields,
  onFieldsChange,
  onSubmit,
  onCancel,
  saving,
  editId,
  submitLabel,
  saveError,
}) {
  const [localError, setLocalError] = useState('');
  const setField = (key, value) => onFieldsChange((p) => ({ ...p, [key]: value }));
  const badge = detectionBadge(fields.detectionMode, fields.cadenceStatus);
  const displayError = saveError || localError;

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!fields.brandName?.trim()) {
      setLocalError('Ingresá el nombre de la compañía.');
      return;
    }
    await onSubmit(e);
  }

  return (
    <form className="admin-card" onSubmit={handleSubmit} noValidate>
      <h3 className="h4" style={{ marginBottom: 4 }}>
        DOC
        {badge ? <span className={badge.className} style={{ marginLeft: 8 }}>{badge.label}</span> : null}
        {fields.confidence !== '' && fields.confidence != null ? (
          <span className="pill" style={{ marginLeft: 8 }}>confidence {fields.confidence}</span>
        ) : null}
      </h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Datos extraídos de fuentes web — revisá fechas y overview antes de guardar.
      </p>

      {displayError ? (
        <div className="admin-error" style={{ marginBottom: 12 }}>{displayError}</div>
      ) : null}

      {fields.cadenceMessage ? (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12, color: 'var(--hud)' }}>
          {fields.cadenceMessage}
          {fields.monthsRemaining !== '' && fields.monthsRemaining != null
            ? ` · ~${fields.monthsRemaining} meses`
            : ''}
          {fields.estimatedLaunchDate ? ` · est. ${fields.estimatedLaunchDate}` : ''}
        </p>
      ) : null}

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
            placeholder="sports · physical · physical_tech · innovation"
            onChange={(e) => setField('category', e.target.value)}
          />
        </label>

        <div className="admin-field">
          <span>Campaign</span>
          <div className="admin-segmented">
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
          <span>Announce</span>
          <input
            className="auth-split-input"
            type="date"
            value={fields.announcementDate}
            onChange={(e) => setField('announcementDate', e.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Launch</span>
          <input
            className="auth-split-input"
            type="date"
            value={fields.launchDate}
            disabled={!fields.campaignActive && fields.detectionMode !== 'cadence_only'}
            onChange={(e) => setField('launchDate', e.target.value)}
          />
        </label>

        <div className="admin-field">
          <span>Window</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {(fields.launchDate || fields.estimatedLaunchDate)
              ? formatWindowDays(new Date(), fields.launchDate || fields.estimatedLaunchDate)
              : '—'}
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

      {fields.evidenceUrl ? (
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          Fuente:{' '}
          <a href={fields.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--hud)' }}>
            {fields.evidenceUrl}
          </a>
          {fields.ticketTier ? ` · tier ${fields.ticketTier}` : ''}
          {' · '}avg {fields.averageIntervalMonths || '—'}mo · last {fields.lastLaunchDate || '—'}
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          avg cadence {fields.averageIntervalMonths || '—'}mo · last launch {fields.lastLaunchDate || '—'} · source {fields.source || '—'}
        </p>
      )}

      <div className="admin-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Publicando…' : (submitLabel || (editId ? 'Save changes' : 'Save signal'))}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
