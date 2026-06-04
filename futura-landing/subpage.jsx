/* Shared subpage shell.
   Each subpage HTML sets window.FN_PAGE = { component: "Horizon" } before this
   script loads; this renders Nav + a "back to home" bar + that section + Footer.
   Nav, Footer and the section components are loaded from the shared ../sections-*.jsx
   files and attached to window. */

function SubpageShell() {
  const cfg = window.FN_PAGE || {};
  const Section = window[cfg.component] || (() => null);
  return (
    <React.Fragment>
      <div className="canvas-bg" />
      <Nav />
      <main>
        <div className="container subpage__top">
          <a className="back-link" href={window.FN_NAV.home}>
            <span className="back-link__arrow">←</span> Volver al inicio
          </a>
        </div>
        <Section />
      </main>
      <Footer />
    </React.Fragment>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<SubpageShell />);
