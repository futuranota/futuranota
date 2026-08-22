import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../stores/authStore.js';
import { timeAgoLabel } from '../lib/signals.js';
import {
  approveStepShare,
  fetchRequestedStepShares,
  fetchStepShareAdminById,
  rejectStepShare,
} from '../lib/stepPlaybookShare.js';
import { scanStepShareSnapshot } from '../lib/scanStepShareReview.js';
import { StepSequenceBlockView } from '../components/docs/blocks/StepSequenceBlockView.jsx';

export function StepPlaybookSharesAdminPanel() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** @type {Record<string, import('../lib/scanStepShareReview.js').ScanReport>} */
  const [scans, setScans] = useState({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRequestedStepShares());
    } catch (err) {
      setError(String(err?.message || err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleApprove(id) {
    if (!user || busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await approveStepShare(id, user);
      if (preview?.id === id) setPreview(null);
      await reload();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    if (!user || busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await rejectStepShare(id, user);
      if (preview?.id === id) setPreview(null);
      await reload();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleScan(row) {
    const steps = Array.isArray(row.steps) && row.steps.length
      ? row.steps
      : (preview?.id === row.id ? (preview.steps || []) : []);
    const finalReport = scanStepShareSnapshot({ title: row.title, steps });
    setScans((prev) => ({ ...prev, [row.id]: finalReport }));
    return finalReport;
  }

  async function handleOpenAndScan(row) {
    setPreviewLoading(true);
    setError(null);
    try {
      const full = await fetchStepShareAdminById(row.id);
      const target = full || row;
      setPreview(target);
      setScans((prev) => ({
        ...prev,
        [row.id]: scanStepShareSnapshot({ title: target.title, steps: target.steps || [] }),
      }));
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="admin-panel">
      <header className="admin-panel__head" style={{ marginBottom: 16 }}>
        <h1 className="admin-card__title" style={{ fontSize: 18, margin: 0 }}>
          Step Shares
        </h1>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
          Solo visible para la cuenta admin. Abrí el snapshot, corré una revisión rápida (sin Accept),
          y después Accept / Reject.
        </p>
      </header>

      {error ? (
        <p className="muted" style={{ color: 'var(--warm)', marginBottom: 12 }}>{error}</p>
      ) : null}

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void reload(); }} disabled={loading}>
          Refresh
        </button>
        <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
          {loading ? '…' : `${rows.length} pending`}
        </span>
      </div>

      {loading ? (
        <p className="muted">Loading queue…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No pending share requests.</p>
      ) : (
        <div className="admin-list">
          {rows.map((row) => {
            const scan = scans[row.id];
            return (
              <div className="admin-card admin-card--row" key={row.id} style={{ flexWrap: 'wrap' }}>
                <div className="admin-card__main" style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <p className="admin-card__title">{row.title}</p>
                  <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                    {row.author_name}
                    {' · '}
                    requested {timeAgoLabel(row.requested_at || row.created_at)}
                    {scan ? (
                      <>
                        {' · '}
                        <span style={{
                          color: scan.level === 'flag' ? 'var(--warm)' : scan.level === 'warn' ? '#EAA65D' : 'var(--hud)',
                          fontWeight: 600,
                        }}
                        >
                          scan: {scan.level}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="muted" style={{ fontSize: 11, margin: '4px 0 0', wordBreak: 'break-all' }}>
                    {row.url}
                  </p>
                  {scan ? (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: 'rgba(232,220,200,0.72)' }}>
                      <li style={{ fontWeight: 600, listStyle: 'none', marginLeft: -16, marginBottom: 4 }}>
                        {scan.summary}
                      </li>
                      {scan.findings.map((f) => (
                        <li key={f.id}>[{f.level}] {f.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="admin-card__actions" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={previewLoading || busyId === row.id}
                    onClick={() => { void handleOpenAndScan(row); }}
                  >
                    {previewLoading ? '…' : 'Open'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === row.id}
                    onClick={() => { handleScan(row); }}
                  >
                    Scan
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === row.id}
                    onClick={() => { void handleApprove(row.id); }}
                  >
                    {busyId === row.id ? '…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === row.id}
                    onClick={() => { void handleReject(row.id); }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview ? createPortal(
        <div
          className="step-share-admin-preview"
          role="dialog"
          aria-modal="true"
          aria-label={preview.title}
        >
          <button
            type="button"
            className="step-share-admin-preview__backdrop"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          />
          <div className="step-share-admin-preview__shell">
            <div className="step-share-admin-preview__toolbar">
              <div>
                <p className="step-share-admin-preview__eyebrow">Admin preview · same size as public link</p>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                  {preview.status} · {preview.url}
                </p>
              </div>
              <div className="step-share-admin-preview__actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setScans((prev) => ({
                      ...prev,
                      [preview.id]: scanStepShareSnapshot({
                        title: preview.title,
                        steps: preview.steps || [],
                      }),
                    }));
                  }}
                >
                  Scan
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyId === preview.id}
                  onClick={() => { void handleApprove(preview.id); }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === preview.id}
                  onClick={() => { void handleReject(preview.id); }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPreview(null)}
                >
                  Close
                </button>
              </div>
            </div>

            {scans[preview.id] ? (
              <div className={`step-share-admin-preview__scan step-share-admin-preview__scan--${scans[preview.id].level}`}>
                <strong>{scans[preview.id].summary}</strong>
                <ul>
                  {scans[preview.id].findings.map((f) => (
                    <li key={f.id}>[{f.level}] {f.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="step-share-page step-share-admin-preview__page">
              <header className="step-share-page__chrome">
                <span className="step-share-admin-preview__brand">Futura Nota</span>
                <div className="step-share-page__author" aria-label={preview.author_name}>
                  <span className="step-share-page__avatar" aria-hidden>
                    {preview.author_initial || "?"}
                  </span>
                  <div className="step-share-page__author-meta">
                    <span className="step-share-page__author-name">{preview.author_name}</span>
                    <span className="step-share-page__author-kind">Step by step</span>
                  </div>
                </div>
              </header>

              <main className="step-share-page__main scroll-match-bg">
                <StepSequenceBlockView
                  key={`admin-preview-${preview.id}`}
                  blockId={`admin-preview-${preview.id}`}
                  title={preview.title}
                  steps={preview.steps || []}
                  saved
                />
              </main>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
