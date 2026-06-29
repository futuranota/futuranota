import { useState, useCallback, useMemo, useEffect } from "react";
import { MarketHypeWidget } from "./MarketHypeWidget.tsx";
import { marketHypeDataFromHypeDistribution } from "../../lib/agents/buildHypeReportBody.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useObjectsStore } from "../../stores/objectsStore.js";

/**
 * @param {object} props
 * @param {string} [props.brandName]
 * @param {string|null} [props.parentObjectId]
 * @param {Date} [props.today]
 */
export function MarketHypePanel({
  brandName = "",
  parentObjectId = null,
  today = new Date(),
}) {
  const { t } = useI18n();
  const objects = useObjectsStore((s) => s.objects);

  const cachedSnapshot = useMemo(() => {
    if (!parentObjectId) return null;
    const object = objects[parentObjectId];
    return object?.cadence?.hypeSnapshot || null;
  }, [objects, parentObjectId]);

  const cachedSections = useMemo(() => {
    if (!parentObjectId) return null;
    const object = objects[parentObjectId];
    return object?.cadence?.hypeAnalystSections || null;
  }, [objects, parentObjectId]);

  const snapshotAt = useMemo(() => {
    if (!parentObjectId) return null;
    const object = objects[parentObjectId];
    return object?.cadence?.hypeSnapshotAt || cachedSnapshot?.collectedAt || null;
  }, [objects, parentObjectId, cachedSnapshot?.collectedAt]);

  const hasReportData = Boolean(cachedSnapshot?.socialHype);

  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [widgetData, setWidgetData] = useState(/** @type {import("../../types/marketHype.ts").MarketHypeData|null} */ (null));
  const [preferredChannel, setPreferredChannel] = useState("");
  const [greetingIntro, setGreetingIntro] = useState("");
  const [primaryReading, setPrimaryReading] = useState("");
  const [channelNuance, setChannelNuance] = useState("");

  useEffect(() => {
    setWidgetLoaded(false);
    setWidgetData(null);
    setPreferredChannel("");
    setGreetingIntro("");
    setPrimaryReading("");
    setChannelNuance("");
  }, [snapshotAt]);

  const handleInsertFromReport = useCallback(() => {
    if (!cachedSnapshot) return;

    const mapped = marketHypeDataFromHypeDistribution(cachedSnapshot);
    if (mapped) setWidgetData(mapped);

    setPreferredChannel(cachedSections?.preferredChannel || cachedSnapshot.channelIntel?.primaryChannel || "");
    setGreetingIntro(cachedSections?.greetingIntro || "");
    setPrimaryReading(cachedSections?.primaryReading || "");
    setChannelNuance(cachedSections?.channelNuance || "");
    setWidgetLoaded(true);
  }, [cachedSnapshot, cachedSections]);

  const insertDisabled = !brandName.trim() || !hasReportData;

  return (
    <div className="intel-market-hype-panel">
      <div className="intel-market-hype-panel__toolbar">
        <div className="intel-market-hype-panel__brand">
          {brandName
            ? t("intel.marketHypeBrandLabel", { brand: brandName })
            : t("intel.marketHypeSelectBrand")}
        </div>
        <button
          type="button"
          className="btn sm primary"
          disabled={insertDisabled}
          title={insertDisabled ? t("intel.marketHypeRunAgentFirst") : undefined}
          onClick={handleInsertFromReport}
        >
          {t("intel.marketHypeInsertFromReport")}
        </button>
      </div>

      {!hasReportData ? (
        <p className="intel-market-hype-panel__hint">{t("intel.marketHypeRunAgentFirst")}</p>
      ) : !widgetLoaded ? (
        <p className="intel-market-hype-panel__hint">{t("intel.marketHypeInsertHint")}</p>
      ) : null}

      {widgetLoaded && preferredChannel ? (
        <section className="intel-market-hype-panel__verdict">
          {greetingIntro ? (
            <p className="intel-market-hype-panel__verdict-copy">{greetingIntro}</p>
          ) : null}
          <p className="intel-market-hype-panel__verdict-label">
            {t("intel.marketHypePrimaryReading")}
          </p>
          <p className="intel-market-hype-panel__verdict-channel">{preferredChannel}</p>
          {primaryReading ? (
            <p className="intel-market-hype-panel__verdict-copy">{primaryReading}</p>
          ) : null}
          {channelNuance ? (
            <p className="intel-market-hype-panel__verdict-action">{channelNuance}</p>
          ) : null}
        </section>
      ) : null}

      {widgetLoaded && widgetData ? (
        <MarketHypeWidget data={widgetData} today={today} />
      ) : null}
    </div>
  );
}
