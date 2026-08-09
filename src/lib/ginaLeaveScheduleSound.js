/** Gina leave-schedule ack clip (cancel re-agendar). */

import { isAppSoundMuted } from "./appSoundPrefs.js";

/** NFD “está” in on-disk filename — keep encodeURIComponent in sync with public/Sounds. */
export const GINA_LEAVE_SCHEDULE_SOUND_SRC =
  "/Sounds/Listo%20entonces%20dejamos%20el%20schedule%20como%20esta%CC%81%20por%20ahora.mp3";

/** @type {HTMLAudioElement | null} */
let sharedAudio = null;

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(GINA_LEAVE_SCHEDULE_SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.9;
  }
  return sharedAudio;
}

/** Play leave-schedule ack once (respects mute). */
export function playGinaLeaveScheduleSound() {
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
      : 3500;
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
