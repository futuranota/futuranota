/** Gina talk-request popover SFX — plays when the live notification appears. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const GINA_VOIP_CALL_SOUND_SRC = "/Sounds/voip-call.wav";

/** Fallback if metadata / play fails. */
const FALLBACK_DURATION_MS = 2500;

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_VOIP_CALL_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.9;
  }
  return sharedAudio;
}

/**
 * Play voip-call when the talk-request popover opens.
 * @returns {Promise<void>}
 */
export function playGinaVoipCallSound() {
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
