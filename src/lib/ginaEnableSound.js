/** Gina chat open SFX — also plays when the day / schedule sheet appears in chat. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const GINA_ENABLE_SOUND_SRC = "/Sounds/Enable.wav";

/** Fallback if metadata / play fails (clip is ~1.65s). */
const FALLBACK_DURATION_MS = 1800;

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_ENABLE_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.9;
  }
  return sharedAudio;
}

/**
 * Play Gina enable sound and resolve when it finishes (or immediately if muted / blocked).
 * @returns {Promise<void>}
 */
export function playGinaEnableSound() {
  if (isAppSoundMuted()) {
    return Promise.resolve();
  }
  const audio = getSharedAudio();
  if (!audio) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    const onEnded = () => finish();
    const onError = () => finish();

    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.ceil(audio.duration * 1000) + 80
      : FALLBACK_DURATION_MS;
    const fallbackTimer = window.setTimeout(finish, durationMs + 500);

    try {
      audio.muted = false;
      audio.volume = 0.9;
      audio.currentTime = 0;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      const p = audio.play();
      if (p?.catch) {
        p.catch(() => finish());
      }
    } catch {
      finish();
    }
  });
}
