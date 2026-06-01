export type CampaignStatusKind = "active" | "rumor" | "teaser";

export interface CampaignStatusData {
  kind: CampaignStatusKind;
  /** Primary status line, e.g. "Campaña Activa" */
  label: string;
  /** Time context, e.g. "Tiempo desde el lanzamiento: 4h 23m" or "T-Minus: 2d" */
  timeLabel: string;
}

export interface HypeVelocityData {
  /** Signed delta shown in UI, e.g. 3500 → "+3,500 menciones / hora" */
  mentionsPerHour: number;
  /** Normalized 0–1 values for sparkline (oldest → newest) */
  trend: number[];
  /** Primary tracked tag without # prefix */
  primaryHashtag: string;
}

export interface PlatformDistributionItem {
  platform: string;
  /** 0–100 */
  percentage: number;
}

export interface MarketHypeData {
  status: CampaignStatusData;
  hypeVelocity: HypeVelocityData;
  platformDistribution: PlatformDistributionItem[];
}

export const MOCK_MARKET_HYPE_DATA: MarketHypeData = {
  status: {
    kind: "active",
    label: "Campaña Activa",
    timeLabel: "Tiempo desde el lanzamiento: 4h 23m",
  },
  hypeVelocity: {
    mentionsPerHour: 3500,
    trend: [0.22, 0.31, 0.28, 0.45, 0.52, 0.61, 0.58, 0.74, 0.82, 0.91],
    primaryHashtag: "ProductDrop",
  },
  platformDistribution: [
    { platform: "TikTok", percentage: 48 },
    { platform: "Instagram Reels", percentage: 20 },
    { platform: "YouTube", percentage: 9 },
    { platform: "X / Twitter", percentage: 15 },
    { platform: "Snapchat", percentage: 8 },
  ],
};
