import { useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  mergeVideoNodeContent,
  parseVideoEmbedInput,
  resolveVideoEmbedFromNodeContent,
} from "../../lib/videoEmbed.js";

export function VideoEmbedBar({ nodeId = null, onEmbedChange }) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] : null));
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);

  const isVideoNode = node?.dataType === NODE_DATA_TYPES.VIDEO;
  const savedEmbed = isVideoNode ? resolveVideoEmbedFromNodeContent(node?.content) : null;

  const [draft, setDraft] = useState(savedEmbed?.rawInput || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(savedEmbed?.rawInput || "");
    setError("");
  }, [nodeId, savedEmbed?.rawInput, savedEmbed?.embedSrc]);

  const commitEmbed = () => {
    const parsed = parseVideoEmbedInput(draft);
    if (parsed.error || !parsed.embedSrc) {
      setError(parsed.error || "Paste a valid YouTube or Vimeo URL.");
      return;
    }

    setError("");

    if (isVideoNode && nodeId) {
      const liveNode = useNodesStore.getState().nodes[nodeId];
      const nextContent = mergeVideoNodeContent(liveNode?.content, {
        rawInput: parsed.rawInput,
        provider: parsed.provider,
        videoId: parsed.videoId,
        embedSrc: parsed.embedSrc,
      });
      updateNode(nodeId, { content: nextContent });
      if (liveNode?.parentDocId) {
        syncNodeToParentDoc(nodeId, liveNode.parentDocId);
      }
    }

    onEmbedChange?.(parsed);
  };

  return (
    <div className="video-embed-bar">
      <label className="video-embed-bar__label" htmlFor="video-embed-bar-input">
        Embed link
      </label>
      <div className="video-embed-bar__row">
        <input
          id="video-embed-bar-input"
          type="text"
          className="video-embed-bar__input"
          value={draft}
          placeholder="https:// or <iframe …>"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEmbed();
            }
          }}
        />
        <button
          type="button"
          className="video-embed-bar__load"
          disabled={!draft.trim()}
          onClick={commitEmbed}
        >
          Load
        </button>
      </div>
      {error ? (
        <p className="video-embed-bar__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
