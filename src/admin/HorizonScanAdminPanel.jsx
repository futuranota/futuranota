import { useEffect, useState } from 'react';
import { fetchHorizonScan } from '../lib/fetchHorizonScan.js';
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

const RANGE_OPTIONS = [
  { label: '30 días', days: 30 },
  { label: '60 días', days: 60 },
  { label: '90 días (3 meses)', days: 90 },
  { label: '120 días (4 meses)', days: 120 },
];

export function HorizonScanAdminPanel() {
  const [rangeDays, setRangeDays] = useState(90);
  const [industry, setIndustry] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [hits, setHits] = useState([]);
  const [savedBrands, setSavedBrands] = useState([]);

  const [fields, setFields] = useState(EMPTY_CAMPAIGN_SIGNAL_FIELDS);
  const [hasPreview, setHasPreview] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [signals, setSignals] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState(null);

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

  async function handleScan(e) {
    e.preventDefault();
    setScanError(null);
    setHits([]);
    setSavedBrands([]);
    setScanning(true);
    try {
      const { companies } = await fetchHorizonScan({ rangeDays, industry: industry.trim() });
      setHits(companies || []);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function loadHitIntoPreview(hit) {
    setEditId(null);
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
    const payload = campaignSignalFieldsToPayload(fields);

    setSaving(true);
    try {
      if (editId) {
        await updateCampaignSignal(editId, payload);
      } else {
        await createCampaignSignal(payload);
        setSavedBrands((prev) => [...prev, payload.brand_name]);
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
          <h2 className="h3">Horizon Scan</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Descubrimiento abierto: Groq busca compañías que <strong>no están en tu dashboard</strong>{' '}
            con campaña o lanzamiento esperado dentro del rango elegido. Revisás y aprobás cada
            hallazgo antes de que se guarde como señal.
          </p>
          {hits.length > 0 && hits.some((h) => h.source?.includes('serpapi')) ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              <span className="pill ai" style={{ marginRight: 6 }}>live search</span>
              Estos resultados vienen de búsqueda web real (Serper), calificados por Groq.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Nota: esto usa el conocimiento de Groq, no scraping en vivo de la web — agregá
              <code> SERPAPI_KEY</code> a tu entorno para activar búsqueda real (ver .env.example).
              Product Hunt / Apify quedan para una próxima pasada.
            </p>
          )}
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

      {!scanning && hits.length === 0 && !scanError ? (
        <p className="muted">Corré un scan para descubrir compañías fuera de tu dashboard.</p>
      ) : null}

      {hits.length > 0 ? (
        <div className="admin-list">
          {hits.map((hit) => {
            const saved = savedBrands.includes(hit.brandName);
            return (
              <div className="admin-card admin-card--row" key={hit.brandName}>
                <div className="admin-card__main">
                  <p className="admin-card__title">
                    {hit.brandName}
                    {hit.campaignActive ? <span className="pill" style={{ marginLeft: 8 }}>campaign active</span> : null}
                    {saved ? <span className="pill ai" style={{ marginLeft: 8 }}>saved</span> : null}
                  </p>
                  <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
                    {hit.category || 'sin categoría'}
                    {hit.launchDate ? ` · launch ${hit.launchDate}` : ''}
                    {' · '}{hit.overview}
                  </p>
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
          })}
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
        />
      ) : null}

      <h3 className="h4" style={{ margin: '24px 0 8px' }}>Señales guardadas</h3>
      <CampaignSignalList
        signals={signals}
        loading={loadingList}
        busyId={busyId}
        onActivate={handleActivate}
        onEdit={startEdit}
        onDelete={handleDelete}
        emptyLabel="Todavía no guardaste ninguna señal — aprobá un hallazgo arriba para verlo acá."
      />
    </div>
  );
}
