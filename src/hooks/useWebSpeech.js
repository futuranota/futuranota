import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API — STT (dictation) + TTS (read aloud).
 * Chrome/Edge: SpeechRecognition / webkitSpeechRecognition.
 */

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
  langRef.current = lang;

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => () => {
    stopListening();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [stopListening]);

  const startListening = useCallback(({ onResult, onError, onEnd } = {}) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.(new Error("Speech recognition unsupported"));
      return;
    }

    stopListening();

    const recognition = new Ctor();
    recognition.lang = langRef.current;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const result = event?.results?.[event.results.length - 1];
      const transcript = result?.[0]?.transcript;
      if (typeof transcript === "string" && transcript.trim()) {
        onResult?.(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;
      onError?.(event?.error || event);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      onEnd?.();
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      recognitionRef.current = null;
      onError?.(err);
    }
  }, [stopListening]);

  const cancelSpeak = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text, speakOptions = {}) => {
    if (!synthesisSupported || !text?.trim()) return;
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
