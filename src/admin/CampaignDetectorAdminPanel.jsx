import { useEffect, useState } from 'react';
import { fetchCampaignDetection } from '../lib/fetchCampaignDetection.js';
import { fetchCompanyBrandCandidates } from '../lib/companyBrands.js';
import { isWithinFourMonthWindow, DEFAULT_RANGE_DAYS } from '../lib/campaignWindow.js';
import {
  EMPTY_CAMPAIGN_SIGNAL_FIELDS,
  campaignSignalFieldsFromDetection,
  campaignSignalFieldsFromRow,
  campaignSignalFieldsToPayload,
} from '../lib/campaignSignalFields.js';
import {
  fetchAllCampaignSignals,
  createCampaignSignal,
  updateCampaignSignal,
  deleteCampaignSignal,
  setActiveCampaignSignal,
} from '../lib/campaignSignals.js';
import { CampaignSignalForm } from './CampaignSignalForm.jsx';
import { CampaignSignalList } from './CampaignSignalList.jsx';
import { publishCampaignSignalToHero } from '../lib/publishToHero.js';

const SCAN_CONCURRENCY = 3;

const RANGE_OPTIONS = [
  { label: '30 días', days: 30 },
  { label: '60 días', days: 60 },
  { label: '90 días', days: 90 },
  { label: '120 días', days: 120 },
];

/** Runs `worker` over `items` with at most `limit` in flight at once. */
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

export function CampaignDetectorAdminPanel() {
  const [brandInput, setBrandInput] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);

  const [fields, setFields] = useState(EMPTY_CAMPAIGN_SIGNAL_FIELDS);
  const [hasPreview, setHasPreview] = useState(false);
  const [editId, setEditId] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [scanError, setScanError] = useState(null);
  const [scanResults, setScanResults] = useState([]);
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);

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

  function loadResultIntoPreview(brandName, result) {
    setEditId(null);
    setFields(campaignSignalFieldsFromDetection(brandName, result));
    setHasPreview(true);
  }

  async function handleDetect(e) {
    e.preventDefault();
    const brandName = brandInput.trim();
    if (!brandName) return;

    setDetecting(true);
    setDetectError(null);
    try {
      const result = await fetchCampaignDetection({ brandName });
      loadResultIntoPreview(brandName, result);
    } catch (err) {
      setDetectError(err.message);
    } finally {
      setDetecting(false);
    }
  }

  async function handleScanRecent() {
    setScanError(null);
    setScanResults([]);
    setScanning(true);
    try {
      const brands = await fetchCompanyBrandCandidates();
      setScanProgress({ done: 0, total: brands.length });

      const hits = [];
      await runWithConcurrency(brands, SCAN_CONCURRENCY, async (brandName) => {
        try {
          const result = await fetchCampaignDetection({ brandName });
          // Active campaigns always surface; otherwise only if recent within the chosen range.
          if (result.campaignActive || isWithinFourMonthWindow(result, rangeDays)) {
            hits.push({ brandName, ...result });
          }
        } catch {
          // Skip brands that fail detection — don't block the whole scan.
        } finally {
          setScanProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      });

      setScanResults(hits);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
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
    const payload = campaignSignalFieldsToPayload(fields);

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
      const signal = signals.find((s) => s.id === id);
      await setActiveCampaignSignal(id);
      if (signal) await publishCampaignSignalToHero(signal);
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
            Escaneá las marcas ya cargadas en la app y detectá cuáles tienen una campaña
            reciente, o metés una marca puntual abajo. Groq busca, revisás/editás
            el resultado y lo guardás como señal para Signal.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 className="h4" style={{ margin: 0 }}>Scan recent campaigns</h3>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
              Revisa todas las marcas de companies. Incluye cualquier lanzamiento futuro confirmado
              (sin tope, aunque sea el próximo año) y los lanzamientos de los últimos {rangeDays} días
              cuyo próximo ciclo todavía no venció.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="admin-field" style={{ margin: 0 }}>
              <select
                className="auth-split-input"
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                disabled={scanning}
              >
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.days} value={opt.days}>{opt.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary btn-sm" disabled={scanning} onClick={handleScanRecent}>
              {scanning ? `Scanning ${scanProgress.done}/${scanProgress.total}…` : 'Scan recent campaigns'}
            </button>
          </div>
        </div>

        {scanError ? <div className="admin-error" style={{ marginTop: 12 }}>{scanError}</div> : null}

        {!scanning && scanResults.length === 0 && scanProgress.total > 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No se encontraron campañas dentro de los últimos {rangeDays} días ni lanzamientos futuros entre {scanProgress.total} marcas.
          </p>
        ) : null}

        {scanResults.length > 0 ? (
          <div className="admin-list" style={{ marginTop: 12 }}>
            {scanResults.map((hit) => (
              <div className="admin-card admin-card--row" key={hit.brandName}>
                <div className="admin-card__main">
                  <p className="admin-card__title">
                    {hit.brandName}
                    {hit.campaignActive ? <span className="pill" style={{ marginLeft: 8 }}>campaign active</span> : null}
                  </p>
                  <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                    {hit.launchDate ? `launch ${hit.launchDate}` : `last launch ${hit.lastLaunchDate || '—'}`}
                    {' · '}{hit.overview}
                  </p>
                </div>
                <div className="admin-card__actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadResultIntoPreview(hit.brandName, hit)}
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <h3 className="h4" style={{ margin: '20px 0 8px' }}>O buscá una marca puntual</h3>
      <form className="admin-card" onSubmit={handleDetect} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label className="admin-field" style={{ flex: 1 }}>
          <span>Company</span>
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
        <CampaignSignalForm
          fields={fields}
          onFieldsChange={setFields}
          onSubmit={handleSave}
          onCancel={cancelPreview}
          saving={saving}
          editId={editId}
        />
      ) : null}

      <CampaignSignalList
        signals={signals}
        loading={loadingList}
        busyId={busyId}
        onActivate={handleActivate}
        onEdit={startEdit}
        onDelete={handleDelete}
        emptyLabel="No campaign signals yet — detect one above to save it."
      />
    </div>
  );
}
