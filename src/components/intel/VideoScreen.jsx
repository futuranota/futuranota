import { useEffect, useRef } from "react";
import { normalizeEmbedSrcForPlayback } from "../../lib/videoEmbed.js";

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
  const playbackSrc = normalizeEmbedSrcForPlayback(embedSrc);
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
        {hasVideo ? (
          <iframe
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
    </section>
  );
}
