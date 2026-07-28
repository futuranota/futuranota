/** Per-keystroke SFX for moodboard sticky / Notes typing. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const LETTER_KEY_SOUND_SRC = "/Sounds/a-letter.m4a";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(LETTER_KEY_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.55;
  }
  return sharedAudio;
}

/**
 * True for keys that insert a character (letter, digit, space, punctuation).
 * Ignores modifiers, navigation, Backspace, Enter, etc.
 * @param {KeyboardEvent} event
 */
export function isLetterKeySoundKey(event) {
  if (!event || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.isComposing || event.key === "Process") return false;
  const key = event.key;
  if (!key || key.length !== 1) return false;
  return true;
}

/** Play the letter-key tick. Safe to call from a keydown gesture. */
export function playLetterKeySound() {
  if (isAppSoundMuted()) return;
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    audio.muted = false;
    audio.volume = 0.55;
    audio.currentTime = 0;
    const p = audio.play();
    if (p?.catch) p.catch(() => {});
  } catch {
    /* ignore autoplay / missing file */
  }
}
