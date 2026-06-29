import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketHypeWidget } from "./MarketHypeWidget.tsx";
import { AnimatedIntelLine } from "./AnimatedIntelLine.jsx";
import { marketHypeDataFromHypeDistribution } from "../../lib/agents/buildHypeReportBody.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import {
  resolveHypeSnapshotForCorpus,
  findLatestHypeDocForScope,
} from "../../lib/hypeSnapshot.js";
import {
  resolvePanelCorpusObjectId,
  isMarketHypeControlEnabled,
  readMarketHypePanelSaved,
  writeMarketHypePanelSaved,
  clearMarketHypePanelSaved,
} from "../../lib/panelAgentLoop.js";

/**
 * @param {object} props
 * @param {string} [props.brandName]
 * @param {string|null} [props.corpusObjectId]
 * @param {Date} [props.today]
 */
export function MarketHypePanel({
  brandName = "",
  corpusObjectId = null,
  today = new Date(),
}) {
  const { t } = useI18n();
  const objects = useObjectsStore((s) => s.objects);
  const docs = useDocsStore((s) => s.docs);

  const panelCorpusId = useMemo(
    () => resolvePanelCorpusObjectId(objects, corpusObjectId),
    [objects, corpusObjectId],
  );

  const persistedPanel = useMemo(
    () => readMarketHypePanelSaved(objects, panelCorpusId),
    [objects, panelCorpusId],
  );

  const canActivate = isMarketHypeControlEnabled(objects, panelCorpusId);
  const isSaved = Boolean(persistedPanel?.widgetData);
  const agentReadyAt = panelCorpusId
    ? objects[panelCorpusId]?.cadence?.hypeAgentReadyAt
    : null;

  const [panelCleared, setPanelCleared] = useState(false);

  useEffect(() => {
    setPanelCleared(false);
  }, [agentReadyAt, panelCorpusId]);

  const resolveSnapshotPayload = useCallback(() => {
    const fresh = resolveHypeSnapshotForCorpus(
      objects,
      panelCorpusId,
      docs,
      brandName,
      [panelCorpusId].filter(Boolean),
    );
    const fallbackDoc = fresh?.snapshot
      ? null
      : findLatestHypeDocForScope(docs, {
        corpusId: panelCorpusId,
        brandName,
        objectsById: objects,
      });
    const snap = fresh?.snapshot || fallbackDoc?.snapshot || null;
    let sections = fresh?.sections || null;
    if (!sections && panelCorpusId) {
      sections = objects[panelCorpusId]?.cadence?.hypeAnalystSections || null;
    }
    return { snap, sections };
  }, [objects, panelCorpusId, docs, brandName]);

  const buildPayloadFromSnapshot = useCallback(() => {
    const { snap, sections } = resolveSnapshotPayload();
    if (!snap) return null;
    const mapped = marketHypeDataFromHypeDistribution(snap);
    if (!mapped) return null;
    return {
      widgetData: mapped,
      preferredChannel: sections?.preferredChannel
        || snap.channelIntel?.preferredChannelForUser
        || snap.channelIntel?.primaryChannel
        || "",
      greetingIntro: sections?.greetingIntro || "",
      primaryReading: sections?.primaryReading || "",
      channelNuance: sections?.channelNuance || "",
    };
  }, [resolveSnapshotPayload]);

  const livePayload = useMemo(() => {
    if (!canActivate || isSaved || panelCleared) return null;
    return buildPayloadFromSnapshot();
  }, [canActivate, isSaved, panelCleared, buildPayloadFromSnapshot]);

  const [widgetData, setWidgetData] = useState(/** @type {import("../../types/marketHype.ts").MarketHypeData|null} */ (null));
  const [preferredChannel, setPreferredChannel] = useState("");
  const [greetingIntro, setGreetingIntro] = useState("");
  const [primaryReading, setPrimaryReading] = useState("");
  const [channelNuance, setChannelNuance] = useState("");

  useEffect(() => {
    if (!persistedPanel?.widgetData) return;
    setWidgetData(persistedPanel.widgetData);
    setPreferredChannel(persistedPanel.preferredChannel || "");
    setGreetingIntro(persistedPanel.greetingIntro || "");
    setPrimaryReading(persistedPanel.primaryReading || "");
    setChannelNuance(persistedPanel.channelNuance || "");
  }, [persistedPanel]);

  useEffect(() => {
    if (isSaved) return;
    setWidgetData(null);
    setPreferredChannel("");
    setGreetingIntro("");
    setPrimaryReading("");
    setChannelNuance("");
  }, [isSaved, panelCorpusId]);

  const handleSave = useCallback(() => {
    if (!canActivate || !panelCorpusId || isSaved) return;

    const payload = buildPayloadFromSnapshot();
    if (!payload?.widgetData) return;

    setPanelCleared(false);
    writeMarketHypePanelSaved(panelCorpusId, {
      widgetData: payload.widgetData,
      preferredChannel: payload.preferredChannel,
      greetingIntro: payload.greetingIntro,
      primaryReading: payload.primaryReading,
      channelNuance: payload.channelNuance,
    });
  }, [canActivate, panelCorpusId, isSaved, buildPayloadFromSnapshot]);

  const handleReset = useCallback(() => {
    if (!panelCorpusId) return;
    clearMarketHypePanelSaved(panelCorpusId);
    setPanelCleared(true);
    setWidgetData(null);
    setPreferredChannel("");
    setGreetingIntro("");
    setPrimaryReading("");
    setChannelNuance("");
  }, [panelCorpusId]);

  const savedPayload = isSaved
    ? {
      widgetData: widgetData || persistedPanel?.widgetData || null,
      preferredChannel: preferredChannel || persistedPanel?.preferredChannel || "",
      greetingIntro: greetingIntro || persistedPanel?.greetingIntro || "",
      primaryReading: primaryReading || persistedPanel?.primaryReading || "",
      channelNuance: channelNuance || persistedPanel?.channelNuance || "",
    }
    : null;

  const activePayload = savedPayload || livePayload;
  const animateTexts = Boolean(canActivate && livePayload && !isSaved);
  const showVerdict = Boolean(activePayload?.widgetData);
  const displayWidgetData = isSaved ? (savedPayload?.widgetData || null) : null;

  return (
    <div className="intel-market-hype-panel">
      <div className="intel-market-hype-panel__toolbar">
        <div className="intel-market-hype-panel__brand">
          {brandName
            ? t("intel.marketHypeBrandLabel", { brand: brandName })
            : t("intel.marketHypeSelectBrand")}
        </div>
        {canActivate && !isSaved ? (
          <button
            type="button"
            className="btn sm primary"
            onClick={handleSave}
          >
            {t("intel.marketHypeSave")}
          </button>
        ) : null}
      </div>

      {!canActivate ? (
        <p className="intel-market-hype-panel__hint">{t("intel.marketHypeRunAgentFirst")}</p>
      ) : isSaved ? (
        <p className="intel-market-hype-panel__hint">{t("intel.marketHypeSavedHint")}</p>
      ) : (
        <p className="intel-market-hype-panel__hint">{t("intel.marketHypeSaveHint")}</p>
      )}

      {showVerdict && activePayload ? (
        <section className="intel-market-hype-panel__verdict">
          {activePayload.greetingIntro ? (
            animateTexts ? (
              <AnimatedIntelLine
                text={activePayload.greetingIntro}
                className="intel-market-hype-panel__verdict-copy"
              />
            ) : (
              <p className="intel-market-hype-panel__verdict-copy">{activePayload.greetingIntro}</p>
            )
          ) : null}
          <p className="intel-market-hype-panel__verdict-label">
            {t("intel.marketHypePrimaryReading")}
          </p>
          {activePayload.preferredChannel ? (
            animateTexts ? (
              <AnimatedIntelLine
                text={activePayload.preferredChannel}
                className="intel-market-hype-panel__verdict-channel"
              />
            ) : (
              <p className="intel-market-hype-panel__verdict-channel">{activePayload.preferredChannel}</p>
            )
          ) : null}
          {activePayload.primaryReading ? (
            animateTexts ? (
              <AnimatedIntelLine
                text={activePayload.primaryReading}
                className="intel-market-hype-panel__verdict-copy"
              />
            ) : (
              <p className="intel-market-hype-panel__verdict-copy">{activePayload.primaryReading}</p>
            )
          ) : null}
          {activePayload.channelNuance ? (
            animateTexts ? (
              <AnimatedIntelLine
                text={activePayload.channelNuance}
                className="intel-market-hype-panel__verdict-action"
              />
            ) : (
              <p className="intel-market-hype-panel__verdict-action">{activePayload.channelNuance}</p>
            )
          ) : null}
        </section>
      ) : null}

      {displayWidgetData ? (
        <MarketHypeWidget data={displayWidgetData} today={today} />
      ) : null}

      {isSaved ? (
        <div className="intel-market-hype-panel__footer">
          <button
            type="button"
            className="btn sm"
            title={t("intel.marketHypeResetHint")}
            onClick={handleReset}
          >
            {t("intel.marketHypeReset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
