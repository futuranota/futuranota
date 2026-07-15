/* Final CTA + Footer */

function FinalCTA() {
  return (
    <section className="section cta-section" id="signup" data-screen-label="cta">
      <div className="container">
        <div className="cta card">
          <div className="cta__glow" aria-hidden="true" />
          <span className="eyebrow eyebrow--signal" style={{ justifyContent: "center" }}><span className="tick" />THE WINDOW IS OPEN</span>
          <h2 className="display cta__title">Ready to move on your opportunities?</h2>
          <p className="lead cta__lead">Join the makers and founders using Futura Nota to organize their ideas and move faster than the competition. Start free — no card, full features.</p>
          <div className="cta__buttons">
            <a href={window.fnAuth()} className="btn btn-primary">Start free — 10 searches <span className="arrow">→</span></a>
            <a href={window.fnAuth("signin")} className="btn btn-ghost">Sign in</a>
          </div>
          <div className="cta__trust">
            {["No credit card", "Full features free", "500+ entrepreneurs", "Operational since 2026"].map(t => (
              <span className="cta__trust-item mono-sm" key={t}><span className="tick" style={{ width: 5, height: 5, borderRadius: 2, background: "var(--signal)" }} />{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLS = [
  ["Product", ["Features", "Pricing", "Documentation", "Changelog"]],
  ["Learn", ["Blogs", "Enseñanzas", "Marketplace", "Horizon"]],
  ["Community", ["GitHub", "Twitter / X", "Discord", "Contact"]],
  ["Legal", ["Privacy", "Terms", "Cookies"]],
];

// route the "Learn" column entries to their section pages
const FOOTER_SECTION_SLUGS = { "Horizon": "horizon", "Marketplace": "marketplace", "Blogs": "blogs", "Enseñanzas": "ensenanzas" };
function footerHref(label) { return FOOTER_SECTION_SLUGS[label] ? window.fnHref(FOOTER_SECTION_SLUGS[label]) : "#"; }

function Footer() {
  return (
    <footer className="footer" data-screen-label="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <a href={window.FN_NAV.home} className="brand"><span className="brand__mark"><Mark /></span><span className="brand__type">FUTURA<span className="brand__type-thin"> NOTA</span></span></a>
          <p className="muted footer__tag">The future of taking notes — for the people who ship before the window closes.</p>
          <form
            className="footer__news"
            action="https://ticketradius.us1.list-manage.com/subscribe/post?u=a8c21b422d28dbeec55f9f9ce&id=fbaad13d3a&f_id=00d1d0e0f0"
            method="post"
            target="_blank"
            noValidate
            name="mc-embedded-subscribe-form"
            id="mc-embedded-subscribe-form"
          >
            <label className="mono-sm faint" htmlFor="mce-EMAIL">Stay ahead of the trends</label>
            <div className="footer__news-row">
              <input id="mce-EMAIL" type="email" name="EMAIL" placeholder="you@studio.com" className="footer__input required email" required autoComplete="email" aria-label="Email for newsletter" />
              <input type="hidden" name="tags" value="3182309" />
              <div aria-hidden="true" style={{ position: "absolute", left: "-5000px" }}>
                <input type="text" name="b_a8c21b422d28dbeec55f9f9ce_fbaad13d3a" tabIndex={-1} defaultValue="" />
              </div>
              <button className="btn btn-primary btn-sm" type="submit" name="subscribe" id="mc-embedded-subscribe">Subscribe</button>
            </div>
          </form>
        </div>

        <div className="footer__cols">
          {FOOTER_COLS.map(([h, links]) => (
            <div className="footer__col" key={h}>
              <div className="footer__col-h mono-sm">{h}</div>
              {links.map(l => <a key={l} href={footerHref(l)} className="footer__link">{l}</a>)}
            </div>
          ))}
        </div>
      </div>
      <div className="container footer__base">
        <span className="mono-sm faint">© 2026 Futura Nota — operational since 2026.</span>
        <span className="mono-sm faint">Made by hand · shipped on the window.</span>
      </div>
    </footer>
  );
}

Object.assign(window, { FinalCTA, Footer });
