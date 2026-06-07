import { useEffect, useState } from "react";
import { parseVideoEmbedInput } from "../../../lib/videoEmbed.js";

export function VideoEmbedBlockView({ block, onChange }) {
  const [draft, setDraft] = useState(block?.rawInput || "");

  useEffect(() => {
    setDraft(block?.rawInput || "");
  }, [block?.rawInput, block?.id]);

  const commitInput = (value) => {
    const parsed = parseVideoEmbedInput(value);
    onChange?.({
      rawInput: parsed.rawInput,
      provider: parsed.provider,
      videoId: parsed.videoId,
      embedSrc: parsed.embedSrc,
      parseError: parsed.error,
    });
  };

  return (
    <div className="doc-video-embed-block">
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
        onBlur={() => commitInput(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commitInput(draft);
          }
        }}
      />
      {block?.parseError ? (
        <p className="doc-video-embed-block__error" role="alert">{block.parseError}</p>
      ) : null}
      {block?.embedSrc ? (
        <div className="doc-video-embed-block__preview">
          <iframe
            src={block.embedSrc}
            title={block.provider === "vimeo" ? "Vimeo preview" : "YouTube preview"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : null}
    </div>
  );
}
