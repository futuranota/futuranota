import { useState, useEffect } from 'react';
import { URL_EXTRACT_SAMPLE } from './data.jsx';
import { NavPreferences } from './components/shared/NavPreferences.jsx';
import { UserMenu } from './components/shared/UserMenu.jsx';
import { useI18n } from './i18n/useI18n.js';
import { Mark } from './marketing/components/Mark.jsx';

/* dashboard.jsx — TopBar, MetaBar, ScanOverlay, UrlModal, Toast */

function TopBar({ onBack, onAltSeed }) {
  const { t } = useI18n();

  return (
    <div className="topbar">
      <div className="topbar-start">
        <button className="btn icon ghost" onClick={onBack} title={t('topbar.back')}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="topbar-center brand brand--centered" aria-label="Futura Nota">
        <span className="brand-mark"><Mark size={22} /></span>
      </div>

      <div className="topbar-end">
        <UserMenu />
        <NavPreferences />
        <button className="btn sm" onClick={onBack}>Library</button>
        {onAltSeed && (
          <button className="btn sm ghost" onClick={onAltSeed} title={t('topbar.altBlueprintTitle')}>
            {t('topbar.altBlueprint')}
          </button>
        )}
      </div>
    </div>
  );
}

function MetaBar({ metadata }) {
  const { t } = useI18n();
  const cells = [
    { k: t('meta.corpus'), v: metadata.corpus, corpus: true },
    { k: t('meta.brand'), v: metadata.brand },
    { k: t('meta.category'), v: metadata.product },
    { k: t('meta.campaign'), v: metadata.campaign, source: metadata.campaignSource },
    { k: t('meta.subcategories'), v: metadata.subcategories },
    { k: t('meta.launch'), v: metadata.launch, accent: true },
    { k: t('meta.window'), v: metadata.window, warm: true },
  ];
  const allEmpty = cells.every((c) => !c.v);
  return (
    <div className={"metabar" + (allEmpty ? " empty" : "")}>
      {cells.map((c) => (
        <div className="meta-cell" key={c.k}>
          <div className="meta-cell-k">{c.k}</div>
          <div
            className={
              "meta-cell-v"
              + (c.corpus ? " corpus" : "")
              + (c.accent ? " accent" : "")
              + (c.warm ? " warm" : "")
            }
          >
            {c.v ? (
              <span className={c.accent ? "accent" : c.warm ? "warm" : ""}>{c.v}</span>
            ) : null}
          </div>
          {c.source ? <div className="meta-source">{c.source}</div> : null}
        </div>
      ))}
    </div>
  );
}

function ScanOverlay({ logs, kind = "campaigns" }) {
  const { t } = useI18n();
  return (
    <div className="scanning">
      <div className="scanning-card">
        <div className="scanning-title">
          <span className="dot-pulse" />
          {kind === "campaigns" ? t("dashboard.scanningCampaigns") : t("dashboard.scanningIntel")}
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
  const { t } = useI18n();
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
          <h3>{t("dashboard.extractUrl")}</h3>
          <button className="btn xs ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {stage === "input" && (
            <>
              <p style={{ margin: "0 0 12px", color: "var(--text-2)", fontSize: 12.5, lineHeight: 1.5 }}>
                {t("dashboard.extractHint")}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <div className="field" style={{ flex: 1 }}>
                  <input autoFocus placeholder="https://…" value={url}
                         onChange={(e) => setUrl(e.target.value)}
                         onKeyDown={(e) => e.key === "Enter" && submit()} />
                </div>
                <button className="btn primary" onClick={submit}>{t("dashboard.extract")}</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--dim)" }}>
                {t("dashboard.tryUrl")} <span style={{ color: "var(--cool)", cursor: "pointer" }}
                              onClick={() => setUrl(URL_EXTRACT_SAMPLE.url)}>
                  {URL_EXTRACT_SAMPLE.url}
                </span>
              </div>
            </>
          )}
          {stage === "loading" && (
            <div style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                {t("dashboard.extracting")}
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
              <div className="label" style={{ marginBottom: 6 }}>{t("dashboard.extractedEntities", { count: result.entities.length })}</div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {result.entities.map((e, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--hairline)", fontSize: 12 }}>
                    <span><span className="note-type-tag" data-t={e.dataType} style={{ marginRight: 8 }}>{e.dataType}</span><b>{e.title}</b></span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--text-2)" }}>{typeof e.content === "object" ? JSON.stringify(e.content) : String(e.content)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button className="btn ghost" onClick={onClose}>{t("dashboard.discard")}</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={() => onAccept(result)}>{t("dashboard.addAsAiNote")}</button>
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
