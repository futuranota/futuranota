import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import {
  FOLDER_LIBRARY_DEFAULT_WALL,
  normalizeWallColor,
  resolveWallColor,
} from "../../lib/folderLibraryNormalize.js";
import {
  STUDIO_ASPECT_RATIOS,
  STUDIO_LOGO_MAX_BYTES,
  STUDIO_MOCKUPS,
  VIMEO_JOIN_URL,
  emptyStudioSessionDraft,
  getStudioMockup,
  loadStudioSessionDraft,
  normalizeStudioAspectRatio,
  normalizeStudioFrameStroke,
  normalizeStudioMockupId,
  normalizeStudioPhase,
  resolveStudioFrameStroke,
  resolveStudioTextColor,
  saveStudioSessionDraft,
  studioAspectCss,
  studioAspectLabelKey,
  studioFrameSizeClass,
  studioMockupColorDefaults,
  studioMockupUsesChrome,
  studioMockupUsesIdentity,
  STUDIO_DEFAULT_TEXT_COLOR,
} from "../../lib/studioConfig.js";
import { parseStudioVimeoInput } from "../../lib/studioEmbed.js";
import { normalizeEmbedSrcForPlayback } from "../../lib/videoEmbed.js";
import { StudioMockupX } from "./StudioMockupX.jsx";

const PHASE_ORDER = ["embed", "aspect", "mockup", "wall", "view"];

function MockupThumb({ id }) {
  if (id === "none") {
    return (
      <span className="studio-workspace__mockup-thumb-plain">
        <span className="studio-workspace__mockup-thumb-plain-screen">
          <span className="studio-workspace__mockup-thumb-plain-play" />
        </span>
        <span className="studio-workspace__mockup-thumb-plain-glow" />
      </span>
    );
  }
  return (
    <span className="studio-workspace__mockup-thumb-x">
      <span className="studio-workspace__mockup-thumb-x-nav" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="studio-workspace__mockup-thumb-x-feed" aria-hidden>
        <span className="studio-workspace__mockup-thumb-x-head">
          <span className="studio-workspace__mockup-thumb-x-logo" />
          <span className="studio-workspace__mockup-thumb-x-name" />
        </span>
        <span className="studio-workspace__mockup-thumb-x-caption" />
        <span className="studio-workspace__mockup-thumb-x-media">
          <span className="studio-workspace__mockup-thumb-x-ad">Ad</span>
        </span>
        <span className="studio-workspace__mockup-thumb-x-actions">
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="studio-workspace__mockup-thumb-x-rail" aria-hidden>
        <span />
        <span />
      </span>
    </span>
  );
}

/**
 * Brand video stage — wizard: embed → ratio → mockup → wall → visualize.
 */
