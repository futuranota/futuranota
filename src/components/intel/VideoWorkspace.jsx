import { useEffect, useMemo, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { resolveVideoEmbedFromNodeContent } from "../../lib/videoEmbed.js";
import { VideoScreen } from "./VideoScreen.jsx";
import { VideoEmbedBar } from "./VideoEmbedBar.jsx";
import { NoteTaker } from "./NoteTaker.jsx";

export function VideoWorkspace({
  nodeId = null,
  searchQuery = "",
  parentDocId = null,
  blockIndex = null,
  embedded = false,
  onClose,
}) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] : null));
  const [localEmbed, setLocalEmbed] = useState(null);
  const [showEmbedBar, setShowEmbedBar] = useState(true);

  const nodeEmbed = useMemo(() => {
    if (node?.dataType !== NODE_DATA_TYPES.VIDEO) return null;
    return resolveVideoEmbedFromNodeContent(node.content);
  }, [node?.dataType, node?.content]);

  const activeEmbed = nodeEmbed || localEmbed;

  useEffect(() => {
    if (activeEmbed?.embedSrc) {
      setShowEmbedBar(false);
    }
  }, [activeEmbed?.embedSrc]);

  const title = (
    searchQuery
    || node?.sourceQuery
    || node?.title
    || activeEmbed?.rawInput
    || "Video"
  ).trim();

  const handleEmbedLoaded = (parsed) => {
    if (!nodeId || node?.dataType !== NODE_DATA_TYPES.VIDEO) {
      setLocalEmbed(parsed);
    }
    setShowEmbedBar(false);
  };

  return (
    <div
      className={
        "video-workspace"
        + (embedded ? " video-workspace--embedded" : "")
      }
    >
      <VideoScreen
        title={title}
        embedSrc={activeEmbed?.embedSrc || ""}
        provider={activeEmbed?.provider || "youtube"}
        embedded={embedded}
        onBack={embedded ? undefined : onClose}
      />
      {showEmbedBar ? (
        <VideoEmbedBar nodeId={nodeId} onEmbedChange={handleEmbedLoaded} />
      ) : null}
      <NoteTaker
        nodeId={nodeId}
        parentDocId={parentDocId}
        blockIndex={blockIndex}
        onClose={embedded ? undefined : onClose}
      />
    </div>
  );
}
