/** Closed-box SFX — plays when a folder expands or collapses. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const CLOSED_BOX_SOUND_SRC = "/uploads/sounds-effects/closed_box.wav";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(CLOSED_BOX_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.85;
  }
  return sharedAudio;
}

/** Play the open/close folder sound. Safe to call from a click gesture. */
export function playClosedBoxSound() {
  if (isAppSoundMuted()) return;
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    audio.muted = false;
    audio.volume = 0.85;
    audio.currentTime = 0;
    const p = audio.play();
    if (p?.catch) p.catch(() => {});
  } catch {
    /* ignore autoplay / missing file */
  }
}
