import { useEffect, useState } from 'react';
import {
  fetchHorizonKits,
  saveHorizonKits,
  uploadHorizonKitAsset,
} from '../lib/horizonKitsAdmin.js';
import { HorizonKitAssetSlot } from './HorizonKitAssetSlot.jsx';

const EMPTY_KIT = {
  id: '',
  tag: '',
  title: '',
  desc: '',
  org: [],
  free: true,
  price: 'Free',
  kitType: 'instructions',
  includes: [],
  rating: '',
  reviews: '',
  downloads: '',
  trend: false,
  hot: false,
  downloadUrl: '',
  previewUrl: '',
  blogSlug: '',
  image: '',
};

function listToText(list) {
  return Array.isArray(list) ? list.join('\n') : '';
}

function textToList(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function HorizonKitsAdminPanel() {
  const [header, setHeader] = useState({
    eyebrow: 'HORIZON',
    title: '',
    lead: '',
    linkLabel: 'Browse all kits',
  });
  const [kits, setKits] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(EMPTY_KIT);
  const [includesText, setIncludesText] = useState('');
  const [orgText, setOrgText] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchHorizonKits();
      setHeader(data.header || header);
      setKits(data.opportunities || []);
      setBlogs(data.blogs || []);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fetch
  }, []);

  function startCreate() {
    setEditIndex(null);
    setForm({ ...EMPTY_KIT });
    setIncludesText('.futura import');
    setOrgText('');
    setShowForm(true);
    setNotice(null);
  }

  function startEdit(index) {
    const kit = kits[index];
    setEditIndex(index);
    setForm({
      ...EMPTY_KIT,
      ...kit,
      reviews: kit.reviews == null ? '' : String(kit.reviews),
    });
    setIncludesText(listToText(kit.includes));
    setOrgText(listToText(kit.org));
    setShowForm(true);
    setNotice(null);
  }

  function kitPayloadFromForm() {
    const reviewsRaw = String(form.reviews || '').trim();
    return {
      ...form,
      title: form.title.trim(),
      includes: textToList(includesText),
      org: textToList(orgText),
      reviews: reviewsRaw === '' ? null : Number(reviewsRaw),
      free: Boolean(form.free),
      price: form.free ? (form.price.trim() || 'Free') : form.price.trim(),
    };
  }

  async function persist(nextKits, nextHeader = header) {
    setSaving(true);
    setErrorMessage(null);
    try {
      const data = await saveHorizonKits({
        header: nextHeader,
        opportunities: nextKits,
      });
      setHeader(data.header);
      setKits(data.opportunities || []);
      setBlogs(data.blogs || []);
      setNotice('Guardado en content/marketing/horizon.json — commiteá para producción.');
      return true;
    } catch (err) {
      setErrorMessage(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const payload = kitPayloadFromForm();
    if (!payload.title) return;
    const next = [...kits];
    if (editIndex == null) next.push(payload);
    else next[editIndex] = payload;
    const ok = await persist(next);
    if (ok) setShowForm(false);
  }

  async function handleDelete(index) {
    const kit = kits[index];
    if (!window.confirm(`¿Borrar “${kit.title}”?`)) return;
    const next = kits.filter((_, i) => i !== index);
    await persist(next);
    if (editIndex === index) setShowForm(false);
  }

  async function moveKit(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= kits.length) return;
    const next = [...kits];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    await persist(next);
  }

  async function handleFile(kind, file) {
    if (!file) return;
    setUploading(kind);
    setErrorMessage(null);
    try {
      const { url } = await uploadHorizonKitAsset(file, kind);
      if (kind === 'image') setForm((p) => ({ ...p, image: url }));
      else setForm((p) => ({ ...p, downloadUrl: url }));
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleHeaderSave(e) {
    e.preventDefault();
    await persist(kits, header);
  }

  const uploadBusy = Boolean(uploading);

  return (
    <div className="admin-panel">
      <div className="admin-panel__head">
        <div>
          <h2 className="h3">Horizon kits</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Marketplace de /horizon: covers, copy, ZIP y blog Tina. Distinto de Horizon Scan.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={startCreate}>
          + Add kit
        </button>
      </div>

      {errorMessage ? <div className="admin-error">{errorMessage}</div> : null}
      {notice ? (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12, color: 'var(--hud)' }}>
          {notice}
        </p>
      ) : null}

      <details className="admin-details admin-card">
        <summary>Page header (/horizon)</summary>
        <form onSubmit={handleHeaderSave} style={{ marginTop: 8 }}>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Eyebrow</span>
              <input
                className="auth-split-input"
                value={header.eyebrow}
                onChange={(e) => setHeader((p) => ({ ...p, eyebrow: e.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span>Link label</span>
              <input
                className="auth-split-input"
                value={header.linkLabel}
                onChange={(e) => setHeader((p) => ({ ...p, linkLabel: e.target.value }))}
              />
            </label>
            <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
              <span>Title</span>
              <input
                className="auth-split-input"
                value={header.title}
                onChange={(e) => setHeader((p) => ({ ...p, title: e.target.value }))}
              />
            </label>
            <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
              <span>Lead</span>
              <textarea
                className="auth-split-input"
                rows={3}
                value={header.lead}
                onChange={(e) => setHeader((p) => ({ ...p, lead: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="btn btn-ghost btn-sm" disabled={saving}>
              Save header
            </button>
          </div>
        </form>
      </details>

      {showForm ? (
        <form className="admin-card" onSubmit={handleSave}>
          <p className="admin-card__title" style={{ marginBottom: 16 }}>
            {editIndex == null ? 'New kit' : 'Edit kit'}
          </p>

          <section className="admin-form-section">
            <p className="admin-form-section__title">Copy</p>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Title</span>
                <input
                  className="auth-split-input"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Tag</span>
                <input
                  className="auth-split-input"
                  value={form.tag}
                  placeholder="CERAMICS"
                  onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value }))}
                />
              </label>
              <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
                <span>Description</span>
                <textarea
                  className="auth-split-input"
                  rows={3}
                  value={form.desc}
                  onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <p className="admin-form-section__title">Media</p>
            <div className="admin-form-section__grid admin-form-section__grid--media">
              <HorizonKitAssetSlot
                kind="image"
                value={form.image}
                uploading={uploading === 'image'}
                disabled={uploadBusy && uploading !== 'image'}
                onFile={(file) => handleFile('image', file)}
                onClear={() => setForm((p) => ({ ...p, image: '' }))}
              />
              <HorizonKitAssetSlot
                kind="zip"
                value={form.downloadUrl}
                uploading={uploading === 'zip'}
                disabled={uploadBusy && uploading !== 'zip'}
                onFile={(file) => handleFile('zip', file)}
                onClear={() => setForm((p) => ({ ...p, downloadUrl: '' }))}
              />
            </div>
          </section>

          <section className="admin-form-section">
            <p className="admin-form-section__title">Links</p>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Preview URL</span>
                <input
                  className="auth-split-input"
                  value={form.previewUrl}
                  placeholder="https://… (optional)"
                  onChange={(e) => setForm((p) => ({ ...p, previewUrl: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <span>Blog (Tina)</span>
                <select
                  className="auth-split-input"
                  value={form.blogSlug}
                  onChange={(e) => setForm((p) => ({ ...p, blogSlug: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {blogs.map((blog) => (
                    <option key={blog.slug} value={blog.slug}>
                      {blog.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <p className="admin-form-section__title">Pricing</p>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Kit type</span>
                <select
                  className="auth-split-input"
                  value={form.kitType}
                  onChange={(e) => setForm((p) => ({ ...p, kitType: e.target.value }))}
                >
                  <option value="instructions">Instructions only</option>
                  <option value="website-plugin">Website + plugin</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Price label</span>
                <input
                  className="auth-split-input"
                  value={form.price}
                  disabled={form.free}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                />
              </label>
              <div className="admin-form-section__badges" style={{ gridColumn: '1 / -1' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.free}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      free: e.target.checked,
                      price: e.target.checked ? 'Free' : p.price === 'Free' ? '' : p.price,
                    }))}
                  />
                  Free kit
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.trend}
                    onChange={(e) => setForm((p) => ({ ...p, trend: e.target.checked }))}
                  />
                  Trending
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.hot}
                    onChange={(e) => setForm((p) => ({ ...p, hot: e.target.checked }))}
                  />
                  Best seller
                </label>
              </div>
            </div>
          </section>

          <details className="admin-details">
            <summary>Advanced</summary>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              <label className="admin-field">
                <span>Includes (one per line)</span>
                <textarea
                  className="auth-split-input"
                  rows={3}
                  value={includesText}
                  onChange={(e) => setIncludesText(e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Org lines (optional)</span>
                <textarea
                  className="auth-split-input"
                  rows={3}
                  value={orgText}
                  onChange={(e) => setOrgText(e.target.value)}
                />
              </label>
            </div>
          </details>

          <div className="admin-form-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || uploadBusy}>
              {saving ? 'Saving…' : editIndex == null ? 'Create kit' : 'Save kit'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading kits…</p> : null}

      <div className="admin-list">
        {kits.map((kit, index) => (
          <article key={kit.id || kit.title} className="admin-card admin-card--row">
            {kit.image ? (
              <img
                src={kit.image}
                alt=""
                className="admin-kit-thumb"
              />
            ) : (
              <div className="admin-kit-thumb--empty" aria-hidden />
            )}
            <div className="admin-card__main">
              <p className="admin-card__title">{kit.title}</p>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {kit.tag} · {kit.free ? 'Free' : kit.price} · {kit.blogSlug || 'no blog'}
              </p>
            </div>
            <div className="admin-card__actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveKit(index, -1)} disabled={index === 0 || saving}>
                ↑
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveKit(index, 1)} disabled={index === kits.length - 1 || saving}>
                ↓
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(index)}>
                Edit
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(index)} disabled={saving}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
