import { COMPANIES } from "../data.jsx";

export function LandingPage({ onStart }) {
  return (
    <div className="landing">
      <div className="landing-card glass">
        <div className="landing-meta">
          <span style={{ fontFamily: "var(--mono)" }}>FUTURA NOTA · v0.6</span>
          <span className="pill ok pulse"><i className="dot" />Operational</span>
        </div>
        <h1>Study campaigns.<br />Move on the <span className="accent">window</span>.</h1>
        <p>
          Real-time intelligence platform that detects when a company starts a launch campaign — and gives you the exact window of opportunity to ship before it closes.
        </p>
        <div className="landing-cta">
          <button type="button" className="btn primary" onClick={onStart}>Initialize terminal →</button>
          <button type="button" className="btn ghost">Documentation</button>
        </div>
        <div className="landing-features">
          <div className="landing-feat">
            <div className="landing-feat-k">01 · Objects</div>
            <div className="landing-feat-v">Parent entities — you, projects, spaces.</div>
          </div>
          <div className="landing-feat">
            <div className="landing-feat-k">02 · Docs & Nodes</div>
            <div className="landing-feat-v">Notion-like docs → typed atomic nodes.</div>
          </div>
          <div className="landing-feat">
            <div className="landing-feat-k">03 · Canvas & Timeline</div>
            <div className="landing-feat-v">Plan connections · sync across tiers.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
