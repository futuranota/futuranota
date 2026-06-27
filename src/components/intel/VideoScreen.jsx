import { normalizeEmbedSrcForPlayback } from "../../lib/videoEmbed.js";

export function VideoScreen({ title = "Video", embedSrc = "", provider = "youtube", embedded = false, onBack }) {
  const playbackSrc = normalizeEmbedSrcForPlayback(embedSrc);
  const hasVideo = Boolean(playbackSrc);

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
          <span className="video-screen__title" title={title}>
            {title}
          </span>
        </div>
      </header>

      <div className="video-screen__stage">
        {hasVideo ? (
          <iframe
            className="video-screen__iframe"
            src={playbackSrc}
            title={title || "Embedded video"}
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
