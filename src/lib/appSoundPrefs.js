/** App-wide SFX mute preference (sidebar trash/open, reminders, etc.). */

const STORAGE_KEY = "futuranota:app-sound-muted";

/** @returns {boolean} */
export function isAppSoundMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {boolean} muted */
export function setAppSoundMuted(muted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    window.dispatchEvent(new CustomEvent("futuranota:app-sound-muted", { detail: { muted: !!muted } }));
  } catch {
    /* private mode / quota */
  }
}
