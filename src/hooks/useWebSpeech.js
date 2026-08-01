import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API — STT (dictation) + TTS (read aloud).
 * Sustained dictation: continuous + interim until the user stops.
 */

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function normalizeSpeechError(err) {
  if (err == null) return "unknown";
  if (typeof err === "string") return err;
  if (typeof err === "object" && "error" in err && typeof err.error === "string") {
    return err.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return "unknown";
}

/**
 * @param {{ lang?: string }} [options]
 */
export function useWebSpeech(options = {}) {
  const lang = options.lang || "es-ES";
  const [isListening, setIsListening] = useState(false);

  const recognitionSupported = typeof window !== "undefined" && Boolean(getSpeechRecognitionCtor());
  const synthesisSupported = typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined";

  const recognitionRef = useRef(null);
  const langRef = useRef(lang);
  const startTimerRef = useRef(null);
  /** User still wants the session open (restart after Chrome pauses). */
  const wantListeningRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const callbacksRef = useRef({
    onResult: /** @type {null | Function} */ (null),
    onError: /** @type {null | Function} */ (null),
    onEnd: /** @type {null | Function} */ (null),
  });
  langRef.current = lang;

  const cancelSpeak = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const clearRecognitionHandlers = (rec) => {
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
  };

  const stopListening = useCallback((opts = {}) => {
    const mode = opts.mode === "stop" ? "stop" : "abort";
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    wantListeningRef.current = false;
    intentionalStopRef.current = true;

    const rec = recognitionRef.current;
    if (rec) {
      clearRecognitionHandlers(rec);
      try {
        if (mode === "stop" && typeof rec.stop === "function") rec.stop();
        else if (typeof rec.abort === "function") rec.abort();
        else rec.stop?.();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => () => {
    stopListening({ mode: "abort" });
    cancelSpeak();
  }, [stopListening, cancelSpeak]);

  const startListening = useCallback(({ onResult, onError, onEnd } = {}) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.("unsupported");
      return;
    }

    callbacksRef.current = { onResult, onError, onEnd };
    cancelSpeak();
    stopListening({ mode: "abort" });

    intentionalStopRef.current = false;
    wantListeningRef.current = true;

    const begin = () => {
      if (!wantListeningRef.current) return;

      const recognition = new Ctor();
      recognition.lang = langRef.current;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        let finals = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i]?.[0]?.transcript || "";
          if (event.results[i].isFinal) finals += piece;
          else interim += piece;
        }
        const finalTrim = finals.trim();
        const interimTrim = interim.trim();
        if (!finalTrim && !interimTrim) return;
        callbacksRef.current.onResult?.({
          finalText: finalTrim,
          interimText: interimTrim,
          isFinal: Boolean(finalTrim) && !interimTrim,
        });
      };

      recognition.onerror = (event) => {
        const code = normalizeSpeechError(event);
        // Benign in sustained mode — keep session / ignore.
        if (code === "no-speech" || code === "aborted") {
          return;
        }
        wantListeningRef.current = false;
        intentionalStopRef.current = true;
        recognitionRef.current = null;
        setIsListening(false);
        callbacksRef.current.onError?.(code);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        // Chrome often ends continuous sessions on pause — restart while user still wants it.
        if (wantListeningRef.current && !intentionalStopRef.current) {
          try {
            begin();
          } catch {
            wantListeningRef.current = false;
            setIsListening(false);
            callbacksRef.current.onEnd?.();
          }
          return;
        }
        setIsListening(false);
        callbacksRef.current.onEnd?.();
      };

      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        // InvalidStateError if already started — treat as listening.
        const code = normalizeSpeechError(err);
        if (code.includes("InvalidState") || String(err?.name || "").includes("InvalidState")) {
          setIsListening(true);
          return;
        }
        wantListeningRef.current = false;
        recognitionRef.current = null;
        setIsListening(false);
        callbacksRef.current.onError?.(code || "start-failed");
      }
    };

    startTimerRef.current = setTimeout(begin, 80);
  }, [cancelSpeak, stopListening]);

  const speak = useCallback((text, speakOptions = {}) => {
    if (!synthesisSupported || !text?.trim()) return;
    if (wantListeningRef.current || recognitionRef.current) return;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = speakOptions.lang || langRef.current;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [synthesisSupported]);

  return {
    recognitionSupported,
    synthesisSupported,
    isListening,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  };
}
