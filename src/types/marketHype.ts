export type CampaignStatusKind = "active" | "rumor" | "teaser";

export interface CampaignStatusData {
  kind: CampaignStatusKind;
  label: string;
  timeLabel: string;
}

export interface SocialDistributionItem {
  platform: string;
  /** 0–100 */
  percentage: number;
}

export interface SocialHypeData {
  /** e.g. "+12,400 mentions / 24hrs" */
  mentions24hLabel: string;
  /** Hashtag tokens without leading # */
  trackedHashtags: string[];
  socialDistribution: SocialDistributionItem[];
}

export interface SearchIntentData {
  trendLabel: string;
  searchKeywords: string[];
  /** Used to suggest geo-localized keyword combos */
  trendingProduct?: string;
}

export interface MarketHypeData {
  status: CampaignStatusData;
  socialHype: SocialHypeData;
  searchIntent: SearchIntentData;
}

export const MOCK_MARKET_HYPE_DATA: MarketHypeData = {
  status: {
    kind: "active",
    label: "Campaña Activa",
    timeLabel: "T+ 14h 20m",
  },
  socialHype: {
    mentions24hLabel: "+12,400 mentions / 24hrs",
    trackedHashtags: ["ProductDrop", "LaunchDay"],
    socialDistribution: [
      { platform: "TikTok", percentage: 60 },
      { platform: "Instagram", percentage: 30 },
      { platform: "X (Twitter)", percentage: 10 },
    ],
  },
  searchIntent: {
    trendLabel: "Tendencia de busqueda: +450% (Breakout)",
    trendingProduct: "Pixel 9 Pro Fold",
    searchKeywords: [
      "comprar [producto]",
      "alternativas a [producto]",
      "precio [producto]",
    ],
  },
};
