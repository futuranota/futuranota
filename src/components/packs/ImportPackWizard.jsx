import { useCallback, useMemo, useState } from "react";
import {
  applyPackImport,
  readPackFile,
  summarizePack,
} from "../../lib/pack/packImport.js";
import { PACK_FILE_EXTENSION } from "../../lib/pack/packSchema.js";
import "../../styles/pack-wizard.css";

const PACK_UPLOAD_ICON = "/uploads/botones/CloudArrowUp.svg";

const STEPS = ["file", "brand", "products", "content", "confirm"];

const STEP_LABELS = {
  file: "Import pack",
  brand: "Brand",
  products: "Products",
  content: "Content",
  confirm: "Confirm",
};

/**
 * @param {Object} props
 * @param {() => void} props.onClose
 * @param {string|null} [props.mergeTargetObjectId]
 * @param {(result: { rootObjectId: string }) => void} [props.onImported]
 */
export function ImportPackWizard({
  onClose,
  mergeTargetObjectId = null,
  onImported,
}) {
  const [step, setStep] = useState("file");
  const [pack, setPack] = useState(null);
  const [error, setError] = useState(null);
  const [importMode, setImportMode] = useState(
    mergeTargetObjectId ? "merge-into" : "new-object",
  );
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => (pack ? summarizePack(pack) : null), [pack]);
  const stepIndex = STEPS.indexOf(step);

  const reset = useCallback(() => {
    setStep("file");
    setPack(null);
    setError(null);
    setImportMode(mergeTargetObjectId ? "merge-into" : "new-object");
    setBusy(false);
  }, [mergeTargetObjectId]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePanelBack = () => {
    if (stepIndex <= 0) {
      handleClose();
      return;
    }
    setError(null);
    setStep(STEPS[stepIndex - 1]);
  };

  const handleFile = async (file) => {
    setError(null);
    try {
      const parsed = await readPackFile(file);
      setPack(parsed);
      setStep("brand");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read pack file");
    }
  };

  const handleImport = async () => {
    if (!pack) return;
    setBusy(true);
    setError(null);
    try {
      const result = applyPackImport(pack, {
        mode: importMode,
        targetObjectId: importMode === "merge-into" ? mergeTargetObjectId : null,
      });
      onImported?.(result);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setBusy(false);
    }
  };

  const backLabel = stepIndex > 0 ? STEP_LABELS[STEPS[stepIndex - 1]] : "Folders";

  return (
    <div className="lp-click-folder-detail lp-pack-import-detail">
      <button
        type="button"
        className="lp-click-folder-back"
        onClick={handlePanelBack}
        aria-label={stepIndex > 0 ? `Back — ${backLabel}` : "Back to folders"}
        title={stepIndex > 0 ? `Back — ${backLabel}` : "Back to folders"}
      >
        <span className="lp-click-folder-back-icon" aria-hidden />
      </button>

      <div className="pack-wizard pack-wizard--panel">
        <header className="pack-wizard__head">
          <h3 className="pack-wizard__title">{STEP_LABELS[step] || "Import pack"}</h3>
          <nav className="pack-wizard__steps" aria-label="Import steps">
            {STEPS.map((s) => (
              <span
                key={s}
                className={
                  "pack-wizard__step"
                  + (step === s ? " is-active" : "")
                  + (STEPS.indexOf(s) < stepIndex ? " is-done" : "")
                }
              >
                {s}
              </span>
            ))}
          </nav>
        </header>

        <div className="pack-wizard__body">
          {error ? <p className="pack-wizard__error" role="alert">{error}</p> : null}

          {step === "file" && (
            <section className="pack-wizard__panel">
              <p className="pack-wizard__lead">
                Upload a <code>{PACK_FILE_EXTENSION}</code> pack (unzip locally to edit
                {" "}
                <code>manifest.json</code> and <code>model.json</code>).
                Products and Content only.
              </p>
              <label className="pack-wizard__drop">
                <input
                  type="file"
                  accept=".zip,application/zip,application/json,.fnota"
                  className="pack-wizard__file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
                <img
                  src={PACK_UPLOAD_ICON}
                  alt=""
                  className="pack-wizard__drop-icon"
                  aria-hidden
                />
                <span className="pack-wizard__drop-label">Choose pack file</span>
              </label>
            </section>
          )}

          {step === "brand" && summary && (
            <section className="pack-wizard__panel">
              <h4 className="pack-wizard__heading">Brand / object</h4>
              <dl className="pack-wizard__meta">
                <div><dt>Name</dt><dd>{summary.name}</dd></div>
                <div><dt>Brand</dt><dd>{summary.brand || "—"}</dd></div>
                <div><dt>Type</dt><dd>{summary.packType}</dd></div>
              </dl>
              <fieldset className="pack-wizard__mode">
                <legend>Import as</legend>
                <label>
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === "new-object"}
                    onChange={() => setImportMode("new-object")}
                  />
                  New object (recommended)
                </label>
                {mergeTargetObjectId ? (
                  <label>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "merge-into"}
                      onChange={() => setImportMode("merge-into")}
                    />
                    Merge into current object
                  </label>
                ) : null}
              </fieldset>
              <div className="pack-wizard__actions">
                <button type="button" className="btn xs primary" onClick={() => setStep("products")}>
                  Next: Products
                </button>
              </div>
            </section>
          )}

          {step === "products" && summary && (
            <section className="pack-wizard__panel">
              <h4 className="pack-wizard__heading">Products</h4>
              <p className="pack-wizard__stat">
                {summary.counts?.products ?? 0} product document(s) will be imported under
                {" "}
                {importMode === "merge-into" ? "the selected object" : "a new object"}.
              </p>
              <div className="pack-wizard__actions">
                <button type="button" className="btn xs primary" onClick={() => setStep("content")}>
                  Next: Content
                </button>
              </div>
            </section>
          )}

          {step === "content" && summary && (
            <section className="pack-wizard__panel">
              <h4 className="pack-wizard__heading">Content</h4>
              <ul className="pack-wizard__list">
                <li>{summary.counts?.content ?? 0} content document(s)</li>
                <li>{summary.counts?.nodes ?? 0} linked node(s)</li>
                {summary.includesGraph ? (
                  <li>Canvas layout included</li>
                ) : null}
              </ul>
              <div className="pack-wizard__actions">
                <button type="button" className="btn xs primary" onClick={() => setStep("confirm")}>
                  Review
                </button>
              </div>
            </section>
          )}

          {step === "confirm" && summary && (
            <section className="pack-wizard__panel">
              <h4 className="pack-wizard__heading">Confirm import</h4>
              <p className="pack-wizard__lead">
                Import <strong>{summary.name}</strong> as
                {" "}
                {importMode === "new-object" ? "a new workspace object" : "merged docs"}.
              </p>
              <div className="pack-wizard__actions">
                <button
                  type="button"
                  className="btn xs primary"
                  onClick={handleImport}
                  disabled={busy}
                >
                  {busy ? "Importing…" : "Import pack"}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
