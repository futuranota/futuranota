import { useEffect, useState } from 'react';
import {
  fetchAllScanSources,
  fetchScanSourcesWithFallback,
  createScanSource,
  updateScanSource,
  deleteScanSource,
} from '../lib/scanSources.js';

const EMPTY_FORM = {
  label: '',
  domain: '',
  pathPrefix: '',
  tier: 'primary',
  categories: '',
  enabled: true,
};

export function ScanSourcesAdminPanel() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const rows = await fetchAllScanSources();
      setSources(rows);
      setUsingFallback(false);
    } catch {
      const rows = await fetchScanSourcesWithFallback();
      setSources(rows);
      setUsingFallback(true);
      setErrorMessage(
        'Tabla intel_scan_sources no disponible — usando seed de content/admin/scan-sources.json. '
        + 'Ejecutá supabase_intel_scan_sources.sql para editar desde aquí.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(source) {
    setEditId(source.id);
    setForm({
      label: source.label,
      domain: source.domain,
      pathPrefix: source.pathPrefix || '',
      tier: source.tier || 'primary',
      categories: (source.categories || []).join(', '),
      enabled: source.enabled !== false,
    });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (usingFallback) return;
    setErrorMessage(null);
    const payload = {
      label: form.label,
      domain: form.domain,
      pathPrefix: form.pathPrefix,
      tier: form.tier,
      categories: form.categories.split(',').map((c) => c.trim()).filter(Boolean),
      enabled: form.enabled,
    };
    try {
      if (editId) {
        await updateScanSource(editId, payload);
      } else {
        await createScanSource(payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  async function handleDelete(id) {
    if (usingFallback) return;
    if (!window.confirm('Delete this scan source?')) return;
    setBusyId(id);
    try {
      await deleteScanSource(id);
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnabled(source) {
    if (usingFallback) return;
    try {
      await updateScanSource(source.id, { ...source, enabled: !source.enabled });
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel__head">
        <div>
          <h2 className="h3">Scan Sources</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Blogs y dominios curados para Horizon Scan. Serper busca con <code>site:domain</code> antes de la web abierta.
          </p>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Contexto Groq: <code>content/admin/detector-de-campanas.md</code>
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={startCreate} disabled={usingFallback}>
          + Add source
        </button>
      </div>

      {errorMessage ? (
        <div className="admin-error" style={{ marginBottom: 12 }}>{errorMessage}</div>
      ) : null}

      {showForm && !usingFallback ? (
        <form className="admin-card" onSubmit={handleSave}>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Label</span>
              <input className="auth-split-input" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} required />
            </label>
            <label className="admin-field">
              <span>Domain</span>
              <input className="auth-split-input" value={form.domain} placeholder="theverge.com" onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} required />
            </label>
            <label className="admin-field">
              <span>Path prefix (optional)</span>
              <input className="auth-split-input" value={form.pathPrefix} placeholder="/newsroom" onChange={(e) => setForm((p) => ({ ...p, pathPrefix: e.target.value }))} />
            </label>
            <label className="admin-field">
              <span>Tier</span>
              <select className="auth-split-input" value={form.tier} onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}>
                <option value="primary">primary</option>
                <option value="secondary">secondary</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Categories (comma-separated)</span>
              <input className="auth-split-input" value={form.categories} placeholder="sports, physical_tech" onChange={(e) => setForm((p) => ({ ...p, categories: e.target.value }))} />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="btn btn-primary btn-sm">{editId ? 'Save' : 'Create'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading sources…</p> : null}

      {!loading && sources.length === 0 ? (
        <p className="muted">No scan sources configured.</p>
      ) : null}

      {!loading && sources.length > 0 ? (
        <div className="admin-list">
          {sources.map((s) => (
            <div className="admin-card admin-card--row" key={s.id}>
              <div className="admin-card__main">
                <p className="admin-card__title">
                  {s.label}
                  <span className="pill" style={{ marginLeft: 8 }}>{s.tier}</span>
                  {!s.enabled ? <span className="pill" style={{ marginLeft: 8 }}>disabled</span> : null}
                </p>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                  {s.domain}{s.pathPrefix || ''} · {(s.categories || []).join(', ') || '—'}
                </p>
              </div>
              <div className="admin-card__actions">
                {!usingFallback ? (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleEnabled(s)}>
                      {s.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => handleDelete(s.id)}>Delete</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
