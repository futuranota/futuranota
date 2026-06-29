import { useState, useCallback, useMemo } from "react";
import { MarketHypeWidget } from "./MarketHypeWidget.tsx";
import { MOCK_MARKET_HYPE_DATA } from "../../types/marketHype";
import { marketHypeDataFromHypeDistribution } from "../../lib/agents/buildHypeReportBody.js";
import { runSocialHypeAnalyst } from "../../lib/agents/runSocialHypeAnalyst.js";
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
  const { t, locale } = useI18n();
  const objects = useObjectsStore((s) => s.objects);

  const cachedSnapshot = useMemo(() => {
    if (!parentObjectId) return null;
    const object = objects[parentObjectId];
    return object?.cadence?.hypeSnapshot || null;
  }, [objects, parentObjectId]);

  const initialData = useMemo(() => {
    const mapped = marketHypeDataFromHypeDistribution(cachedSnapshot);
    return mapped || MOCK_MARKET_HYPE_DATA;
  }, [cachedSnapshot]);

  const [widgetData, setWidgetData] = useState(initialData);
  const [preferredChannel, setPreferredChannel] = useState(
    () => cachedSnapshot?.channelIntel?.preferredChannelForUser
      || cachedSnapshot?.channelIntel?.primaryChannel
      || "",
  );
  const [whySameChannel, setWhySameChannel] = useState("");
  const [companionAction, setCompanionAction] = useState("");
  const [phase, setPhase] = useState(/** @type {"idle"|"loading"|"done"|"error"} */ ("idle"));
  const [error, setError] = useState("");

  const handleScan = useCallback(async () => {
    const brand = brandName.trim();
    if (!brand) {
      setError(t("intel.marketHypeNoBrand"));
      setPhase("error");
      return;
    }

    setPhase("loading");
    setError("");

    const result = await runSocialHypeAnalyst({
      brandName: brand,
      keyword: brand,
      parentObjectId,
      locale: locale === "es" ? "es" : "en",
    });

    if (result.status !== "success") {
      setError(result.message || t("intel.marketHypeScanError"));
      setPhase("error");
      return;
    }

    const mapped = marketHypeDataFromHypeDistribution(result.hypeDistribution);
    if (mapped) setWidgetData(mapped);

    setPreferredChannel(result.analystSections?.preferredChannel || "");
    setWhySameChannel(result.analystSections?.whySameChannel || "");
    setCompanionAction(result.analystSections?.companionAction || "");
    setPhase("done");
  }, [brandName, parentObjectId, locale, t]);

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
          disabled={!brandName.trim() || phase === "loading"}
          onClick={() => { void handleScan(); }}
        >
          {phase === "loading" ? t("intel.marketHypeScanning") : t("intel.marketHypeScan")}
        </button>
      </div>

      {error ? (
        <p className="intel-market-hype-panel__error">{error}</p>
      ) : null}

      {preferredChannel ? (
        <section className="intel-market-hype-panel__verdict">
          <p className="intel-market-hype-panel__verdict-label">
            {t("intel.marketHypePreferredChannel")}
          </p>
          <p className="intel-market-hype-panel__verdict-channel">{preferredChannel}</p>
          {whySameChannel ? (
            <p className="intel-market-hype-panel__verdict-copy">{whySameChannel}</p>
          ) : null}
          {companionAction ? (
            <p className="intel-market-hype-panel__verdict-action">{companionAction}</p>
          ) : null}
        </section>
      ) : null}

      <MarketHypeWidget data={widgetData} today={today} />
    </div>
  );
}
