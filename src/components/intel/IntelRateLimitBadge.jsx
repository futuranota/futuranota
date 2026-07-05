import { useEffect, useState } from "react";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import {
  formatRateLimitClock,
  rateLimitProgress,
} from "../../lib/intelRateLimitCooldown.js";
import { useI18n } from "../../i18n/useI18n.js";

const RING_R = 13;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Minimal cooldown ring — top-right of Intel search card.
 */
export function IntelRateLimitBadge() {
  const { t } = useI18n();
  const until = useUIStateStore((s) => s.intelRateLimitUntil);
  const totalSec = useUIStateStore((s) => s.intelRateLimitTotalSec);
  const clearCooldown = useUIStateStore((s) => s.clearIntelRateLimitCooldown);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (!until) {
      setRemainingSec(0);
      return undefined;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) clearCooldown();
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [until, clearCooldown]);

  if (!until || remainingSec <= 0) return null;

  const progress = rateLimitProgress(totalSec, remainingSec);
  const dashOffset = RING_C * (1 - progress);

  return (
    <div
      className="intel-rate-badge"
      role="timer"
      aria-live="polite"
      aria-label={t("intel.rateLimitWaitAria", { time: formatRateLimitClock(remainingSec) })}
      title={t("intel.rateLimitWaitHint")}
    >
      <svg
        className="intel-rate-badge__ring"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        aria-hidden
      >
        <circle
          className="intel-rate-badge__track"
          cx="16"
          cy="16"
          r={RING_R}
          fill="none"
        />
        <circle
          className="intel-rate-badge__progress"
          cx="16"
          cy="16"
          r={RING_R}
          fill="none"
          strokeDasharray={RING_C}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 16 16)"
        />
      </svg>
      <span className="intel-rate-badge__time">{formatRateLimitClock(remainingSec)}</span>
    </div>
  );
}
