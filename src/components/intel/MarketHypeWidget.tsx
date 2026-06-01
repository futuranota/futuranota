import "../../styles/market-hype-tailwind.css";
import type { MarketHypeData } from "../../types/marketHype";
import { MOCK_MARKET_HYPE_DATA } from "../../types/marketHype";

export type { MarketHypeData } from "../../types/marketHype";
export { MOCK_MARKET_HYPE_DATA } from "../../types/marketHype";

type MarketHypeWidgetProps = {
  data?: MarketHypeData;
};

const STATUS_DOT: Record<
  MarketHypeData["status"]["kind"],
  string
> = {
  active: "bg-emerald-500/70 shadow-[0_0_8px_rgba(52,211,153,0.35)] animate-pulse",
  rumor: "bg-zinc-500/80",
  teaser: "bg-zinc-400/60",
};

const BAR_FILL = [
  "bg-white/30",
  "bg-white/20",
  "bg-white/12",
  "bg-white/8",
];

function formatMentionsPerHour(value: number) {
  const sign = value >= 0 ? "+" : "−";
  const abs = Math.abs(value);
  return `${sign}${abs.toLocaleString("en-US")} menciones / hora`;
}

function HypeSparkline({ trend }: { trend: number[] }) {
  if (!trend.length) return null;

  const width = 160;
  const height = 36;
  const pad = 2;
  const step = trend.length > 1 ? (width - pad * 2) / (trend.length - 1) : 0;

  const points = trend
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - v * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-9 w-full max-w-[160px] text-white/25"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function MarketHypeWidget({ data = MOCK_MARKET_HYPE_DATA }: MarketHypeWidgetProps) {
  const { status, hypeVelocity, platformDistribution } = data;

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212] p-4 font-sans text-[#e8e8e8]">
      {/* ── 1. Campaign status ── */}
      <header className="border-b border-white/10 pb-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status.kind]}`}
            aria-hidden
          />
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
            Status
          </span>
        </div>
        <p className="text-lg font-semibold text-white">{status.label}</p>
        <p className="mt-1 text-sm font-normal text-gray-500">{status.timeLabel}</p>
      </header>

      {/* ── 2. Hype velocity ── */}
      <section className="border-b border-white/10 py-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
          Hype Velocity
        </h3>
        <p className="text-2xl font-semibold tracking-tight text-white/95">
          {formatMentionsPerHour(hypeVelocity.mentionsPerHour)}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <HypeSparkline trend={hypeVelocity.trend} />
          <div
            className="h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-white/5"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-white/20 transition-all"
              style={{
                width: `${Math.min(100, Math.max(8, (hypeVelocity.trend.at(-1) ?? 0) * 100))}%`,
              }}
            />
          </div>
        </div>
        <span className="mt-3 inline-block rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-gray-400">
          #{hypeVelocity.primaryHashtag.replace(/^#/, "")}
        </span>
      </section>

      {/* ── 3. Platform distribution ── */}
      <section className="pt-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
          Ad Platform Volume
        </h3>
        <ul className="space-y-3" role="list">
          {platformDistribution.map((item, index) => (
            <li key={item.platform}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-normal text-gray-400">{item.platform}</span>
                <span className="font-medium tabular-nums text-gray-500">
                  {item.percentage}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${BAR_FILL[index] ?? BAR_FILL[BAR_FILL.length - 1]}`}
                  style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                  role="progressbar"
                  aria-valuenow={item.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.platform} ${item.percentage}%`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
