/* Nav + Hero + feature cards */

/* ---- routing helpers (shared across landing + subpages) ----
   Each page sets window.FN_NAV inline before scripts load:
     landing : { base: "",     home: "#top" }
     subpage : { base: "../",  home: "../Futura%20Nota.html" }
   so the shared Nav/Footer build correct relative links from any depth. */
window.FN_NAV = window.FN_NAV || { base: "", home: "#top" };
window.fnHref = function (slug) { return window.FN_NAV.base + slug + "/index.html"; };
window.fnHome = function (hash) {
  var h = window.FN_NAV.home;
  if (h === "#top") return hash || "#top";
  return h + (hash || "");
};
// welcome / auth page (sign up + sign in). mode "signin" opens the sign-in tab.
window.fnAuth = function (mode) {
  return window.FN_NAV.base + "welcome/index.html" + (mode === "signin" ? "#signin" : "");
};

function Mark({ size = 26 }) {
  // simple geometric "horizon / window" mark — square frame with a rising line
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <rect x="2.2" y="2.2" width="27.6" height="27.6" rx="7.5" stroke="currentColor" strokeWidth="2.2" opacity="0.85" style={{ stroke: "rgb(240, 209, 209)" }} />
      <path d="M8 21 L14 14.5 L18.5 18 L24 10.5" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="10.5" r="2.4" fill="var(--accent)" />
    </svg>);

}

function Wordmark() {
  return (
    <a href={window.FN_NAV.home} className="brand" aria-label="Futura Nota home">
      <span className="brand__mark"><Mark /></span>
      <span className="brand__type" style={{ fontFamily: "Quicksand" }}>FUTURA<span className="brand__type-thin" style={{ fontFamily: "Quicksand" }}> NOTA</span></span>
    </a>);

}

function Nav() {
  const [open, setOpen] = React.useState(false);
  const links = [
  ["Horizon", window.fnHref("horizon")],
  ["Marketplace", window.fnHref("marketplace")],
  ["Blogs", window.fnHref("blogs")],
  ["Enseñanzas", window.fnHref("ensenanzas")]];

  return (
    <header className="nav" data-screen-label="nav">
      <div className="nav__inner container">
        <Wordmark />
        <nav className="nav__links" aria-label="Primary">
          {links.map(([label, href]) =>
          <a key={label} href={href} className="nav__link">{label}</a>
          )}
        </nav>
        <div className="nav__actions">
          <a href={window.fnAuth("signin")} className="nav__link nav__link--quiet">Log in</a>
          <a href={window.fnAuth()} className="btn btn-primary btn-sm" style={{ fontFamily: "sans-serif" }}>Sign up free</a>
        </div>
        <button className="nav__burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /><span /><span />
        </button>
      </div>
      {open &&
      <div className="nav__mobile">
          {links.map(([label, href]) =>
        <a key={label} href={href} className="nav__mobile-link" onClick={() => setOpen(false)}>{label}</a>
        )}
          <a href={window.fnAuth("signin")} className="nav__mobile-link" onClick={() => setOpen(false)}>Log in</a>
          <a href={window.fnAuth()} className="btn btn-primary" onClick={() => setOpen(false)} style={{ marginTop: 8 }}>Sign up free</a>
        </div>
      }
    </header>);

}

const HERO_COPY = {
  maker: {
    eyebrow: "FOR MAKERS & FOUNDERS",
    pre: "They launch the coffee.",
    accent: "You sell the cup.",
    post: "",
    lead: "Spot a launch before it lands — then turn it into something you make by hand. Ceramics, wood, prints, design. Futura Nota gives you the exact window to ship the companion product while attention is at its peak."
  },
  founder: {
    eyebrow: "REAL-TIME CAMPAIGN INTELLIGENCE",
    pre: "Study the campaign.",
    accent: "Move on the window.",
    post: "",
    lead: "Futura Nota detects when a company starts a launch campaign — and hands you the exact window of opportunity to ship the companion product before it closes."
  }
};

