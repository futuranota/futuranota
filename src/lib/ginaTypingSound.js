/** Gina AI typewriter SFX — loops while animated text runs, stops when done. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const GINA_TYPING_SOUND_SRC =
  "/Sounds/Typing On Desktop Keyboard Medium Fast.mp3";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;
let playing = false;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_TYPING_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.45;
    sharedAudio.loop = true;
  }
  return sharedAudio;
}

/** Loop keyboard typing while Gina's typewriter is running. */
export function startGinaTypingSound() {
  if (isAppSoundMuted() || playing) return;
  const audio = getSharedAudio();
  if (!audio) return;

  playing = true;
  try {
    audio.muted = false;
    audio.volume = 0.45;
    audio.loop = true;
    audio.currentTime = 0;
    const p = audio.play();
    if (p?.catch) {
      p.catch(() => {
        playing = false;
      });
    }
  } catch {
    playing = false;
  }
}

/** Stop typing SFX when the typewriter animation finishes or unmounts. */
export function stopGinaTypingSound() {
  playing = false;
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* ignore */
  }
}