export function StudioWorkspace({ onClose }) {
  const { t } = useI18n();
  const logoInputRef = useRef(null);
  const initial = loadStudioSessionDraft();
  const [draft, setDraft] = useState(initial);
  const [urlDraft, setUrlDraft] = useState(initial.rawInput || "");
  const [wallHexDraft, setWallHexDraft] = useState(initial.wallColor || "");
  const [strokeHexDraft, setStrokeHexDraft] = useState(initial.frameStroke || "");
  const [textHexDraft, setTextHexDraft] = useState(
    initial.draftTextColor || STUDIO_DEFAULT_TEXT_COLOR,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveStudioSessionDraft(draft);
  }, [draft]);

  const phase = normalizeStudioPhase(draft.phase);
  const isView = phase === "view";
  const mockupId = normalizeStudioMockupId(draft.mockupId);
  const useChrome = studioMockupUsesChrome(mockupId);
  const useIdentity = studioMockupUsesIdentity(mockupId);
  const useXFeed = mockupId === "x";

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
  const strokePreview = resolveStudioFrameStroke(draft.frameStroke, mockupId);
  const textPreview = resolveStudioTextColor(draft.draftTextColor, mockupId);
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
      goPhase("mockup");
      return;
    }
    if (phase === "mockup") {
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

  const handleSelectMockup = (id) => {
    const defaults = studioMockupColorDefaults(id);
    setWallHexDraft(defaults.wallColor || "");
    setStrokeHexDraft(defaults.frameStroke || "");
    setTextHexDraft(defaults.draftTextColor || STUDIO_DEFAULT_TEXT_COLOR);
    setError("");
    setDraft((prev) => ({
      ...prev,
      mockupId: defaults.mockupId,
      wallColor: defaults.wallColor,
      frameStroke: defaults.frameStroke,
      draftTextColor: defaults.draftTextColor,
    }));
  };

  const handleApplyStroke = () => {
    const raw = String(strokeHexDraft || "").trim();
    if (!raw) {
      patchDraft({ frameStroke: getStudioMockup(mockupId).defaultStroke });
      setStrokeHexDraft(getStudioMockup(mockupId).defaultStroke || "");
      setError("");
      return;
    }
    const next = normalizeStudioFrameStroke(raw);
    if (!next) {
      setError(t("studio.invalidWallColor"));
      return;
    }
    setError("");
    patchDraft({ frameStroke: next });
    setStrokeHexDraft(next);
  };

  const handleLogoFile = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError(t("studio.invalidLogo"));
      return;
    }
    if (file.size > STUDIO_LOGO_MAX_BYTES) {
      setError(t("studio.logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        setError(t("studio.invalidLogo"));
        return;
      }
      setError("");
      patchDraft({ draftLogoDataUrl: dataUrl });
    };
    reader.onerror = () => setError(t("studio.invalidLogo"));
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleVisualize = () => {
    const nextWall = normalizeWallColor(wallHexDraft);
    if (String(wallHexDraft || "").trim() && !nextWall) {
      setError(t("studio.invalidWallColor"));
      return;
    }
    let nextStroke = draft.frameStroke;
    if (useChrome) {
      const strokeRaw = String(strokeHexDraft || "").trim();
      if (strokeRaw) {
        const normalized = normalizeStudioFrameStroke(strokeRaw);
        if (!normalized) {
          setError(t("studio.invalidWallColor"));
          return;
        }
        nextStroke = normalized;
        setStrokeHexDraft(normalized);
      }
    }
    setDraft((prev) => ({
      ...prev,
      wallColor: nextWall || prev.wallColor,
      frameStroke: useChrome ? nextStroke : null,
      phase: "view",
    }));
    if (nextWall) setWallHexDraft(nextWall);
  };

  const handleResetSession = () => {
    const empty = emptyStudioSessionDraft();
    setDraft(empty);
    setUrlDraft("");
    setWallHexDraft("");
    setStrokeHexDraft("");
    setTextHexDraft(STUDIO_DEFAULT_TEXT_COLOR);
    setError("");
  };

  const phaseTitle = {
    embed: t("studio.phaseEmbedTitle"),
    aspect: t("studio.phaseAspectTitle"),
    mockup: t("studio.phaseMockupTitle"),
    wall: t("studio.phaseWallTitle"),
    view: t("studio.phaseViewTitle"),
  }[phase];

  const phaseLede = {
    embed: t("studio.phaseEmbedLede"),
    aspect: t("studio.phaseAspectLede"),
    mockup: t("studio.phaseMockupLede"),
    wall: t("studio.phaseWallLede"),
    view: t("studio.phaseViewLede"),
  }[phase];

  const stepIndex = PHASE_ORDER.indexOf(phase);

  const videoPlayer = hasVideo ? (
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
  );

  return (
    <div
      className={
        "studio-workspace"
        + (isView ? " studio-workspace--view" : "")
        + (isView && useXFeed ? " studio-workspace--mockup-x" : "")
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
          {phaseLede ? (
            <p className="studio-workspace__lede">{phaseLede}</p>
          ) : null}
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
              <span className="studio-workspace__upload-info-title">
                {t("studio.embedInfoTitle")}
              </span>
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
              onClick={() => goPhase("mockup")}
            >
              {t("studio.continue")}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "mockup" ? (
        <div className="studio-workspace__setup">
          <div
            className="studio-workspace__mockup-grid studio-workspace__mockup-grid--thumbs"
            role="listbox"
            aria-label={t("studio.mockupLabel")}
          >
            {STUDIO_MOCKUPS.map((m) => {
              const selected = mockupId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${t(`studio.${m.labelKey}`)}. ${t(`studio.${m.descKey}`)}`}
                  title={t(`studio.${m.labelKey}`)}
                  className={
                    "studio-workspace__mockup-card studio-workspace__mockup-card--image"
                    + (selected ? " is-selected" : "")
                  }
                  onClick={() => handleSelectMockup(m.id)}
                >
                  <span className="studio-workspace__mockup-thumb" aria-hidden>
                    <MockupThumb id={m.id} />
                  </span>
                  <span className="studio-workspace__mockup-copy">
                    <span className="studio-workspace__mockup-name">
                      {t(`studio.${m.labelKey}`)}
                    </span>
                    <span className="studio-workspace__mockup-desc">
                      {t(`studio.${m.descKey}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
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
              onClick={() => goPhase("wall")}
            >
              {t("studio.continue")}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "wall" ? (
        <div className="studio-workspace__setup studio-workspace__setup--wall">
          <div className="studio-workspace__inspector studio-workspace__inspector--wall">
            <div
              className="studio-workspace__inspector-panel"
              role="group"
              aria-label={t("studio.colorPickersAria")}
            >
              <span className="studio-workspace__inspector-heading">{t("studio.colorsHeading")}</span>
              <label className="studio-workspace__inspector-row">
                <span className="studio-workspace__inspector-label">{t("studio.wallColorLabel")}</span>
                <span className="studio-workspace__inspector-control">
                  <input
                    type="color"
                    className="studio-workspace__inspector-well"
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
                    className="studio-workspace__inspector-hex"
                    type="text"
                    value={wallHexDraft}
                    placeholder={t("studio.wallColorPlaceholder")}
                    spellCheck={false}
                    onChange={(e) => setWallHexDraft(e.target.value)}
                    onBlur={() => {
                      const next = normalizeWallColor(wallHexDraft);
                      if (String(wallHexDraft || "").trim() && !next) {
                        setError(t("studio.invalidWallColor"));
                        return;
                      }
                      setError("");
                      patchDraft({ wallColor: next });
                      setWallHexDraft(next || "");
                    }}
                  />
                </span>
              </label>

              <label className="studio-workspace__inspector-row">
                <span className="studio-workspace__inspector-label">{t("studio.textColorLabel")}</span>
                <span className="studio-workspace__inspector-control">
                  <input
                    type="color"
                    className="studio-workspace__inspector-well"
                    value={textPreview}
                    aria-label={t("studio.textColorLabel")}
                    onChange={(e) => {
                      const next = normalizeWallColor(e.target.value);
                      setTextHexDraft(next || STUDIO_DEFAULT_TEXT_COLOR);
                      patchDraft({ draftTextColor: next });
                      setError("");
                    }}
                  />
                  <input
                    className="studio-workspace__inspector-hex"
                    type="text"
                    value={textHexDraft}
                    placeholder={t("studio.textColorPlaceholder")}
                    spellCheck={false}
                    onChange={(e) => setTextHexDraft(e.target.value)}
                    onBlur={() => {
                      const next = normalizeWallColor(textHexDraft);
                      if (String(textHexDraft || "").trim() && !next) {
                        setError(t("studio.invalidWallColor"));
                        return;
                      }
                      setError("");
                      patchDraft({ draftTextColor: next });
                      setTextHexDraft(next || STUDIO_DEFAULT_TEXT_COLOR);
                    }}
                  />
                </span>
              </label>

              {useChrome ? (
                <label className="studio-workspace__inspector-row">
                  <span className="studio-workspace__inspector-label">{t("studio.frameStrokeLabel")}</span>
                  <span className="studio-workspace__inspector-control">
                    <input
                      type="color"
                      className="studio-workspace__inspector-well"
                      value={strokePreview || "#191A1C"}
                      aria-label={t("studio.frameStrokeLabel")}
                      onChange={(e) => {
                        const next = normalizeStudioFrameStroke(e.target.value);
                        setStrokeHexDraft(next || "#191A1C");
                        patchDraft({ frameStroke: next });
                        setError("");
                      }}
                    />
                    <input
                      className="studio-workspace__inspector-hex"
                      type="text"
                      value={strokeHexDraft}
                      placeholder={t("studio.frameStrokePlaceholder")}
                      spellCheck={false}
                      onChange={(e) => setStrokeHexDraft(e.target.value)}
                      onBlur={() => handleApplyStroke()}
                    />
                  </span>
                </label>
              ) : null}
            </div>

            {useIdentity ? (
              <div className="studio-workspace__inspector-panel studio-workspace__identity">
                <span className="studio-workspace__inspector-heading">{t("studio.identityLabel")}</span>
                <div className="studio-workspace__logo-row">
                  {draft.draftLogoDataUrl ? (
                    <img
                      className="studio-workspace__logo-preview"
                      src={draft.draftLogoDataUrl}
                      alt=""
                    />
                  ) : (
                    <span className="studio-workspace__logo-empty" aria-hidden />
                  )}
                  <button
                    type="button"
                    className="studio-workspace__secondary"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {t("studio.logoUpload")}
                  </button>
                  {draft.draftLogoDataUrl ? (
                    <button
                      type="button"
                      className="studio-workspace__secondary"
                      onClick={() => patchDraft({ draftLogoDataUrl: null })}
                    >
                      {t("studio.logoClear")}
                    </button>
                  ) : null}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleLogoFile(e.target.files)}
                  />
                </div>
                <label className="studio-workspace__field">
                  <span className="studio-workspace__inspector-label">{t("studio.displayNameLabel")}</span>
                  <input
                    className="studio-workspace__url-input"
                    type="text"
                    value={draft.draftDisplayName || ""}
                    placeholder={t("studio.displayNamePlaceholder")}
                    maxLength={80}
                    onChange={(e) => patchDraft({ draftDisplayName: e.target.value })}
                  />
                </label>
                <label className="studio-workspace__field">
                  <span className="studio-workspace__inspector-label">{t("studio.descriptionLabel")}</span>
                  <textarea
                    className="studio-workspace__desc-input studio-workspace__desc-input--compact"
                    value={draft.draftDescription || ""}
                    placeholder={t("studio.descriptionPlaceholder")}
                    maxLength={280}
                    rows={2}
                    onChange={(e) => patchDraft({ draftDescription: e.target.value })}
                  />
                </label>
              </div>
            ) : null}
          </div>
          {error ? (
            <p className="studio-workspace__error" role="alert">{error}</p>
          ) : null}
          <div className="studio-workspace__nav">
            <button
              type="button"
              className="studio-workspace__secondary"
              onClick={() => goPhase("mockup")}
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
            className={
              "studio-workspace__stage studio-workspace__stage--immersive studio-workspace__stage--noscroll"
              + (useXFeed ? " studio-workspace__stage--x" : "")
            }
            style={{ backgroundColor: wallPreview }}
          >
            {useXFeed ? (
              <StudioMockupX
                wallColor={wallPreview}
                frameStroke={strokePreview}
                textColor={textPreview}
                aspectCss={aspectCss}
                frameSizeClass={frameSizeClass}
                logoDataUrl={draft.draftLogoDataUrl}
                displayName={draft.draftDisplayName}
                description={draft.draftDescription}
                adLabel={t("studio.adTag")}
              >
                {videoPlayer}
              </StudioMockupX>
            ) : (
              <div
                className={`studio-workspace__frame ${frameSizeClass}`}
                style={{ aspectRatio: aspectCss }}
              >
                {videoPlayer}
              </div>
            )}
          </div>
          <div className="studio-workspace__view-bar">
            <span className="studio-workspace__view-meta">
              {t(`studio.${studioAspectLabelKey(draft.aspectRatio)}`)}
              {" · "}
              {t(`studio.${getStudioMockup(mockupId).labelKey}`)}
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
