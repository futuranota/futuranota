/** Trash-box SFX — plays when a folder is deleted from the sidebar. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const TRASH_BOX_SOUND_SRC = "/uploads/sounds-effects/trash%20box.wav";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(TRASH_BOX_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.85;
  }
  return sharedAudio;
}

/** Play the trash-box sound. Safe to call from a confirm gesture. */
export function playTrashBoxSound() {
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
