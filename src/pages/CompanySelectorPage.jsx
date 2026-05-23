import { useState } from "react";
import { COMPANIES } from "../data.jsx";

export function CompanySelectorPage({ onSelect, onBack }) {
  const [picked, setPicked] = useState("voltway");
  const [filter, setFilter] = useState("");
  const list = COMPANIES.filter((c) =>
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
          <span className="pill cool"><i className="dot" />{COMPANIES.length} available</span>
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
            <button
              type="button"
              className="btn primary"
              onClick={() => onSelect(COMPANIES.find((c) => c.id === picked))}
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
