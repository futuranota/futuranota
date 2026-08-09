/** Gina notify-gate SFX — plays with “Gina quiere informarte algo” after the table delay. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const GINA_DOUBLE_BIP_SOUND_SRC = "/Sounds/A_quiet_double_beep__%231-1786295214829.wav";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_DOUBLE_BIP_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.85;
  }
  return sharedAudio;
}

/** Play double-bip once (fire-and-forget; respects mute). */
export function playGinaDoubleBipSound() {
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
      : 900;
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
