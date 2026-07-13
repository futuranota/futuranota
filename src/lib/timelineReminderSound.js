/** Timeline reminder SFX — short pop when the floating card appears. */

import { isAppSoundMuted } from "./appSoundPrefs.js";

export const TIMELINE_REMINDER_SOUND_SRC = "/uploads/sounds/pop-over.mp3";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;
let unlocked = false;
let lastPlayedKey = "";
let lastPlayedAt = 0;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(TIMELINE_REMINDER_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.9;
  }
  return sharedAudio;
}

/**
 * Call from a user gesture (e.g. Timeline alerts ON) so later autoplay is allowed.
 */
export function unlockTimelineReminderSound() {
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    audio.muted = true;
    const p = audio.play();
    if (p?.then) {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        unlocked = true;
      }).catch(() => {
        audio.muted = false;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      unlocked = true;
    }
  } catch {
    try {
      audio.muted = false;
    } catch {
      /* ignore */
    }
  }
}

/**
 * Play the pop-over SFX once per alertKey (deduped for React Strict Mode remounts).
 * @param {string} [alertKey]
 */
export function playTimelineReminderSound(alertKey = "") {
  if (isAppSoundMuted()) return;
  const audio = getSharedAudio();
  if (!audio) return;

  const now = Date.now();
  const key = String(alertKey || "");
  if (key && key === lastPlayedKey && now - lastPlayedAt < 2500) return;
  lastPlayedKey = key;
  lastPlayedAt = now;

  try {
    audio.muted = false;
    audio.volume = 0.9;
    audio.currentTime = 0;
    const p = audio.play();
    if (p?.catch) {
      p.catch(() => {
        // If blocked, try once more after a tiny unlock attempt.
        if (!unlocked) {
          unlockTimelineReminderSound();
        }
      });
    }
  } catch {
    /* ignore */
  }
}
