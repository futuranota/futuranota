import { useEffect, useState } from 'react';
import {
  fetchAllSignals,
  createSignal,
  updateSignal,
  deleteSignal,
  setActiveSignal,
  timeAgoLabel,
} from '../lib/signals.js';

const EMPTY_FORM = {
  detected_label: 'CAMPAIGN DETECTED',
  campaign_name: '',
  window_label: 'SHIP WINDOW',
  window_progress: 50,
  opens_label: 'opens now',
  closes_label: 'closes in 9d',
  nodes: [{ hash: '', text: '' }],
};

export function SignalsAdminPanel() {
  const [signals, setSignals] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState(null);

  const load = async () => {
    setLoadingList(true);
    try {
      setSignals(await fetchAllSignals());
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoadingList(false);
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

  function startEdit(signal) {
    setEditId(signal.id);
    setForm({
      detected_label: signal.detected_label,
      campaign_name: signal.campaign_name,
      window_label: signal.window_label,
      window_progress: signal.window_progress,
      opens_label: signal.opens_label,
      closes_label: signal.closes_label,
      nodes: signal.nodes?.length ? signal.nodes : [{ hash: '', text: '' }],
    });
    setShowForm(true);
  }

  function updateNode(index, key, value) {
    setForm((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n, i) => (i === index ? { ...n, [key]: value } : n)),
    }));
  }

  function addNode() {
    if (form.nodes.length >= 4) return;
    setForm((prev) => ({ ...prev, nodes: [...prev.nodes, { hash: '', text: '' }] }));
  }

  function removeNode(index) {
    setForm((prev) => ({ ...prev, nodes: prev.nodes.filter((_, i) => i !== index) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setErrorMessage(null);
    const payload = {
      ...form,
      window_progress: Number(form.window_progress),
      nodes: form.nodes.filter((n) => n.hash.trim() && n.text.trim()),
    };
    try {
      if (editId) {
        await updateSignal(editId, payload);
      } else {
        await createSignal(payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  async function handleActivate(id) {
    setBusyId(id);
    try {
      await setActiveSignal(id);
      await load();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this signal?')) return;
    setBusyId(id);
    try {
      await deleteSignal(id);
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
          <h2 className="h3">Hero signals</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            The active signal is the "CAMPAIGN DETECTED" card shown on the landing Hero.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={startCreate}>+ New signal</button>
      </div>

      {errorMessage ? (
        <div className="admin-error">{errorMessage}</div>
      ) : null}

      {showForm ? (
        <form className="admin-card" onSubmit={handleSave}>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Campaign name</span>
              <input
                className="auth-split-input"
                value={form.campaign_name}
                onChange={(e) => setForm((p) => ({ ...p, campaign_name: e.target.value }))}
                placeholder="NovaBrew · single-origin launch"
                required
              />
            </label>
            <label className="admin-field">
              <span>Detected label</span>
              <input
                className="auth-split-input"
                value={form.detected_label}
                onChange={(e) => setForm((p) => ({ ...p, detected_label: e.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span>Window label</span>
              <input
                className="auth-split-input"
                value={form.window_label}
                onChange={(e) => setForm((p) => ({ ...p, window_label: e.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span>Window progress (0–100)</span>
              <input
                className="auth-split-input"
                type="number"
                min="0"
                max="100"
                value={form.window_progress}
                onChange={(e) => setForm((p) => ({ ...p, window_progress: e.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span>Opens label</span>
              <input
                className="auth-split-input"
                value={form.opens_label}
                onChange={(e) => setForm((p) => ({ ...p, opens_label: e.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span>Closes label</span>
              <input
                className="auth-split-input"
                value={form.closes_label}
                onChange={(e) => setForm((p) => ({ ...p, closes_label: e.target.value }))}
              />
            </label>
          </div>

          <div className="admin-nodes">
            <span className="admin-field__label">Nodes (hash + text, up to 4)</span>
            {form.nodes.map((node, i) => (
              <div className="admin-node-row" key={i}>
                <input
                  className="auth-split-input"
                  placeholder="hash"
                  value={node.hash}
                  onChange={(e) => updateNode(i, 'hash', e.target.value)}
                />
                <input
                  className="auth-split-input"
                  placeholder="text"
                  value={node.text}
                  onChange={(e) => updateNode(i, 'text', e.target.value)}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeNode(i)}>✕</button>
              </div>
            ))}
            {form.nodes.length < 4 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={addNode}>+ Add node</button>
            ) : null}
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="btn btn-primary btn-sm">{editId ? 'Save changes' : 'Create signal'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {loadingList ? (
        <p className="muted">Loading signals…</p>
      ) : signals.length === 0 ? (
        <p className="muted">No signals yet — create one to show it on the landing Hero.</p>
      ) : (
        <div className="admin-list">
          {signals.map((s) => (
            <div className="admin-card admin-card--row" key={s.id}>
              <div className="admin-card__main">
                <p className="admin-card__title">
                  {s.campaign_name}
                  {s.active ? <span className="pill ai" style={{ marginLeft: 8 }}>LIVE</span> : null}
                </p>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                  {s.window_label} · {s.window_progress}% · {s.opens_label} → {s.closes_label} · created {timeAgoLabel(s.created_at)}
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
