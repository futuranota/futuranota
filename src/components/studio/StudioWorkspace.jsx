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
  normalizeStudioPhase,
  saveStudioSessionDraft,
  studioAspectCss,
  studioAspectLabelKey,
  studioFrameSizeClass,
} from "../../lib/studioConfig.js";
import { parseStudioVimeoInput } from "../../lib/studioEmbed.js";
import { normalizeEmbedSrcForPlayback } from "../../lib/videoEmbed.js";

const PHASE_ORDER = ["embed", "aspect", "wall", "view"];

/**
 * Brand video stage — wizard: embed → ratio → wall → visualize.
 */
export function StudioWorkspace({ onClose }) {
  const { t } = useI18n();
  const initial = loadStudioSessionDraft();
  const [draft, setDraft] = useState(initial);
  const [urlDraft, setUrlDraft] = useState(initial.rawInput || "");
  const [wallHexDraft, setWallHexDraft] = useState(initial.wallColor || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveStudioSessionDraft(draft);
  }, [draft]);

  const phase = normalizeStudioPhase(draft.phase);
  const isView = phase === "view";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (isView) {
        setDraft((prev) => ({ ...prev, phase: "wall" }));
        return;
      }
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isView, onClose]);

  const wallPreview = resolveWallColor(draft.wallColor);
  const playbackSrc = normalizeEmbedSrcForPlayback(draft.embedSrc);
  const hasVideo = Boolean(playbackSrc);
  const aspectCss = studioAspectCss(draft.aspectRatio);
  const frameSizeClass = studioFrameSizeClass(draft.aspectRatio);

  const patchDraft = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const goPhase = (next) => {
    setError("");
    patchDraft({ phase: normalizeStudioPhase(next) });
  };

  const handleHeaderBack = () => {
    if (phase === "view") {
      goPhase("wall");
      return;
    }
    if (phase === "wall") {
      goPhase("aspect");
      return;
    }
    if (phase === "aspect") {
      goPhase("embed");
      return;
    }
    onClose?.();
  };

  const handleCommitEmbed = async () => {
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
      setUrlDraft(parsed.rawInput);
      setDraft((prev) => ({
        ...prev,
        rawInput: parsed.rawInput,
        embedSrc: parsed.embedSrc,
        videoId: parsed.videoId,
        phase: "aspect",
      }));
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

  const handleVisualize = () => {
    const next = normalizeWallColor(wallHexDraft);
    if (String(wallHexDraft || "").trim() && !next) {
      setError(t("studio.invalidWallColor"));
      return;
    }
    if (next) {
      setWallHexDraft(next);
      setDraft((prev) => ({
        ...prev,
        wallColor: next,
        phase: "view",
      }));
      return;
    }
    goPhase("view");
  };

  const handleResetSession = () => {
    const empty = emptyStudioSessionDraft();
    setDraft(empty);
    setUrlDraft("");
    setWallHexDraft("");
    setError("");
  };

  const phaseTitle = {
    embed: t("studio.phaseEmbedTitle"),
    aspect: t("studio.phaseAspectTitle"),
    wall: t("studio.phaseWallTitle"),
    view: t("studio.phaseViewTitle"),
  }[phase];

  const phaseLede = {
    embed: t("studio.phaseEmbedLede"),
    aspect: t("studio.phaseAspectLede"),
    wall: t("studio.phaseWallLede"),
    view: t("studio.phaseViewLede"),
  }[phase];

  const stepIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div
      className={
        "studio-workspace"
        + (isView ? " studio-workspace--view" : "")
      }
    >
      <header className="studio-workspace__header">
        <button
          type="button"
          className="studio-workspace__back"
          onClick={handleHeaderBack}
          aria-label={t("studio.back")}
        >
          ←
        </button>
        <h2 className="studio-workspace__title">{phaseTitle}</h2>
        {!isView ? (
          <a
            className="studio-workspace__vimeo-cta"
            href={VIMEO_JOIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("studio.vimeoCta")}
          </a>
        ) : (
          <button
            type="button"
            className="studio-workspace__edit"
            onClick={() => goPhase("embed")}
          >
            {t("studio.editSetup")}
          </button>
        )}
        <button
          type="button"
          className="studio-workspace__close"
          onClick={onClose}
          aria-label={t("studio.close")}
        >
          ×
        </button>
      </header>

      {!isView ? (
        <>
          <p className="studio-workspace__lede">{phaseLede}</p>
          <div
            className="studio-workspace__steps"
            role="list"
            aria-label={t("studio.stepsAria")}
          >
            {PHASE_ORDER.filter((id) => id !== "view").map((id, i) => (
              <span
                key={id}
                role="listitem"
                className={
                  "studio-workspace__step"
                  + (i === stepIndex ? " is-active" : "")
                  + (i < stepIndex ? " is-done" : "")
                }
              >
                {i + 1}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {phase === "embed" ? (
        <div className="studio-workspace__setup">
          <div className="studio-workspace__drop">
            <span className="studio-workspace__plus" aria-hidden>+</span>
            <span className="studio-workspace__upload-info">
              <span className="studio-workspace__upload-info-lead">
                {t("studio.embedInfoLead")}
              </span>
              <span className="studio-workspace__upload-info-body">
                {t("studio.embedInfoBody")}
              </span>
            </span>
          </div>
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
                  handleCommitEmbed();
                }
              }}
              aria-label={t("studio.urlPlaceholder")}
              autoFocus
            />
          </div>
          {error ? (
            <p className="studio-workspace__error" role="alert">{error}</p>
          ) : null}
          <div className="studio-workspace__nav">
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
              className="studio-workspace__primary"
              onClick={handleCommitEmbed}
              disabled={loading || !urlDraft.trim()}
            >
              {loading ? t("studio.loading") : t("studio.continue")}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "aspect" ? (
        <div className="studio-workspace__setup">
          <div
            className="studio-workspace__ratio-menu"
            role="listbox"
            aria-label={t("studio.aspectLabel")}
          >
            {STUDIO_ASPECT_RATIOS.map((id) => {
              const selected = draft.aspectRatio === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={
                    "studio-workspace__ratio-option"
                    + (selected ? " is-selected" : "")
                  }
                  onClick={() => patchDraft({ aspectRatio: normalizeStudioAspectRatio(id) })}
                >
                  <span className="studio-workspace__ratio-label">
                    {t(`studio.${studioAspectLabelKey(id)}`)}
                  </span>
                  {selected ? (
                    <span className="studio-workspace__ratio-check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="studio-workspace__nav">
            <button
              type="button"
              className="studio-workspace__secondary"
              onClick={() => goPhase("embed")}
            >
              {t("studio.back")}
            </button>
            <button
              type="button"
              className="studio-workspace__primary"
              onClick={() => goPhase("wall")}
            >
              {t("studio.continue")}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "wall" ? (
        <div className="studio-workspace__setup">
          <div className="studio-workspace__wall-preview" style={{ backgroundColor: wallPreview }}>
            <div
              className={`studio-workspace__frame studio-workspace__frame--mini ${frameSizeClass}`}
              style={{ aspectRatio: aspectCss }}
            />
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
          <div className="studio-workspace__nav">
            <button
              type="button"
              className="studio-workspace__secondary"
              onClick={() => goPhase("aspect")}
            >
              {t("studio.back")}
            </button>
            <button
              type="button"
              className="studio-workspace__primary"
              onClick={handleVisualize}
              disabled={!hasVideo}
            >
              {t("studio.visualize")}
            </button>
          </div>
        </div>
      ) : null}

      {isView ? (
        <>
          <div
            className="studio-workspace__stage studio-workspace__stage--immersive"
            style={{ backgroundColor: wallPreview }}
          >
            <div
              className={`studio-workspace__frame ${frameSizeClass}`}
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
          <div className="studio-workspace__view-bar">
            <span className="studio-workspace__view-meta">
              {t(`studio.${studioAspectLabelKey(draft.aspectRatio)}`)}
            </span>
            <button
              type="button"
              className="studio-workspace__secondary"
              onClick={handleResetSession}
            >
              {t("studio.reset")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
