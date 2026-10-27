// --- Component ---
"use client";

import * as React from "react";

export type GalleryImage = {
  src: string;
  alt: string;
  title: string;
  location?: string;
  credit?: string;
};

export type State = {
  active?: number;
  open?: boolean;
  expanded?: number;
  reveal?: number;
  previous?: number;
  blend?: number;
  selected?: string;
  query?: string;
  notice?: string;
  highlighted?: boolean;
};

export type Props = {
  title?: string;
  subtitle?: string;
  state?: State;
  onStateChange?: (state: State) => void;
  onAction?: (action: string) => void;
  seeking?: boolean;
  className?: string;
  images?: GalleryImage[];
};

const createPlaceholder = (bg1: string, bg2: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bg1}" />
          <stop offset="100%" stop-color="${bg2}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
      <circle cx="400" cy="210" r="75" fill="white" fill-opacity="0.15" />
      <path d="M0,380 L220,250 L440,390 L600,290 L800,410 L800,500 L0,500 Z" fill="white" fill-opacity="0.18" />
      <path d="M0,430 L310,330 L520,435 L800,355 L800,500 L0,500 Z" fill="white" fill-opacity="0.24" />
      <text x="400" y="472" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="white" fill-opacity="0.75" text-anchor="middle" letter-spacing="3">${label}</text>
    </svg>`
  )}`;

const sampleImages: GalleryImage[] = [
  {
    src: createPlaceholder("#1e293b", "#334155", "ALPINE WATERS"),
    alt: "A still alpine lake reflecting mountains and a small lakeside cabin",
    title: "A quieter kind of morning.",
    location: "Alpine waters / 01",
    credit: "Studio Six",
  },
  {
    src: createPlaceholder("#0f172a", "#1e3a8a", "HIGH COUNTRY"),
    alt: "An alpine valley and mountain peaks beneath scattered clouds",
    title: "Above the ordinary.",
    location: "High country / 02",
    credit: "Studio Six",
  },
  {
    src: createPlaceholder("#064e3b", "#0f766e", "OPEN WATER"),
    alt: "Ocean waves flowing toward a rugged coastline",
    title: "Where the land lets go.",
    location: "Open water / 03",
    credit: "Studio Six",
  },
  {
    src: createPlaceholder("#4c1d95", "#312e81", "VALLEY LIGHT"),
    alt: "Deer grazing in a meadow beneath a granite mountain",
    title: "A moment, undisturbed.",
    location: "Valley light / 04",
    credit: "Studio Six",
  },
];

function useStateValue(
  initial: State,
  controlled: State | undefined,
  notify: Props["onStateChange"],
) {
  const [local, update] = React.useState(initial);
  const value = controlled ?? local;
  const set = (patch: Partial<State>) => {
    const next = { ...value, ...patch };
    update(next);
    notify?.(next);
  };
  return [value, set] as const;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

function ChevronLeft({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function ThumbnailImageViewer({
  title = "Somewhere, slower.",
  subtitle = "Field notes from the places in between.",
  images = sampleImages,
  state,
  onStateChange,
  onAction,
  seeking = false,
  className = "",
}: Props) {
  const [v, set] = useStateValue({ active: 0 }, state, onStateChange);
  const active = clamp(v.active ?? 0, 0, Math.max(0, images.length - 1));
  const current = images[active];
  const tabs = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/:/g, "");

  const choose = (n: number) => {
    const next = (n + images.length) % Math.max(1, images.length);
    set({ active: next });
    onAction?.(images[next]?.title ?? "");
  };

  return (
    <section
      className={`w-full max-w-[760px] mx-auto rounded-2xl border border-border bg-card text-card-foreground p-6 sm:p-8 shadow-sm transition-colors ${className}`}
      data-seeking={seeking}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Collected / Vol. 01
          </span>
          <h2 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-foreground mt-1 mb-1">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground max-w-[380px] leading-relaxed">
            {subtitle}
          </p>
        </div>
        <div className="font-mono text-xs font-semibold text-foreground bg-muted/80 px-2.5 py-1 rounded-md border border-border/50 shrink-0">
          {String(active + 1).padStart(2, "0")}
          <span className="text-muted-foreground font-normal">
            {" "}
            / {String(images.length).padStart(2, "0")}
          </span>
        </div>
      </header>

      {/* Main Image Stage */}
      <div
        className="relative aspect-[16/10] rounded-xl overflow-hidden bg-muted isolate group shadow-inner border border-border/40"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
      >
        {current ? (
          <img
            key={current.src}
            src={current.src}
            alt={current.alt}
            draggable={false}
            className="w-full h-full object-cover select-none transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            No images to display.
          </div>
        )}

        {/* Bottom gradient vignette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Location badge */}
        {current?.location && (
          <span className="absolute left-4 sm:left-5 bottom-4 sm:bottom-5 text-white/90 text-[11px] sm:text-xs font-medium tracking-wide z-10 drop-shadow">
            {current.location}
          </span>
        )}

        {/* Navigation Buttons */}
        <div className="absolute right-4 bottom-4 flex items-center gap-1.5 z-10">
          <button
            type="button"
            aria-label="Previous image"
            disabled={images.length < 2}
            onClick={() => choose(active - 1)}
            className="w-8 h-8 rounded-full bg-background/90 text-foreground backdrop-blur-sm shadow flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none border border-border/30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            disabled={images.length < 2}
            onClick={() => choose(active + 1)}
            className="w-8 h-8 rounded-full bg-background/90 text-foreground backdrop-blur-sm shadow flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none border border-border/30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Caption & Credit Row */}
      <div className="flex items-center justify-between gap-4 my-4" aria-live="polite">
        <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
          {current?.title}
        </h3>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          Photograph / {current?.credit ?? "Collection"}
        </span>
      </div>

      {/* Thumbnails list */}
      <div
        className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 pt-1"
        role="tablist"
        aria-label="Choose photograph"
        ref={tabs}
        onKeyDown={(e) => {
          let next = active;
          if (e.key === "ArrowRight") next = (active + 1) % images.length;
          else if (e.key === "ArrowLeft") next = (active - 1 + images.length) % images.length;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = images.length - 1;
          else return;
          e.preventDefault();
          choose(next);
          tabs.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
        }}
      >
        {images.map((im, i) => {
          const isSelected = active === i;
          return (
            <button
              key={im.src || i}
              type="button"
              id={`${id}-tab-${i}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${id}-panel`}
              aria-label={im.title}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => choose(i)}
              className={`relative flex-1 min-w-[55px] max-w-[150px] aspect-[3/2] rounded-lg overflow-hidden transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100 shadow-sm"
                  : "opacity-50 hover:opacity-85 border border-border/60"
              }`}
            >
              <img src={im.src} alt="" draggable={false} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1.5 text-[9px] font-mono font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between gap-4 flex-wrap mt-6 pt-4 border-t border-border text-[11px] text-muted-foreground">
        <span>A small collection of open spaces.</span>
        <span>Use thumbnails or arrow keys</span>
      </footer>
    </section>
  );
}
