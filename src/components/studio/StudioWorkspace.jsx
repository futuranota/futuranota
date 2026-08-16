import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import {
  FOLDER_LIBRARY_DEFAULT_WALL,
  normalizeWallColor,
  resolveWallColor,
} from "../../lib/folderLibraryNormalize.js";
import {
  STUDIO_ASPECT_RATIOS,
  VIMEO_JOIN_URL,
  emptyStudioSessionDraft,
  loadStudioSessionDraft,
  normalizeStudioAspectRatio,
  saveStudioSessionDraft,
  studioAspectCss,
} from "../../lib/studioConfig.js";
import { parseStudioVimeoInput } from "../../lib/studioEmbed.js";
import { normalizeEmbedSrcForPlayback } from "../../lib/videoEmbed.js";

/**
 * Brand video stage — Vimeo visualize only (wall + aspect). No notes.
 */
export function StudioWorkspace({ onClose }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => loadStudioSessionDraft());
  const [urlDraft, setUrlDraft] = useState(() => loadStudioSessionDraft().rawInput || "");
  const [wallHexDraft, setWallHexDraft] = useState(
    () => loadStudioSessionDraft().wallColor || "",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveStudioSessionDraft(draft);
  }, [draft]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const wallPreview = resolveWallColor(draft.wallColor);
  const playbackSrc = normalizeEmbedSrcForPlayback(draft.embedSrc);
  const hasVideo = Boolean(playbackSrc);
  const aspectCss = studioAspectCss(draft.aspectRatio);

  const patchDraft = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleLoad = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const parsed = parseStudioVimeoInput(urlDraft);
      if (parsed.error === "STUDIO_VIMEO_ONLY") {
        setError(t("studio.vimeoOnly"));
        return;
      }
      if (parsed.error || !parsed.embedSrc) {
        setError(parsed.error || t("studio.invalidUrl"));
        return;
      }
      patchDraft({
        rawInput: parsed.rawInput,
        embedSrc: parsed.embedSrc,
        videoId: parsed.videoId,
      });
      setUrlDraft(parsed.rawInput);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyWall = () => {
    const next = normalizeWallColor(wallHexDraft);
    if (!next && String(wallHexDraft || "").trim()) {
      setError(t("studio.invalidWallColor"));
      return;
    }
    setError("");
    patchDraft({ wallColor: next });
    setWallHexDraft(next || "");
  };

  const handleClearVideo = () => {
    patchDraft({
      rawInput: "",
      embedSrc: "",
      videoId: "",
    });
    setUrlDraft("");
    setError("");
  };

  const handleResetSession = () => {
    const empty = emptyStudioSessionDraft();
    setDraft(empty);
    setUrlDraft("");
    setWallHexDraft("");
    setError("");
  };

  return (
    <div className="studio-workspace">
      <header className="studio-workspace__header">
        <button
          type="button"
          className="studio-workspace__back"
          onClick={onClose}
          aria-label={t("studio.back")}
        >
          ←
        </button>
        <h2 className="studio-workspace__title">{t("studio.title")}</h2>
        <a
          className="studio-workspace__vimeo-cta"
          href={VIMEO_JOIN_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("studio.vimeoCta")}
        </a>
        <button
          type="button"
          className="studio-workspace__close"
          onClick={onClose}
          aria-label={t("studio.close")}
        >
          ×
        </button>
      </header>

      <p className="studio-workspace__lede">{t("studio.lede")}</p>

      <div
        className="studio-workspace__stage"
        style={{ backgroundColor: wallPreview }}
      >
        <div
          className={
            "studio-workspace__frame"
            + (draft.aspectRatio === "9:16" ? " studio-workspace__frame--portrait" : "")
            + (draft.aspectRatio === "1:1" ? " studio-workspace__frame--square" : "")
          }
          style={{ aspectRatio: aspectCss }}
        >
          {hasVideo ? (
            <iframe
              className="studio-workspace__iframe"
              src={playbackSrc}
              title={t("studio.playerTitle")}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="studio-workspace__empty" role="status">
              {t("studio.emptyStage")}
            </p>
          )}
        </div>
      </div>

      <div className="studio-workspace__controls">
        <div className="studio-workspace__url-row">
          <input
            className="studio-workspace__url-input"
            type="url"
            value={urlDraft}
            placeholder={t("studio.urlPlaceholder")}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLoad();
              }
            }}
            aria-label={t("studio.urlPlaceholder")}
          />
          <button
            type="button"
            className="studio-workspace__load"
            onClick={handleLoad}
            disabled={loading || !urlDraft.trim()}
          >
            {loading ? t("studio.loading") : t("studio.load")}
          </button>
          {hasVideo ? (
            <button
              type="button"
              className="studio-workspace__clear"
              onClick={handleClearVideo}
            >
              {t("studio.clearVideo")}
            </button>
          ) : null}
        </div>

        <div className="studio-workspace__aspect" role="group" aria-label={t("studio.aspectLabel")}>
          <span className="studio-workspace__control-label">{t("studio.aspectLabel")}</span>
          <div className="studio-workspace__aspect-chips">
            {STUDIO_ASPECT_RATIOS.map((id) => (
              <button
                key={id}
                type="button"
                className={
                  "studio-workspace__aspect-chip"
                  + (draft.aspectRatio === id ? " is-active" : "")
                }
                aria-pressed={draft.aspectRatio === id}
                onClick={() => patchDraft({ aspectRatio: normalizeStudioAspectRatio(id) })}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <div className="studio-workspace__wall">
          <span className="studio-workspace__control-label">{t("studio.wallColorLabel")}</span>
          <div className="studio-workspace__wall-row">
            <input
              type="color"
              className="studio-workspace__wall-swatch"
              value={wallPreview}
              aria-label={t("studio.wallColorLabel")}
              onChange={(e) => {
                const next = normalizeWallColor(e.target.value);
                setWallHexDraft(next || FOLDER_LIBRARY_DEFAULT_WALL);
                patchDraft({ wallColor: next });
                setError("");
              }}
            />
            <input
              className="studio-workspace__wall-hex"
              type="text"
              value={wallHexDraft}
              placeholder={t("studio.wallColorPlaceholder")}
              spellCheck={false}
              onChange={(e) => setWallHexDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyWall();
                }
              }}
            />
            <button
              type="button"
              className="studio-workspace__wall-apply"
              onClick={handleApplyWall}
            >
              {t("studio.wallColorApply")}
            </button>
          </div>
          <span className="studio-workspace__wall-hint">{t("studio.wallColorHint")}</span>
        </div>

        {error ? (
          <p className="studio-workspace__error" role="alert">{error}</p>
        ) : null}

        <div className="studio-workspace__footer-row">
          <a
            className="studio-workspace__vimeo-link"
            href={VIMEO_JOIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("studio.vimeoRelink")}
          </a>
          <button
            type="button"
            className="studio-workspace__reset"
            onClick={handleResetSession}
          >
            {t("studio.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}
