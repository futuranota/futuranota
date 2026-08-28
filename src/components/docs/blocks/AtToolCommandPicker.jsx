import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../../i18n/useI18n.js";
import { DocTagCommandPicker } from "./DocTagCommandPicker.jsx";
import { suggestNextQLoopIndex } from "../../../lib/qloopsLibrary.js";
import { floatingMenuStyleFromAnchor } from "../../../lib/textareaSelectionRect.js";

const URL_TABLE_ICON = "/uploads/url-table.svg";
const QLOOP_ICON = "/uploads/RepeatOnce.svg";

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string|null} props.companyObjectId
 * @param {{ top: number, left: number }|null} props.anchor
 * @param {() => void} props.onClose
 * @param {import("../../lib/qloopsLibrary.js").QLoopRef[]} [props.qloopCandidates]
 * @param {import("./docBlocks.js").DocBlock[]} [props.docBlocks]
 * @param {(payload: {
 *   loop: import("../../lib/qloopsLibrary.js").QLoopRef,
 *   query: import("../../lib/docBlocks.js").QLoopEntry,
 * }) => void} [props.onInsertQLoopQuery]
 * @param {(candidate: object) => void} [props.onSelectUrlTag]
 * @param {"root"|"qloops"|"qloop-queries"} [props.initialStep]
 */
export function AtToolCommandPicker({
  open,
  companyObjectId = null,
  anchor = null,
  onClose,
  qloopCandidates = [],
  docBlocks = [],
  onInsertQLoopQuery,
  onSelectUrlTag,
  initialStep = "root",
}) {
  const { t } = useI18n();
  const menuRef = useRef(null);
  const [step, setStep] = useState("root");
  const [selectedLoop, setSelectedLoop] = useState(null);
  const [loopQuery, setLoopQuery] = useState("");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep(initialStep);
      setSelectedLoop(null);
      setLoopQuery("");
    }
    wasOpenRef.current = open;
  }, [initialStep, open]);

  const filteredLoops = useMemo(() => {
    const q = String(loopQuery ?? "").trim().toLowerCase();
    if (!q) return qloopCandidates;
    return qloopCandidates.filter((loop) => {
      if (loop.title.toLowerCase().includes(q)) return true;
      if (loop.preview.toLowerCase().includes(q)) return true;
      return loop.queries.some((entry) => {
        if (String(entry.title ?? "").toLowerCase().includes(q)) return true;
        return String(entry.description ?? "").toLowerCase().includes(q);
      });
    });
  }, [loopQuery, qloopCandidates]);

  const suggestedIndex = useMemo(() => {
    if (!selectedLoop) return null;
    return suggestNextQLoopIndex(selectedLoop, docBlocks);
  }, [docBlocks, selectedLoop]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".at-tool-command-picker")) return;
      onClose?.();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (step !== "root") {
          setStep(step === "qloop-queries" ? "qloops" : "root");
          return;
        }
        onClose?.();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open, step]);

  if (!open || !anchor || typeof document === "undefined") return null;

  if (step === "url-table") {
    return (
      <DocTagCommandPicker
        open
        companyObjectId={companyObjectId}
        anchor={anchor}
        onClose={() => setStep("root")}
        onSelect={(candidate) => {
          onSelectUrlTag?.(candidate);
          onClose?.();
        }}
      />
    );
  }

  const style = floatingMenuStyleFromAnchor(anchor);

  return createPortal(
    <div
      ref={menuRef}
      className="at-tool-command-picker doc-tag-command-picker qloop-picker-menu"
      role="dialog"
      aria-label={t("qloopPicker.title")}
      style={style}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {step === "root" ? (
        <>
          <div className="doc-tag-command-picker__header">
            <p className="doc-tag-command-picker__title">{t("qloopPicker.chooseTool")}</p>
            <button
              type="button"
              className="doc-tag-command-picker__close"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <button
            type="button"
            className="at-tool-picker__item"
            onClick={() => setStep("qloops")}
          >
            {t("qloopPicker.qloops")}
          </button>
          <button
            type="button"
            className="at-tool-picker__item"
            onClick={() => setStep("url-table")}
            disabled={!companyObjectId}
            title={!companyObjectId ? t("qloopPicker.urlTableDisabled") : undefined}
          >
            {t("qloopPicker.urlTable")}
          </button>
        </>
      ) : null}

      {step === "qloops" ? (
        <>
          <button
            type="button"
            className="qloop-picker-menu__back"
            onClick={() => setStep("root")}
          >
            {t("qloopPicker.back")}
          </button>
          <input
            type="search"
            className="doc-tag-command-picker__search"
            value={loopQuery}
            placeholder={t("qloopsLibrary.searchPlaceholder")}
            onChange={(e) => setLoopQuery(e.target.value)}
            aria-label={t("qloopsLibrary.searchPlaceholder")}
          />
          <div className="doc-tag-command-picker__list" role="listbox">
            {filteredLoops.length === 0 ? (
              <p className="doc-tag-command-picker__empty">{t("qloopsLibrary.emptyTitle")}</p>
            ) : (
              filteredLoops.map((loop) => (
                <button
                  key={loop.id}
                  type="button"
                  className="doc-tag-command-picker__item"
                  onClick={() => {
                    setSelectedLoop(loop);
                    setStep("qloop-queries");
                  }}
                >
                  <img src={QLOOP_ICON} alt="" className="doc-tag-command-picker__icon" width={16} height={16} />
                  <span className="doc-tag-command-picker__label">{loop.title}</span>
                </button>
              ))
            )}
          </div>
        </>
      ) : null}

      {step === "qloop-queries" && selectedLoop ? (
        <>
          <button
            type="button"
            className="qloop-picker-menu__back"
            onClick={() => {
              setSelectedLoop(null);
              setStep("qloops");
            }}
          >
            {t("qloopPicker.back")}
          </button>
          <p className="qloop-picker-menu__loop-title">{selectedLoop.title}</p>
          <div className="doc-tag-command-picker__list" role="listbox">
            {selectedLoop.queries.map((entry) => {
              const isSuggested = suggestedIndex != null && entry.index === suggestedIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={
                    "qloop-picker-menu__item"
                    + (isSuggested ? " is-suggested" : "")
                  }
                  onClick={() => {
                    onInsertQLoopQuery?.({ loop: selectedLoop, query: entry });
                    onClose?.();
                  }}
                >
                  <span className="qloop-picker-menu__item-index">[{entry.index}]</span>
                  <span className="qloop-picker-menu__item-title">
                    {entry.title || t("qloopEditor.queryTitlePlaceholder")}
                  </span>
                  {entry.description ? (
                    <span className="qloop-picker-menu__item-hint">{entry.description}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
