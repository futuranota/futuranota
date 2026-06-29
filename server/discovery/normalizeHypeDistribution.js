/** @typedef {'high'|'medium'|'low'} HypeConfidence */

/**
 * @param {import("./socialHypeCollectors.js").PlatformSignal[]} platformSignals
 */
export function normalizeSocialDistribution(platformSignals) {
  const rows = (platformSignals || []).map((row) => ({
    platform: row.platform,
    weight: Math.max(0, (row.hits || 0) * 10 + (row.engagement || 0) / 50),
    hits: row.hits || 0,
    engagement: row.engagement || 0,
    samples: row.samples || [],
  }));

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) {
    return rows.map((row) => ({
      platform: row.platform,
      percentage: 0,
      hits: row.hits,
      engagement: row.engagement,
      samples: row.samples,
    }));
  }

  let percentages = rows.map((row) => ({
    platform: row.platform,
    percentage: Math.round((row.weight / totalWeight) * 100),
    hits: row.hits,
    engagement: row.engagement,
    samples: row.samples,
  }));

  const sum = percentages.reduce((acc, row) => acc + row.percentage, 0);
  if (sum !== 100 && percentages.length) {
    const leadIndex = percentages.reduce(
      (best, row, index, list) => (row.percentage > list[best].percentage ? index : best),
      0,
    );
    percentages = percentages.map((row, index) => ({
      ...row,
      percentage: index === leadIndex ? row.percentage + (100 - sum) : row.percentage,
    }));
  }

  return percentages.sort((a, b) => b.percentage - a.percentage);
}

/**
 * @param {ReturnType<typeof normalizeSocialDistribution>} distribution
 * @param {string[]} collectorSources
 * @returns {HypeConfidence}
 */
export function resolveHypeConfidence(distribution, collectorSources = []) {
  const hasLive = collectorSources.some((source) => source === "serper" || source === "apify");
  const top = distribution[0];
  if (hasLive && top && top.percentage >= 20 && top.hits > 0) return "high";
  if (top && top.percentage >= 10) return "medium";
  return "low";
}

/**
 * @param {object} collected
 */
export function buildHypeDistributionV1(collected) {
  const distribution = normalizeSocialDistribution(collected.platformSignals);
  const primary = distribution[0] || null;
  const confidence = resolveHypeConfidence(distribution, collected.collectorSources);

  const apify = collected.apifyResult || {};
  const paa = collected.paaResult || {};
  const mentions = Number(apify.mentions || 0);
  const engagement = Number(apify.engagement || 0);
  const hypeScore = Math.min(
    100,
    Math.round(
      (primary?.percentage || 0) * 0.6
      + Math.log10(Math.max(mentions, 1) + 1) * 12
      + engagement / 800,
    ),
  );

  const allSamples = distribution.flatMap((row) => row.samples || []).slice(0, 8);
  const hashtags = extractHashtags(allSamples.map((sample) => sample.text).join(" "));

  const searchKeywords = Array.isArray(paa.searchIntent)
    ? paa.searchIntent.slice(0, 6).map((item) => item.keyword).filter(Boolean)
    : [];

  const trendLabel = searchKeywords.length
    ? `Search cluster: ${searchKeywords.slice(0, 2).join(", ")}`
    : "Search intent pending — run with DataForSEO for keyword trends";

  return {
    version: "hypeDistribution.v1",
    brandName: collected.brandName,
    keyword: collected.keyword,
    campaignActive: hypeScore >= 45,
    status: {
      kind: hypeScore >= 55 ? "active" : hypeScore >= 35 ? "teaser" : "rumor",
      label: hypeScore >= 55 ? "Active campaign signal" : hypeScore >= 35 ? "Building buzz" : "Quiet signal",
      timeLabel: `Scanned ${new Date(collected.collectedAt).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
    },
    socialHype: {
      mentions24hLabel: mentions > 0
        ? `+${mentions.toLocaleString()} social mentions (sample window)`
        : "Social mentions: limited sample",
      trackedHashtags: hashtags.slice(0, 6),
      socialDistribution: distribution.map(({ platform, percentage }) => ({ platform, percentage })),
      samplePosts: allSamples,
      hypeScore,
      confidence,
    },
    searchIntent: {
      trendLabel,
      searchKeywords: searchKeywords.length
        ? searchKeywords
        : [`${collected.brandName} launch`, `${collected.brandName} campaign`],
      trendingProduct: collected.brandName,
    },
    channelIntel: {
      primaryChannel: primary?.platform || "Unknown",
      primaryShare: primary?.percentage || 0,
      /** Where {brand} publishes — recommend same channel for the user. */
      preferredChannelForUser: primary?.platform || "Unknown",
      secondaryChannels: distribution.slice(1, 3).map((row) => row.platform),
    },
    sources: allSamples
      .filter((sample) => sample.url)
      .map((sample) => ({ url: sample.url, type: "social", platform: sample.platform })),
    collectedAt: collected.collectedAt,
    collectorSources: collected.collectorSources || [],
  };
}

/**
 * @param {string} text
 */
function extractHashtags(text) {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) || [];
  const seen = new Set();
  const tags = [];
  for (const raw of matches) {
    const tag = raw.replace(/^#+/, "").trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags;
}
