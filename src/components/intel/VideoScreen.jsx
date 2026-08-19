import { useCallback, useEffect, useRef } from "react";
import { normalizeEmbedSrcForPlayback } from "../../lib/videoEmbed.js";
import { loadYouTubeIframeApi } from "../../lib/youtubeIframeApi.js";

const PLAYBACK_TOGGLE_KEY = "KeyP"; // Alt + P pauses/resumes the video

function isYouTubeEmbedSrc(src) {
  try {
    const host = new URL(src).hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtube-nocookie.com";
  } catch {
    return false;
  }
}

/** Add the params the IFrame Player API needs, without touching persisted data. */
function withJsApiParams(src) {
  try {
    const url = new URL(src);
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", window.location.origin);
    return url.toString();
  } catch {
    return src;
  }
}

export function VideoScreen({
  title = "",
  titlePlaceholder = "Video",
  titleEditable = false,
  onTitleChange,
  onTitleBlur,
  autoFocusTitle = false,
  embedSrc = "",
  provider = "youtube",
  embedded = false,
  onBack,
}) {
  const titleInputRef = useRef(null);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const normalizedSrc = normalizeEmbedSrcForPlayback(embedSrc);
  const isYouTube = isYouTubeEmbedSrc(normalizedSrc);
  const playbackSrc = isYouTube ? withJsApiParams(normalizedSrc) : normalizedSrc;
  const hasVideo = Boolean(playbackSrc);
  const displayTitle = (title || "").trim() || titlePlaceholder;

  useEffect(() => {
    if (!titleEditable || !autoFocusTitle) return;
    const frame = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocusTitle, titleEditable]);

  useEffect(() => {
    if (!isYouTube || !iframeRef.current) return undefined;

    let cancelled = false;
    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !iframeRef.current) return;
        playerRef.current = new YT.Player(iframeRef.current);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // The iframe may already be gone (React unmount) — safe to ignore.
      }
      playerRef.current = null;
    };
  }, [isYouTube, playbackSrc]);

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player || typeof player.getPlayerState !== "function") return;
    const YT = window.YT;
    const state = player.getPlayerState();
    if (state === YT?.PlayerState?.PLAYING || state === YT?.PlayerState?.BUFFERING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, []);

  useEffect(() => {
    if (!isYouTube || !hasVideo) return undefined;

    const handleKeyDown = (event) => {
      if (!event.altKey || event.code !== PLAYBACK_TOGGLE_KEY) return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      togglePlayback();
    };

    // Capture phase so the shortcut works even while typing in the notes editor.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isYouTube, hasVideo, togglePlayback]);

  return (
    <section className="video-screen" aria-label="Video player">
      <header className="video-screen__header">
        {!embedded && onBack ? (
          <button
            type="button"
            className="video-screen__back"
            onClick={onBack}
            aria-label="Back"
          >
            ←
          </button>
        ) : null}
        <div className="video-screen__title-wrap">
          {titleEditable ? (
            <input
              ref={titleInputRef}
              type="text"
              className="video-screen__title-input"
              value={title}
              placeholder={titlePlaceholder}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onBlur={() => onTitleBlur?.()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Video title"
            />
          ) : (
            <span className="video-screen__title" title={displayTitle}>
              {displayTitle}
            </span>
          )}
        </div>
      </header>

      <div className="video-screen__stage">
        <div className="video-screen__frame">
          {hasVideo ? (
            <iframe
              ref={iframeRef}
              key={playbackSrc}
              className="video-screen__iframe"
              src={playbackSrc}
              title={displayTitle || "Embedded video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="video-screen__empty" role="status">
              Paste a YouTube or Vimeo link below to load the video.
            </p>
          )}
          {hasVideo && provider ? (
            <span className="video-screen__provider">{provider}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
