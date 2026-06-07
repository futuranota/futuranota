import { useEffect, useState } from "react";
import { parseVideoEmbedInput } from "../../../lib/videoEmbed.js";

export function VideoEmbedBlockView({ block, onChange, onDelete }) {
  const [draft, setDraft] = useState(block?.rawInput || "");
  const embedSaved = Boolean(block?.embedSaved);
  const showPreview = embedSaved && block?.embedSrc;

  useEffect(() => {
    if (!embedSaved) {
      setDraft(block?.rawInput || "");
    }
  }, [block?.rawInput, block?.id, embedSaved]);

  const handleSave = () => {
    const parsed = parseVideoEmbedInput(draft);
    if (parsed.error || !parsed.embedSrc) {
      onChange?.({
        rawInput: parsed.rawInput,
        provider: parsed.provider,
        videoId: parsed.videoId,
        embedSrc: parsed.embedSrc,
        parseError: parsed.error || "Paste a valid YouTube or Vimeo URL.",
        embedSaved: false,
      });
      return;
    }
    onChange?.({
      rawInput: parsed.rawInput,
      provider: parsed.provider,
      videoId: parsed.videoId,
      embedSrc: parsed.embedSrc,
      parseError: null,
      embedSaved: true,
    });
  };

  const handleRemove = () => {
    setDraft("");
    onChange?.({
      rawInput: "",
      provider: "unknown",
      videoId: "",
      embedSrc: "",
      parseError: null,
      embedSaved: false,
    });
  };

  return (
    <div className="doc-video-embed-block">
      {!showPreview ? (
        <>
          <label className="doc-video-embed-block__label" htmlFor={`video-embed-${block.id}`}>
            Paste YouTube/Vimeo URL or embed code
          </label>
          <textarea
            id={`video-embed-${block.id}`}
            className="doc-video-embed-block__input"
            rows={3}
            placeholder="https://www.youtube.com/watch?v=… or &lt;iframe …&gt;"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          {block?.parseError ? (
            <p className="doc-video-embed-block__error" role="alert">{block.parseError}</p>
          ) : null}
          <div className="doc-video-embed-block__actions">
            {onDelete ? (
              <button
                type="button"
                className="doc-video-embed-block__delete"
                onClick={onDelete}
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              className="doc-video-embed-block__save"
              onClick={handleSave}
              disabled={!draft.trim()}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <div className="doc-video-embed-block__preview">
          <button
            type="button"
            className="doc-video-embed-block__remove"
            aria-label="Remove video"
            onClick={handleRemove}
          >
            ×
          </button>
          <iframe
            src={block.embedSrc}
            title={block.provider === "vimeo" ? "Vimeo preview" : "YouTube preview"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
