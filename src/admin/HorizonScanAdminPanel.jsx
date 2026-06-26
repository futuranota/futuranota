import { useEffect, useState } from 'react';
import { fetchHorizonScan } from '../lib/fetchHorizonScan.js';
import { fetchScanSourcesWithFallback } from '../lib/scanSources.js';
import {
  EMPTY_CAMPAIGN_SIGNAL_FIELDS,
  campaignSignalFieldsFromDetection,
  campaignSignalFieldsFromRow,
} from '../lib/campaignSignalFields.js';
import {
  fetchPendingCampaignSignals,
  deleteCampaignSignal,
  promoteCampaignSignal,
  saveAndPublishCampaignFields,
} from '../lib/campaignSignals.js';
import { CampaignSignalForm } from './CampaignSignalForm.jsx';
import { CampaignSignalList } from './CampaignSignalList.jsx';

const RANGE_OPTIONS = [
  { label: '30 días', days: 30 },
  { label: '60 días', days: 60 },
  { label: '90 días (3 meses)', days: 90 },
  { label: '120 días (4 meses)', days: 120 },
];

export function HorizonScanAdminPanel({ onPublishedToSignals }) {
  const [rangeDays, setRangeDays] = useState(90);
  const [industry, setIndustry] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [hits, setHits] = useState([]);
  const [discardedHits, setDiscardedHits] = useState([]);
  const [scanMeta, setScanMeta] = useState(null);
  const [scanSources, setScanSources] = useState([]);
  const [savedBrands, setSavedBrands] = useState([]);

  const [fields, setFields] = useState(EMPTY_CAMPAIGN_SIGNAL_FIELDS);
  const [hasPreview, setHasPreview] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [signals, setSignals] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [publishNotice, setPublishNotice] = useState(null);

  const load = async () => {
    setLoadingList(true);
    try {
      setSignals(await fetchPendingCampaignSignals());
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    load();
    fetchScanSourcesWithFallback().then(setScanSources).catch(() => setScanSources([]));
  }, []);

  async function handleScan(e) {
    e.preventDefault();
    setScanError(null);
    setScanMeta(null);
    setHits([]);
    setDiscardedHits([]);
    setSavedBrands([]);
    setScanning(true);
    try {
      const response = await fetchHorizonScan({
        rangeDays,
        industry: industry.trim(),
        sources: scanSources.filter((s) => s.enabled !== false),
      });
      setHits(response.companies || []);
      setDiscardedHits(response.discardedCompanies || []);
      setScanMeta(response.meta || null);
      if (response.meta?.error) {
        setScanError(response.meta.error);
      }
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function loadHitIntoPreview(hit) {
    setEditId(null);
    setErrorMessage(null);
    setFields(campaignSignalFieldsFromDetection(hit.brandName, hit));
    setHasPreview(true);
  }

  function startEdit(signal) {
    setEditId(signal.id);
    setFields(campaignSignalFieldsFromRow(signal));
    setHasPreview(true);
  }

  function cancelPreview() {
    setHasPreview(false);
    setEditId(null);
    setFields(EMPTY_CAMPAIGN_SIGNAL_FIELDS);
  }

  async function handleSave(e) {
    e.preventDefault();
    setErrorMessage(null);
    setPublishNotice(null);

    setSaving(true);
    try {
      const signal = await saveAndPublishCampaignFields(fields, editId);
      const brandName = signal.brand_name || fields.brandName.trim();
      setHits((prev) => prev.filter((h) => h.brandName !== brandName));
      setDiscardedHits((prev) => prev.filter((h) => h.brandName !== brandName));
      setSavedBrands((prev) => prev.filter((b) => b !== brandName));
      cancelPreview();
      await load();
      onPublishedToSignals?.(brandName);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id) {
    setBusyId(id);
    setPublishNotice(null);
    try {
      const signal = signals.find((s) => s.id === id);
      if (!signal) return;
      await promoteCampaignSignal(signal);
      setHits((prev) => prev.filter((h) => h.brandName !== signal.brand_name));
      setDiscardedHits((prev) => prev.filter((h) => h.brandName !== signal.brand_name));
      setSavedBrands((prev) => prev.filter((b) => b !== signal.brand_name));
      setPublishNotice(`${signal.brand_name} published to Signals — removed from scan queue.`);
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

  function renderHitRow(hit) {
    const saved = savedBrands.includes(hit.brandName);
    const modeLabel = hit.detectionMode === 'confirmed_campaign'
      ? 'verified'
      : hit.detectionMode === 'cadence_only'
        ? 'cadence'
        : null;
    const isLongWindow = hit.detectionMode === 'cadence_only' && hit.cadenceStatus === 'discard';

    return (
      <div className="admin-card admin-card--row" key={`${hit.brandName}-${hit.evidenceUrl || hit.source || hit.cadenceStatus}`}>
        <div className="admin-card__main">
          <p className="admin-card__title">
            {hit.brandName}
            {modeLabel === 'verified' ? <span className="pill ai" style={{ marginLeft: 8 }}>verified ≥80</span> : null}
            {modeLabel === 'cadence' && !isLongWindow ? (
              <span className="pill" style={{ marginLeft: 8 }}>
                {hit.cadenceStatus === 'watch'
                  ? `pendiente ~${hit.monthsRemaining}mo`
                  : 'cadence ≥70'}
              </span>
            ) : null}
            {isLongWindow ? (
              <span className="pill" style={{ marginLeft: 8 }}>ventana larga · ~{hit.monthsRemaining}mo</span>
            ) : null}
            {hit.campaignActive ? <span className="pill" style={{ marginLeft: 8 }}>campaign active</span> : null}
            {saved ? <span className="pill ai" style={{ marginLeft: 8 }}>saved</span> : null}
          </p>
          <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
            {hit.category || 'sin categoría'}
            {hit.announcementDate ? ` · announce ${hit.announcementDate}` : ''}
            {hit.launchDate ? ` · launch ${hit.launchDate}` : hit.estimatedLaunchDate ? ` · est. ${hit.estimatedLaunchDate}` : ''}
            {hit.confidence != null ? ` · conf ${hit.confidence}` : ''}
          </p>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{hit.overview || hit.cadenceMessage}</p>
          {hit.evidenceUrl ? (
            <p style={{ fontSize: 11, margin: '4px 0 0' }}>
              <a href={hit.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--hud)' }}>
                fuente
              </a>
            </p>
          ) : null}
        </div>
        <div className="admin-card__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={saved}
            onClick={() => loadHitIntoPreview(hit)}
          >
            {saved ? 'Reviewed' : 'Review'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel__head">
        <div>
          <h2 className="h3">Horizon Scan</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Descubrimiento verificado: Serper + Groq extraen solo de snippets reales.
            Campaña confirmada requiere confidence ≥ 80; cadencia solo ≥ 70.
            Sin <code>SERPAPI_KEY</code> no se devuelven compañías.
          </p>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Contexto Groq: Detector de Detonadores ({scanSources.filter((s) => s.enabled !== false).length} fuentes curadas activas).
          </p>
        </div>
      </div>

      <form className="admin-card" onSubmit={handleScan} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="admin-field">
          <span>Rango</span>
          <select
            className="auth-split-input"
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="admin-field" style={{ flex: 1 }}>
          <span>Industria / sector (opcional)</span>
          <input
            className="auth-split-input"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder='¿Qué quisieras escanear? Podés decir algo como "retail" o la industria en específico'
          />
        </label>

        <button type="submit" className="btn btn-primary btn-sm" disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan horizon'}
        </button>
      </form>

      {scanError ? <div className="admin-error">{scanError}</div> : null}
      {errorMessage ? <div className="admin-error">{errorMessage}</div> : null}
      {publishNotice ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8, color: 'var(--hud)' }}>{publishNotice}</p>
      ) : null}

      {!scanning && hits.length === 0 && discardedHits.length === 0 && !scanError ? (
        <p className="muted">Corré un scan para descubrir compañías fuera de tu dashboard.</p>
      ) : null}

      {!scanning && hits.length === 0 && !scanError && scanMeta?.message ? (
        <p className="muted">{scanMeta.message}</p>
      ) : null}

      {scanMeta?.accepted != null && scanMeta?.rawCandidates != null ? (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Verificados: {scanMeta.accepted} de {scanMeta.rawCandidates} candidatos Groq
          {scanMeta.cadenceDiscarded > 0
            ? ` · ventana larga descartada: ${scanMeta.cadenceDiscarded}`
            : ''}
          {scanMeta.rejected && Object.keys(scanMeta.rejected).length > 0
            ? ` · descartados: ${Object.entries(scanMeta.rejected).map(([k, v]) => `${k} (${v})`).join(', ')}`
            : ''}
        </p>
      ) : null}

      {discardedHits.length > 0 ? (
        <>
          <h3 className="h4" style={{ marginTop: 16, marginBottom: 8 }}>
            Ventana larga — podés descartar ({discardedHits.length})
          </h3>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
            Revisá con <strong>Review</strong> para ver fechas, overview y enviar a Signals si querés guardarlo igual.
          </p>
          <div className="admin-list">
            {discardedHits.map((hit) => renderHitRow(hit))}
          </div>
        </>
      ) : null}

      {hits.length > 0 ? (
        <div className="admin-list">
          {hits.map((hit) => renderHitRow(hit))}
        </div>
      ) : null}

      {hasPreview ? (
        <CampaignSignalForm
          fields={fields}
          onFieldsChange={setFields}
          onSubmit={handleSave}
          onCancel={cancelPreview}
          saving={saving}
          editId={editId}
          submitLabel={editId ? 'Guardar y enviar a Signals' : 'Guardar → Signals'}
          saveError={hasPreview ? errorMessage : null}
        />
      ) : null}

      <h3 className="h4" style={{ margin: '24px 0 8px' }}>Cola de revisión</h3>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
        Guardá un hallazgo para publicarlo en Signals (Hero + Librería). Al guardar te llevamos a la pestaña Signals.
      </p>
      <CampaignSignalList
        signals={signals}
        loading={loadingList}
        busyId={busyId}
        onActivate={handleActivate}
        onEdit={startEdit}
        onDelete={handleDelete}
        emptyLabel="No hay campañas en cola — aprobá un hallazgo arriba para revisarlo aquí."
      />
    </div>
  );
}
