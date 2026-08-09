/** Gina recovery SFX — plays when overdue (red) highlight table is revealed. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const GINA_HIGHLIGHTS_SOUND_SRC = "/Sounds/highlights.mp3";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_HIGHLIGHTS_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.85;
  }
  return sharedAudio;
}

/** Play highlights once (fire-and-forget; respects mute). */
export function playGinaHighlightsSound() {
  if (isAppSoundMuted()) return Promise.resolve();
  const audio = getSharedAudio();
  if (!audio) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      window.clearTimeout(timer);
      resolve();
    };
    const onEnded = () => finish();
    const onError = () => finish();
    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.ceil(audio.duration * 1000) + 80
      : 1200;
    const timer = window.setTimeout(finish, durationMs + 500);

    try {
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 0.85;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      const p = audio.play();
      if (p?.catch) p.catch(() => finish());
    } catch {
      finish();
    }
  });
}
