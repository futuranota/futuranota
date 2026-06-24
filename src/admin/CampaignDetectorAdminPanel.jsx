import { useEffect, useState } from 'react';
import { fetchCampaignDetection } from '../lib/fetchCampaignDetection.js';
import {
  fetchAllCampaignSignals,
  createCampaignSignal,
  updateCampaignSignal,
  deleteCampaignSignal,
  setActiveCampaignSignal,
} from '../lib/campaignSignals.js';
import { timeAgoLabel } from '../lib/signals.js';

const EMPTY_FIELDS = {
  brandName: '',
  campaignActive: false,
  launchDate: '',
  overview: '',
  averageIntervalMonths: '',
  lastLaunchDate: '',
  source: '',
};

export function CampaignDetectorAdminPanel() {
  const [brandInput, setBrandInput] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);

  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [hasPreview, setHasPreview] = useState(false);
  const [editId, setEditId] = useState(null);

  const [signals, setSignals] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const load = async () => {
    setLoadingList(true);
    try {
      setSignals(await fetchAllCampaignSignals());
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleDetect(e) {
    e.preventDefault();
    const brandName = brandInput.trim();
    if (!brandName) return;

    setDetecting(true);
    setDetectError(null);
    try {
      const result = await fetchCampaignDetection({ brandName });
      setEditId(null);
      setFields({
        brandName,
        campaignActive: Boolean(result.campaignActive),
        launchDate: result.launchDate || '',
        overview: result.overview || '',
        averageIntervalMonths: result.averageIntervalMonths ?? '',
        lastLaunchDate: result.lastLaunchDate || '',
        source: result.source || '',
      });
      setHasPreview(true);
    } catch (err) {
      setDetectError(err.message);
    } finally {
      setDetecting(false);
    }
  }

  function startEdit(signal) {
    setEditId(signal.id);
    setFields({
      brandName: signal.brand_name,
      campaignActive: signal.campaign_active,
      launchDate: signal.launch_date || '',
      overview: signal.overview || '',
      averageIntervalMonths: signal.average_interval_months ?? '',
      lastLaunchDate: signal.last_launch_date || '',
      source: signal.source || '',
    });
    setHasPreview(true);
  }

  function cancelPreview() {
    setHasPreview(false);
    setEditId(null);
    setFields(EMPTY_FIELDS);
  }

  async function handleSave(e) {
    e.preventDefault();
    setErrorMessage(null);
    const payload = {
      brand_name: fields.brandName.trim(),
      campaign_active: fields.campaignActive,
      launch_date: fields.campaignActive && fields.launchDate ? fields.launchDate : null,
      overview: fields.overview.trim(),
      average_interval_months: fields.averageIntervalMonths === '' ? null : Number(fields.averageIntervalMonths),
      last_launch_date: fields.lastLaunchDate || null,
      source: fields.source || null,
    };

    setSaving(true);
    try {
      if (editId) {
        await updateCampaignSignal(editId, payload);
      } else {
        await createCampaignSignal(payload);
      }
      cancelPreview();
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id) {
    setBusyId(id);
    try {
      await setActiveCampaignSignal(id);
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this campaign signal?')) return;
    setBusyId(id);
    try {
      await deleteCampaignSignal(id);
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel__head">
        <div>
          <h2 className="h3">Campaign Detector</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Metés una marca, Groq busca si tiene una campaña de lanzamiento activa ahora,
            revisás/editás el resultado y lo guardás como señal para Signal.
          </p>
        </div>
      </div>

      <form className="admin-card" onSubmit={handleDetect} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label className="admin-field" style={{ flex: 1 }}>
          <span>Brand / company name</span>
          <input
            className="auth-split-input"
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            placeholder="Apple"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={detecting}>
          {detecting ? 'Detecting…' : 'Detect campaign'}
        </button>
      </form>

      {detectError ? <div className="admin-error">{detectError}</div> : null}
      {errorMessage ? <div className="admin-error">{errorMessage}</div> : null}

      {hasPreview ? (
        <form className="admin-card" onSubmit={handleSave}>
          <h3 className="h4" style={{ marginBottom: 8 }}>Campaign fields</h3>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Brand name</span>
              <input
                className="auth-split-input"
                value={fields.brandName}
                onChange={(e) => setFields((p) => ({ ...p, brandName: e.target.value }))}
                required
              />
            </label>

            <label className="admin-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={fields.campaignActive}
                onChange={(e) => setFields((p) => ({ ...p, campaignActive: e.target.checked }))}
              />
              <span>Campaign active</span>
            </label>

            <label className="admin-field">
              <span>Launch date</span>
              <input
                className="auth-split-input"
                type="date"
                value={fields.launchDate}
                disabled={!fields.campaignActive}
                onChange={(e) => setFields((p) => ({ ...p, launchDate: e.target.value }))}
              />
            </label>

            <label className="admin-field">
              <span>Average interval (months)</span>
              <input
                className="auth-split-input"
                type="number"
                step="0.1"
                value={fields.averageIntervalMonths}
                onChange={(e) => setFields((p) => ({ ...p, averageIntervalMonths: e.target.value }))}
              />
            </label>

            <label className="admin-field">
              <span>Last launch date</span>
              <input
                className="auth-split-input"
                type="date"
                value={fields.lastLaunchDate}
                onChange={(e) => setFields((p) => ({ ...p, lastLaunchDate: e.target.value }))}
              />
            </label>

            <label className="admin-field">
              <span>Source</span>
              <input className="auth-split-input" value={fields.source} readOnly />
            </label>
          </div>

          <label className="admin-field" style={{ marginTop: 12 }}>
            <span>Overview</span>
            <textarea
              className="auth-split-input"
              rows={3}
              value={fields.overview}
              onChange={(e) => setFields((p) => ({ ...p, overview: e.target.value }))}
            />
          </label>

          <div className="admin-form-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Save signal'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelPreview}>Cancel</button>
          </div>
        </form>
      ) : null}

      {loadingList ? (
        <p className="muted">Loading signals…</p>
      ) : signals.length === 0 ? (
        <p className="muted">No campaign signals yet — detect one above to save it.</p>
      ) : (
        <div className="admin-list">
          {signals.map((s) => (
            <div className="admin-card admin-card--row" key={s.id}>
              <div className="admin-card__main">
                <p className="admin-card__title">
                  {s.brand_name}
                  {s.active ? <span className="pill ai" style={{ marginLeft: 8 }}>LIVE</span> : null}
                  {s.campaign_active ? <span className="pill" style={{ marginLeft: 8 }}>campaign active</span> : null}
                </p>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                  {s.launch_date ? `launch ${s.launch_date}` : 'no launch date'} · avg {s.average_interval_months ?? '—'}mo
                  {' · '}created {timeAgoLabel(s.created_at)}
                </p>
              </div>
              <div className="admin-card__actions">
                {!s.active ? (
                  <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => handleActivate(s.id)}>
                    Activate
                  </button>
                ) : null}
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}>Edit</button>
                <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => handleDelete(s.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
