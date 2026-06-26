import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { fetchSignalCompanies } from "../lib/fetchSignalCompanies.js";
import { fetchCampaignStudy } from "../lib/fetchCampaignStudy.js";

export function CompanySelectorPage({ onSelect, onSkip, onBack }) {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [picked, setPicked] = useState(null);
  const [cachedBrands, setCachedBrands] = useState({});
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSignalCompanies()
      .then(async (list) => {
        if (cancelled) return;
        setCompanies(list);
        setPicked(list[0]?.id ?? null);
        const cacheMap = {};
        await Promise.all(list.slice(0, 12).map(async (c) => {
          try {
            const study = await fetchCampaignStudy({ brandName: c.name });
            if (study) cacheMap[c.name] = study;
          } catch {
            /* ignore per-brand cache errors */
          }
        }));
        if (!cancelled) setCachedBrands(cacheMap);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const list = companies.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase())
    || c.sector.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="selector">
      <div className="selector-shell glass">
        <div className="selector-header">
          <div>
            <div className="label">Step 01 · Select target</div>
            <h2>Which company are you tracking?</h2>
          </div>
          <span className="pill cool"><i className="dot" />{companies.length} available</span>
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <input
            placeholder="Search company or sector…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <span className="kbd">⌘K</span>
        </div>

        {loading ? <p className="muted">Loading detected campaigns…</p> : null}
        {loadError ? <div className="admin-error">{loadError}</div> : null}
        {!loading && !loadError && list.length === 0 ? (
          <p className="muted">No detected campaigns yet — activate one from /panel to see it here.</p>
        ) : null}

        <div className="selector-grid">
          {list.map((c) => (
            <div
              key={c.id}
              className={"selector-card" + (picked === c.id ? " selected" : "")}
              onClick={() => setPicked(c.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="co-name">{c.name}</span>
                <span className="pill" style={{
                  padding: "1px 6px", fontSize: 9.5,
                  color: cachedBrands[c.name] ? "var(--hud)" : "var(--dim)",
                  background: cachedBrands[c.name] ? "var(--hud-soft)" : "var(--panel-3)",
                  borderColor: cachedBrands[c.name] ? "color-mix(in oklab,var(--hud) 30%,transparent)" : "var(--glass-border)",
                }}>
                  {cachedBrands[c.name] ? "cached · 0 tok" : "library · 0 tok"}
                </span>
                <span className="pill" style={{
                  padding: "1px 6px", fontSize: 9.5,
                  color: c.status === "ACTIVE" ? "var(--hud)" : c.status === "STANDBY" ? "var(--warm)" : "var(--dim)",
                  background: c.status === "ACTIVE" ? "var(--hud-soft)" : c.status === "STANDBY" ? "var(--warm-soft)" : "var(--panel-3)",
                  borderColor: c.status === "ACTIVE" ? "color-mix(in oklab,var(--hud) 30%,transparent)"
                    : c.status === "STANDBY" ? "color-mix(in oklab,var(--warm) 30%,transparent)" : "var(--glass-border)",
                }}>
                  {c.status === "ACTIVE" && <i className="dot" />}
                  {c.status.toLowerCase()}
                </span>
              </div>
              <div className="co-sector">{c.sector}</div>
              <div className="co-stats">
                <span>Campaigns <b>{c.campaigns}</b></span>
                <span style={{ color: c.signal > 80 ? "var(--hud)" : c.signal > 50 ? "var(--warm)" : "var(--dim)" }}>
                  Signal <b>{c.signal}</b>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10.5, color: "var(--dim)" }}>
            <span style={{ color: "var(--warm)" }}>⚠</span> Target lock is session-scoped.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn ghost" onClick={onBack}>← Back</button>
            {onSkip ? (
              <button type="button" className="btn ghost" onClick={onSkip}>
                {t("library.skip")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn primary"
              onClick={() => onSelect({
                ...companies.find((c) => c.id === picked),
                campaignStudy: cachedBrands[companies.find((c) => c.id === picked)?.name] || null,
              })}
              disabled={!picked}
            >
              Lock target →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
