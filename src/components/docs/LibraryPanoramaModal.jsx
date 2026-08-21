import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { promptPreviewText } from "../../lib/libraryFichaPreview.js";

/**
 * Admin-only Prompt panorama — stage + lazy filmstrip over existing mediaUrl.
 *
 * @param {{
 *   items?: Array<{ id?: string, tag?: string, description?: string, mediaUrl?: string|null }>,
 *   onClose?: () => void,
 *   initialIndex?: number,
 * }} props
 */
export function LibraryPanoramaModal({
  items = [],
  onClose,
  initialIndex = 0,
}) {
  const { t } = useI18n();
  const slides = useMemo(
    () => (Array.isArray(items) ? items.filter((item) => String(item?.mediaUrl || "").trim()) : []),
    [items],
  );
  const [index, setIndex] = useState(() => {
    const max = Math.max(0, slides.length - 1);
    const start = Math.floor(Number(initialIndex) || 0);
    return Math.max(0, Math.min(max, start));
  });
  const stripRef = useRef(null);

  useEffect(() => {
    const max = Math.max(0, slides.length - 1);
    setIndex((prev) => Math.max(0, Math.min(max, prev)));
  }, [slides.length]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (!slides.length) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((prev) => (prev - 1 + slides.length) % slides.length);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((prev) => (prev + 1) % slides.length);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, slides.length]);

  const active = slides[index] || null;

  // Preload neighbors after first paint — keep stage to one mounted full img.
  useEffect(() => {
    if (!slides.length) return undefined;
    const ids = [
      slides[(index + 1) % slides.length],
      slides[(index - 1 + slides.length) % slides.length],
    ];
    const urls = [...new Set(
      ids
        .map((item) => String(item?.mediaUrl || "").trim())
        .filter((url) => url && url !== String(active?.mediaUrl || "").trim()),
    )];
    const loaders = urls.map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });
    return () => {
      loaders.forEach((img) => {
        img.src = "";
      });
    };
  }, [active?.mediaUrl, index, slides]);

  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-panorama-index="${index}"]`);
    el?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [index]);

  if (typeof document === "undefined") return null;

  const caption = active ? promptPreviewText(active) : "";
  const title = active?.tag || t("doc.library.panorama");

  return createPortal(
    <div
      className="library-panorama"
      role="dialog"
      aria-modal="true"
      aria-label={t("doc.library.panorama")}
    >
      <button
        type="button"
        className="library-panorama__backdrop"
        aria-label={t("doc.library.panoramaClose")}
        onClick={onClose}
      />
      <div className="library-panorama__shell">
        <header className="library-panorama__header">
          <h2 className="library-panorama__title">{t("doc.library.panorama")}</h2>
          <button
            type="button"
            className="library-panorama__close"
            onClick={onClose}
            aria-label={t("doc.library.panoramaClose")}
          >
            ×
          </button>
        </header>

        {slides.length === 0 ? (
          <div className="library-panorama__empty">
            <p>{t("doc.library.panoramaEmpty")}</p>
            <button
              type="button"
              className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
              onClick={onClose}
            >
              {t("doc.library.panoramaClose")}
            </button>
          </div>
        ) : (
          <>
            <div className="library-panorama__stage">
              {active?.mediaUrl ? (
                <img
                  key={active.id || active.mediaUrl}
                  className="library-panorama__stage-img"
                  src={active.mediaUrl}
                  alt={title}
                />
              ) : null}
            </div>
            <div className="library-panorama__caption">
              <span className="library-panorama__caption-tag">{title}</span>
              {caption ? (
                <span className="library-panorama__caption-prompt">{caption}</span>
              ) : null}
              <span className="library-panorama__caption-count" aria-live="polite">
                {index + 1}/{slides.length}
              </span>
            </div>
            <div className="library-panorama__strip-wrap">
              <div
                ref={stripRef}
                className="library-panorama__strip"
                role="listbox"
                aria-label={t("doc.library.panorama")}
              >
                {slides.map((item, i) => {
                  const tag = String(item.tag || "").trim() || "—";
                  const isActive = i === index;
                  return (
                    <button
                      key={item.id || `${item.mediaUrl}-${i}`}
                      type="button"
                      role="option"
                      data-panorama-index={i}
                      aria-selected={isActive}
                      aria-label={tag}
                      className={
                        "library-panorama__thumb"
                        + (isActive ? " is-active" : "")
                      }
                      onClick={() => setIndex(i)}
                    >
                      <img
                        src={item.mediaUrl}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="library-panorama__thumb-bar" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
