import { useCallback, useEffect, useMemo, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { resolveVideoEmbedFromNodeContent } from "../../lib/videoEmbed.js";
import { VideoScreen } from "./VideoScreen.jsx";
import { VideoEmbedBar } from "./VideoEmbedBar.jsx";
import { NoteTaker } from "./NoteTaker.jsx";

const DEFAULT_VIDEO_TITLE = "Untitled";

export function VideoWorkspace({
  nodeId = null,
  searchQuery = "",
  parentDocId = null,
  blockIndex = null,
  companyObjectId = null,
  embedded = false,
  onClose,
}) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] : null));
  const updateNode = useNodesStore((s) => s.updateNode);
  const [localEmbed, setLocalEmbed] = useState(null);
  const [showEmbedBar, setShowEmbedBar] = useState(true);

  const nodeEmbed = useMemo(() => {
    if (node?.dataType !== NODE_DATA_TYPES.VIDEO) return null;
    return resolveVideoEmbedFromNodeContent(node.content);
  }, [node?.dataType, node?.content]);

  const activeEmbed = nodeEmbed || localEmbed;

  const resolvedTitle = useMemo(() => (
    node?.sourceQuery
    || node?.title
    || searchQuery
    || ""
  ).trim(), [node?.sourceQuery, node?.title, searchQuery]);

  const [draftTitle, setDraftTitle] = useState(resolvedTitle);

  useEffect(() => {
    setDraftTitle(resolvedTitle);
  }, [resolvedTitle, nodeId]);

  useEffect(() => {
    if (activeEmbed?.embedSrc) {
      setShowEmbedBar(false);
    }
  }, [activeEmbed?.embedSrc]);

  const persistTitle = useCallback((rawTitle) => {
    const trimmed = (rawTitle || "").trim() || DEFAULT_VIDEO_TITLE;
    if (!nodeId || !node) return;
    updateNode(nodeId, {
      title: trimmed,
      sourceQuery: trimmed,
    });
  }, [node, nodeId, updateNode]);

  const handleTitleChange = useCallback((value) => {
    setDraftTitle(value);
  }, []);

  const handleTitleBlur = useCallback(() => {
    persistTitle(draftTitle);
  }, [draftTitle, persistTitle]);

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
      <div className="video-workspace__player">
        <VideoScreen
          title={draftTitle}
          titlePlaceholder={DEFAULT_VIDEO_TITLE}
          titleEditable
          autoFocusTitle={!resolvedTitle.trim()}
          onTitleChange={handleTitleChange}
          onTitleBlur={handleTitleBlur}
          embedSrc={activeEmbed?.embedSrc || ""}
          provider={activeEmbed?.provider || "youtube"}
          embedded={embedded}
          onBack={embedded ? undefined : onClose}
        />
        {showEmbedBar ? (
          <VideoEmbedBar
            nodeId={nodeId}
            activeEmbedSrc={activeEmbed?.embedSrc || ""}
            onEmbedChange={handleEmbedLoaded}
          />
        ) : null}
      </div>
      <NoteTaker
        nodeId={nodeId}
        parentDocId={parentDocId}
        blockIndex={blockIndex}
        companyObjectId={companyObjectId}
        onClose={embedded ? undefined : onClose}
        inlineTodosEnabled
        titleEditable
        draftTitle={draftTitle}
        onDraftTitleChange={handleTitleChange}
        onDraftTitleBlur={handleTitleBlur}
        requireTargetFolder={!embedded}
        videoEmbed={activeEmbed}
      />
    </div>
  );
}
