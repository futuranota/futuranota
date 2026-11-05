/** Soft VAD for teleprompter Voice mode (energy only — not speech-to-text). */

export const VAD_THRESHOLD = 0.028;
export const VOICE_CPS = 12;

/**
 * @typedef {{ stream: MediaStream, ctx: AudioContext, analyser: AnalyserNode, data: Uint8Array }} VadSession
 */

/**
 * @returns {Promise<VadSession>}
 */
export async function openVadMic() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available in this browser.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;
  source.connect(analyser);
  return {
    stream,
    ctx,
    analyser,
    data: new Uint8Array(analyser.fftSize),
  };
}

/**
 * Normalized RMS 0..1 from the time-domain buffer.
 * @param {VadSession | null | undefined} session
 * @returns {number}
 */
export function vadLevel(session) {
  if (!session?.analyser || !session.data) return 0;
  session.analyser.getByteTimeDomainData(session.data);
  let sum = 0;
  for (let i = 0; i < session.data.length; i += 1) {
    const centered = (session.data[i] - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / session.data.length);
}

/**
 * @param {VadSession | null | undefined} session
 */
export function closeVadMic(session) {
  if (!session) return;
  try {
    session.stream?.getTracks?.().forEach((track) => track.stop());
  } catch {
    /* ignore */
  }
  try {
    if (session.ctx && session.ctx.state !== 'closed') {
      void session.ctx.close();
    }
  } catch {
    /* ignore */
  }
}
