import { useState, useEffect } from 'react';
import { URL_EXTRACT_SAMPLE } from './data.jsx';

/* dashboard.jsx — TopBar, MetaBar, ScanOverlay, UrlModal, Toast */

function TopBar({ company, onBack, status, signal, scanState, onScan, onScanBlogs, onPasteUrl, onAltSeed }) {
  return (
    <div className="topbar">
      <button className="btn icon ghost" onClick={onBack} title="Back">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
          <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className="brand">
        <div className="brand-mark" />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span className="brand-name">Futura Nota</span>
          <span className="brand-sub">v0.6 · terminal</span>
        </div>
      </div>

      <div className="target-block">
        <span style={{ color: "var(--dim)", fontSize: 11 }}>Target</span>
        <span className="target-name">{company.name}</span>
        <span className="pill ok pulse"><i className="dot" />{status}</span>
        <span className="pill cool"><i className="dot" />Signal {signal}</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn sm primary" onClick={onScan} disabled={scanState === "scanning"}>
          {scanState === "scanning" ? "Scanning…" : "▸ Scan campaigns"}
        </button>
        <button className="btn sm" onClick={onScanBlogs} disabled={scanState === "scanning-blogs"}>
          {scanState === "scanning-blogs" ? "Scanning blogs…" : "Scan blogs"}
        </button>
        <button className="btn sm" onClick={onPasteUrl}>Paste URL</button>
        {onAltSeed && (
          <button className="btn sm ghost" onClick={onAltSeed} title="Seed a second campaign blueprint to demo stacked timelines">
            + Alt blueprint
          </button>
        )}
      </div>
    </div>
  );
}

function MetaBar({ metadata }) {
  const cells = [
    { k: "Brand",     v: metadata.brand },
    { k: "Version",   v: metadata.version },
    { k: "Campaign",  v: metadata.campaign,  source: metadata.campaignSource },
    { k: "Category",  v: metadata.category },
    { k: "Launch",    v: metadata.launch,    accent: true },
    { k: "Window",    v: metadata.window,    warm: true },
  ];
  const allEmpty = cells.every((c) => !c.v);
  return (
    <div className={"metabar" + (allEmpty ? " empty" : "")}>
      {cells.map((c, i) => (
        <div className="meta-cell" key={i}>
          <div className="meta-cell-k">{c.k}</div>
          <div className={"meta-cell-v" + (c.accent ? " accent" : "") + (c.warm ? " warm" : "")}>
            {c.v ? (
              <span className={c.accent ? "accent" : c.warm ? "warm" : ""}>{c.v}</span>
            ) : "—"}
          </div>
          {c.source && <div className="meta-source">{c.source}</div>}
        </div>
      ))}
    </div>
  );
}

function ScanOverlay({ logs, kind = "campaigns" }) {
  return (
    <div className="scanning">
      <div className="scanning-card">
        <div className="scanning-title">
          <span className="dot-pulse" />
          {kind === "campaigns" ? "Scanning Voltway campaigns…" : "Scanning intel sources…"}
        </div>
        <div className="scanning-log">
          {logs.map((line, i) => (
            <div key={i} className="step">
              <span className="idx">{String(i).padStart(2, "0")}</span>
              <span className={"txt " + (line.cls || "")}>{line.text}</span>
            </div>
          ))}
        </div>
        <div className="scanning-bar"><i /></div>
      </div>
    </div>
  );
}

function UrlModal({ onAccept, onClose }) {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState("input");
  const [result, setResult] = useState(null);

  const submit = () => {
    if (!url.trim()) return;
    setStage("loading");
    setTimeout(() => {
      setResult(URL_EXTRACT_SAMPLE);
      setStage("result");
    }, 1300);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>Extract URL</h3>
          <button className="btn xs ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {stage === "input" && (
            <>
              <p style={{ margin: "0 0 12px", color: "var(--text-2)", fontSize: 12.5, lineHeight: 1.5 }}>
                Paste any URL. We'll extract typed entities using AI · costs 1 token.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <div className="field" style={{ flex: 1 }}>
                  <input autoFocus placeholder="https://…" value={url}
                         onChange={(e) => setUrl(e.target.value)}
                         onKeyDown={(e) => e.key === "Enter" && submit()} />
                </div>
                <button className="btn primary" onClick={submit}>Extract</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--dim)" }}>
                Try: <span style={{ color: "var(--cool)", cursor: "pointer" }}
                              onClick={() => setUrl(URL_EXTRACT_SAMPLE.url)}>
                  {URL_EXTRACT_SAMPLE.url}
                </span>
              </div>
            </>
          )}
          {stage === "loading" && (
            <div style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                Extracting · 1 token
              </div>
              <div className="scanning-bar"><i /></div>
            </div>
          )}
          {stage === "result" && result && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 2 }}>{result.title}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cool)", marginBottom: 12 }}>
                ▸ {result.source} · {result.date}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 12 }}>{result.summary}</div>
              <div className="label" style={{ marginBottom: 6 }}>Extracted entities ({result.entities.length})</div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {result.entities.map((e, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--hairline)", fontSize: 12 }}>
                    <span><span className="note-type-tag" data-t={e.dataType} style={{ marginRight: 8 }}>{e.dataType}</span><b>{e.title}</b></span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--text-2)" }}>{typeof e.content === "object" ? JSON.stringify(e.content) : String(e.content)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button className="btn ghost" onClick={onClose}>Discard</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={() => onAccept(result)}>＋ Add as AI note</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({ message, kind, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className={"toast " + (kind || "")}>
      <span className="dot" />
      {message}
    </div>
  );
}

export { TopBar, MetaBar, ScanOverlay, UrlModal, Toast };
