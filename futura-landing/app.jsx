/* Root app + Tweaks */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "terracotta",
  "heroMode": "maker",
  "texture": "on"
}/*EDITMODE-END*/;

const ACCENTS = {
  terracotta: { "--accent": "oklch(0.72 0.135 52)", "--accent-strong": "oklch(0.67 0.140 50)", "--accent-soft": "oklch(0.72 0.135 52 / 0.14)", "--accent-line": "oklch(0.72 0.135 52 / 0.40)", "--on-accent": "oklch(0.18 0.02 50)" },
  green:      { "--accent": "oklch(0.80 0.150 159)", "--accent-strong": "oklch(0.75 0.150 159)", "--accent-soft": "oklch(0.80 0.150 159 / 0.14)", "--accent-line": "oklch(0.80 0.150 159 / 0.42)", "--on-accent": "oklch(0.18 0.03 159)" },
  violet:     { "--accent": "oklch(0.70 0.150 295)", "--accent-strong": "oklch(0.65 0.155 295)", "--accent-soft": "oklch(0.70 0.150 295 / 0.16)", "--accent-line": "oklch(0.70 0.150 295 / 0.42)", "--on-accent": "oklch(0.97 0.01 295)" },
};

function applyTheme(t) {
  const root = document.documentElement;
  const a = ACCENTS[t.accent] || ACCENTS.terracotta;
  for (const [k, v] of Object.entries(a)) root.style.setProperty(k, v);
  root.setAttribute("data-texture", t.texture);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => { applyTheme(t); }, [t.accent, t.texture]);

  return (
    <React.Fragment>
      <div className="canvas-bg" />
      <Nav />
      <main>
        <Hero heroMode={t.heroMode} />
        <SectionDirectory />
        <FinalCTA />
      </main>
      <Footer />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={accentSwatch(t.accent)}
          options={["#cf8157", "#3fd39a", "#a78bfa"]}
          onChange={(v) => setTweak("accent", swatchToName(v))} />
        <TweakToggle label="Dot-grid texture" value={t.texture === "on"}
          onChange={(v) => setTweak("texture", v ? "on" : "off")} />
        <TweakSection label="Hero" />
        <TweakRadio label="Framing" value={t.heroMode}
          options={["maker", "founder"]}
          onChange={(v) => setTweak("heroMode", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

const SWATCH = { terracotta: "#cf8157", green: "#3fd39a", violet: "#a78bfa" };
function accentSwatch(name) { return SWATCH[name] || SWATCH.terracotta; }
function swatchToName(hex) { return Object.keys(SWATCH).find(k => SWATCH[k] === hex) || "terracotta"; }

// fallback stubs so the page renders before later section files load
window.SectionDirectory = window.SectionDirectory || (() => null);
window.FinalCTA = window.FinalCTA || (() => null);
window.Footer = window.Footer || (() => null);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
