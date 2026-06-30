import { useEffect, useState } from "react";
import { useNodesStore } from "../../stores/nodesStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  mergeVideoNodeContent,
  normalizeVideoInputUrl,
  parseVideoEmbedInput,
  resolveVideoEmbedFromNodeContent,
} from "../../lib/videoEmbed.js";
import { canSpendCredits, getCreditsDisplay } from "../../lib/planConfig.js";
import { debitIntelCredit } from "../../lib/debitIntelCredit.js";
import { useI18n } from "../../i18n/useI18n.js";

const YOUTUBE_EMBED_CREDIT_COST = 1;

export function VideoEmbedBar({ nodeId = null, activeEmbedSrc = "", onEmbedChange }) {
  const { t } = useI18n();
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] : null));
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const profile = usePlanStore((s) => s.profile);
  const searchCount = usePlanStore((s) => s.profile.searchCount);
  const tokensBalance = usePlanStore((s) => s.profile.tokensBalance);
  const referralCreditsBalance = usePlanStore((s) => s.profile.referralCreditsBalance);
  const isFree = profile.plan !== "pro";
  const creditsDisplay = getCreditsDisplay({
    ...profile,
    searchCount,
    tokensBalance,
    referralCreditsBalance,
  });

  const isVideoNode = node?.dataType === NODE_DATA_TYPES.VIDEO;
  const savedEmbed = isVideoNode ? resolveVideoEmbedFromNodeContent(node?.content) : null;

  const [draft, setDraft] = useState(savedEmbed?.rawInput || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDraft(savedEmbed?.rawInput || "");
    setError("");
  }, [nodeId, savedEmbed?.rawInput, savedEmbed?.embedSrc]);

  const commitEmbed = async () => {
    if (loading) return;

    const normalizedDraft = normalizeVideoInputUrl(draft);
    if (normalizedDraft !== draft.trim()) {
      setDraft(normalizedDraft);
    }

    setLoading(true);
    setError("");

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 180));

      const parsed = parseVideoEmbedInput(normalizedDraft);
      if (parsed.error || !parsed.embedSrc) {
        setError(parsed.error || "Paste a valid YouTube or Vimeo URL.");
        return;
      }

      const chargedSrc = savedEmbed?.embedSrc || activeEmbedSrc || "";
      const isNewEmbed = !chargedSrc || chargedSrc !== parsed.embedSrc;

      if (isFree && isNewEmbed) {
        const liveProfile = usePlanStore.getState().profile;
        if (!canSpendCredits(liveProfile, YOUTUBE_EMBED_CREDIT_COST)) {
          setError(t("intel.youtubeNoCredits"));
          return;
        }
        const { ok } = await debitIntelCredit({
          creditCost: YOUTUBE_EMBED_CREDIT_COST,
          routeLabel: "YouTube embed",
          endpoint: "youtube/embed",
          meta: { videoId: parsed.videoId, provider: parsed.provider },
        });
        if (!ok) {
          setError(t("intel.youtubeNoCredits"));
          return;
        }
      }

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
    } finally {
      setLoading(false);
    }
  };

  const loadDisabled = !draft.trim() || loading || (isFree && !canSpendCredits(profile, YOUTUBE_EMBED_CREDIT_COST));

  return (
    <div
      className="video-embed-bar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="video-embed-bar__head">
        <label className="video-embed-bar__label" htmlFor="video-embed-bar-input">
          Embed link
        </label>
        {isFree ? (
          <span
            className="video-embed-bar__credits"
            aria-label={t("intel.youtubeCreditsAria", {
              remaining: creditsDisplay.counter,
              cap: creditsDisplay.cap,
            })}
          >
            {t("intel.youtubeCredits", {
              remaining: creditsDisplay.counter,
              cap: creditsDisplay.cap,
            })}
          </span>
        ) : null}
      </div>
      {isFree ? (
        <p className="video-embed-bar__hint">{t("intel.youtubeCreditsHint")}</p>
      ) : null}
      <div className="video-embed-bar__row">
        <input
          id="video-embed-bar-input"
          type="text"
          className="video-embed-bar__input"
          value={draft}
          placeholder="https:// or <iframe …>"
          disabled={loading}
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
          disabled={loadDisabled}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={commitEmbed}
        >
          {loading ? "Loading…" : "Load"}
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