function Hero({ heroMode = "maker" }) {
  const c = HERO_COPY[heroMode] || HERO_COPY.maker;
  return (
    <section className="hero section" id="top" data-screen-label="hero">
      <div className="container hero__grid">
        <div className="hero__copy">
          <div className="eyebrow-row">
            <span className="eyebrow eyebrow--signal"><span className="tick" />{c.eyebrow}</span>
          </div>
          <h1 className="display hero__title" style={{ color: "rgb(255, 255, 255)" }}>
            {c.pre} <span className="accent-word">{c.accent}</span>
          </h1>
          <p className="lead hero__lead">{c.lead}</p>
          <div className="hero__cta">
            <a href={window.fnAuth()} className="btn btn-primary" style={{ color: "rgb(255, 255, 255)", fontFamily: "Helvetica" }}>Initialize terminal <span className="arrow">→</span></a>
            <a href={window.fnHref("how")} className="btn btn-ghost">Watch how it works</a>
          </div>
          <div className="hero__trust">
            <span className="chip chip--signal" style={{ fontFamily: "sans-serif" }}><span className="tick" style={{ width: 6, height: 6, borderRadius: 2, background: "currentColor" }} />10 free searches</span>
            <span className="faint" style={{ fontSize: 12.5, fontFamily: "sans-serif" }}>no card · import to Futura · operational since 2026</span>
          </div>
        </div>
        <HeroFrame />
      </div>

      <div className="container">
        <FeatureCards />
      </div>
    </section>);

}

function HeroFrame() {
  return (
    <div className="hero__frame card" aria-hidden="true">
      <div className="frame__bar">
        <span className="frame__dot" /><span className="frame__dot" /><span className="frame__dot" />
        <span className="frame__title">futura — horizon</span>
        <span className="chip chip--signal frame__live"><span className="pulse" />LIVE</span>
      </div>
      <div className="frame__body">
        <div className="detect">
          <div className="detect__row">
            <span className="eyebrow eyebrow--signal" style={{ fontSize: 11, fontFamily: "\"Hanken Grotesk\"" }}><span className="tick" />CAMPAIGN DETECTED</span>
            <span className="faint mono-sm">02:14 ago</span>
          </div>
          <div className="detect__name">NovaBrew · single-origin launch</div>
          <div className="window">
            <div className="window__label mono-sm" style={{ fontFamily: "\"Hanken Grotesk\"" }}>SHIP WINDOW</div>
            <div className="window__bar"><span style={{ width: "62%" }} /></div>
            <div className="window__meta"><span className="mono-sm">opens now</span><span className="mono-sm faint">closes in 9d</span></div>
          </div>
        </div>
        <div className="nodes" style={{ fontFamily: "sans-serif" }}>
          <div className="nodes__head mono-sm faint"></div>
          <div className="node" style={{ fontWeight: "500" }}><span className="node__hash">problem</span> mugs ship cold, look generic</div>
          <div className="node" style={{ fontWeight: "500" }}><span className="node__hash">make</span> hand-thrown stoneware, matte glaze</div>
          <div className="node" style={{ fontWeight: "500" }}><span className="node__hash">window</span> drop day 0 → day 9</div>
        </div>
      </div>
    </div>);

}

const FEATURES = [
["01", "OBJECTS", "Parent entities — you, projects, products, spaces. Everything you track lives as an object you can branch."],
["02", "DOCS & NODES", "Notion-like docs that split into typed, atomic #-nodes the moment you write them. Structure, automatically."],
["03", "CANVAS & SYNC", "Plan the connections on an infinite canvas, then sync across tiers so the window never slips past you."]];


function FeatureCards() {
  return (
    <div className="features grid">
      {FEATURES.map(([n, title, body]) =>
      <article className="feature card" key={n}>
          <div className="feature__top">
            <span className="feature__num mono-sm">{n}</span>
            <span className="feature__dot" />
          </div>
          <h3 className="h3 feature__title">{title}</h3>
          <p className="muted feature__body">{body}</p>
        </article>
      )}
    </div>);

}

Object.assign(window, { Mark, Wordmark, Nav, Hero, HeroFrame, FeatureCards });