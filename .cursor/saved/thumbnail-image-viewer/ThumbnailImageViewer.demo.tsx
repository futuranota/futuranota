// --- Demo ---
"use client";

import * as React from "react";
import ThumbnailImageViewer, { type State } from "./ThumbnailImageViewer.original";

const settings = { title: "Somewhere, slower." };
export const loopDuration = 6;

// Pure timeline: export frame n by passing n / 60. No timers or network calls.
export function showcase(time: number): State {
  const t = ((time % loopDuration) + loopDuration) % loopDuration;
  return { active: t < 1.2 ? 0 : t < 2.4 ? 1 : t < 3.6 ? 2 : t < 4.8 ? 3 : 0 };
}

export default function Demo(props: any = {}) {
  const { showcaseTime, ...incoming } = props;
  const merged = { ...settings, ...incoming };
  return (
    <div className="w-full min-h-[460px] flex items-center justify-center p-4 sm:p-6 bg-background">
      <ThumbnailImageViewer
        {...merged}
        state={showcaseTime === undefined ? incoming.state : showcase(showcaseTime)}
        seeking={showcaseTime !== undefined || incoming.seeking}
      />
    </div>
  );
}
