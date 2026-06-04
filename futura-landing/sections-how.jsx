/* How it works — animated video placeholder */

const STEPS = [
  ["01", "Create an object", "Spin up a product, brand, or space you want to track."],
  ["02", "Write the doc", "Type freely — #-nodes split into typed, atomic pieces as you go."],
  ["03", "Search the signal", "The intelligence panel surfaces campaigns starting right now."],
  ["04", "Map the canvas", "Drag connections between problem, make, and window."],
  ["05", "Watch the window", "The timeline tells you exactly when to ship — and when it closes."],
];

function HowItWorks() {
  return (
    <section className="section how" id="how" data-screen-label="how">
      <div className="container">
        <div className="section-head" style={{ marginBottom: "clamp(28px,4vw,44px)" }}>
          <span className="eyebrow"><span className="tick" />HOW FUTURA WORKS</span>
          <h2 className="h2">Think in objects. Move in windows.</h2>
          <p className="lead">A ninety-second walk through the whole loop — from spotting a campaign to shipping the thing you make by hand.</p>
        </div>

        <div className="video card" role="img" aria-label="Product walkthrough video placeholder">
          <div className="frame__bar">
            <span className="frame__dot" /><span className="frame__dot" /><span className="frame__dot" />
            <span className="frame__title">futura-nota.app — walkthrough</span>
            <span className="mono-sm faint" style={{ marginLeft: "auto" }}>01:32</span>
          </div>
          <div className="video__stage ph">
            <span className="ph__tag" style={{ position: "absolute", top: 14, left: 14 }}>video placeholder · drop screen-recording here</span>
            <button className="video__play" aria-label="Play walkthrough">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <div className="video__scrub"><span style={{ width: "34%" }} /></div>
          </div>
        </div>

        <ol className="steps">
          {STEPS.map(([n, t, d]) => (
            <li className="step" key={n}>
              <span className="step__num mono-sm">{n}</span>
              <div>
                <div className="step__title">{t}</div>
                <div className="muted step__desc">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

Object.assign(window, { HowItWorks });
