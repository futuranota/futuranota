import { useMemo, useState } from "react";
import "../../styles/market-hype-tailwind.css";
import {
  formatHashtag,
  resolveForecastCity,
} from "../../lib/marketHypeHelpers";
import type { MarketHypeData } from "../../types/marketHype";
import { MOCK_MARKET_HYPE_DATA } from "../../types/marketHype";

export type { MarketHypeData } from "../../types/marketHype";
export { MOCK_MARKET_HYPE_DATA } from "../../types/marketHype";

type MarketHypeWidgetProps = {
  data?: MarketHypeData;
  today?: Date;
};

const STATUS_DOT: Record<
  MarketHypeData["status"]["kind"],
  string
> = {
  active: "bg-emerald-500/70 shadow-[0_0_8px_rgba(52,211,153,0.35)] animate-pulse",
  rumor: "bg-zinc-500/80",
  teaser: "bg-zinc-400/60",
};

function normalizeTag(raw: string) {
  return raw.trim().replace(/^#+/, "");
}

function KeywordPill({
  label,
  onRemove,
  onEdit,
}: {
  label: string;
  onRemove?: () => void;
  onEdit?: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  if (editing && onEdit) {
    return (
      <input
        type="text"
        className="min-w-[72px] max-w-[160px] rounded-md border border-white/15 bg-[#1A1A1A] px-2 py-1 text-xs text-gray-200 outline-none focus:border-white/25"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (next) onEdit(next);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(label);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span className="group inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#1A1A1A] px-2 py-1 text-xs text-gray-300">
      <button
        type="button"
        className="max-w-[140px] truncate text-left hover:text-gray-100"
        onClick={() => onEdit && setEditing(true)}
        title={onEdit ? "Click to edit" : undefined}
      >
        {label}
      </button>
      {onRemove ? (
        <button
          type="button"
          className="text-[10px] leading-none text-gray-500 hover:text-gray-300"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function AddPillButton({
  onClick,
  title,
}: {
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-md border border-dashed border-white/15 bg-[#1A1A1A] px-1.5 text-xs font-medium text-gray-400 hover:border-white/25 hover:text-gray-200"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      +
    </button>
  );
}

export function MarketHypeWidget({
  data = MOCK_MARKET_HYPE_DATA,
  today = new Date(),
}: MarketHypeWidgetProps) {
  const { status, socialHype, searchIntent } = data;
  const forecastCity = useMemo(() => resolveForecastCity(today), [today]);

  const [hashtags, setHashtags] = useState(() => [...socialHype.trackedHashtags]);
  const [keywords, setKeywords] = useState(() => [...searchIntent.searchKeywords]);
  const [hashtagDraft, setHashtagDraft] = useState("");
  const [showHashtagInput, setShowHashtagInput] = useState(false);

  const addHashtag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    setHashtags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setHashtagDraft("");
    setShowHashtagInput(false);
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212] p-3.5 font-sans text-[#e8e8e8]">
      <header className="border-b border-white/5 pb-3">
        <div className="mb-1 flex min-w-0 items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status.kind]}`}
            aria-hidden
          />
          <p className="min-w-0 truncate text-base font-semibold leading-tight text-white">
            {status.label}
          </p>
          <span className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
            Status
          </span>
        </div>
        <p className="mt-1 text-xs font-normal text-gray-500">{status.timeLabel}</p>
      </header>

      <section className="border-b border-white/10 py-3">
        <p className="mb-2 text-[11px] font-semibold tracking-tight text-gray-300">
          {socialHype.mentions24hLabel}
        </p>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {hashtags.map((tag) => (
            <KeywordPill
              key={tag}
              label={formatHashtag(tag)}
              onEdit={(next) => {
                const normalized = normalizeTag(next);
                if (!normalized) return;
                setHashtags((prev) =>
                  prev.map((t) => (t === tag ? normalized : t)),
                );
              }}
              onRemove={() => setHashtags((prev) => prev.filter((t) => t !== tag))}
            />
          ))}
          {showHashtagInput ? (
            <input
              type="text"
              className="h-[26px] min-w-[88px] max-w-[120px] rounded-md border border-white/15 bg-[#1A1A1A] px-2 text-xs text-gray-200 outline-none focus:border-white/25"
              placeholder="#tag"
              value={hashtagDraft}
              autoFocus
              onChange={(e) => setHashtagDraft(e.target.value)}
              onBlur={() => {
                if (hashtagDraft.trim()) addHashtag(hashtagDraft);
                else setShowHashtagInput(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHashtag(hashtagDraft);
                if (e.key === "Escape") {
                  setHashtagDraft("");
                  setShowHashtagInput(false);
                }
              }}
            />
          ) : (
            <AddPillButton
              onClick={() => setShowHashtagInput(true)}
              title="Add hashtag"
            />
          )}
        </div>
        {forecastCity ? (
          <p className="mb-2 text-[10px] text-gray-600">
            Geo · {forecastCity}
          </p>
        ) : null}

        <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
          Social Hype Distribution
        </h3>
        <ul className="space-y-2.5" role="list">
          {socialHype.socialDistribution.map((item) => (
            <li key={item.platform}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-normal text-gray-400">{item.platform}</span>
                <span className="shrink-0 font-medium tabular-nums text-gray-400">
                  {item.percentage}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gray-300"
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

      <section className="pt-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
          Search Intent &amp; Keywords
        </h3>
        <p className="mb-2 text-xs text-gray-400">{searchIntent.trendLabel}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {keywords.map((keyword) => (
            <KeywordPill
              key={keyword}
              label={keyword}
              onEdit={(next) => {
                const trimmed = next.trim();
                if (!trimmed) return;
                setKeywords((prev) =>
                  prev.map((k) => (k === keyword ? trimmed : k)),
                );
              }}
              onRemove={() => setKeywords((prev) => prev.filter((k) => k !== keyword))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
