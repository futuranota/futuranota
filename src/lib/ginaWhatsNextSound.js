/** Gina “qué es lo siguiente…” clip (after leave-schedule / cancel re-agendar). */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const GINA_WHATS_NEXT_SOUND_SRC =
  "/Sounds/Que%20es%20lo%20siguiente%20que%20quieres%20hacer%20%3F%20.mp3";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_WHATS_NEXT_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.9;
  }
  return sharedAudio;
}

/** Play what’s-next clip once (respects mute). */
export function playGinaWhatsNextSound() {
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
      : 2500;
    const timer = window.setTimeout(finish, durationMs + 500);

    try {
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 0.9;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      const p = audio.play();
      if (p?.catch) p.catch(() => finish());
    } catch {
      finish();
    }
  });
}
