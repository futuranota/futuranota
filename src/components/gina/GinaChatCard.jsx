/**
 * Gina chat card — Call Asistente shell inside an open document.
 * Demo replies until tools/Claude are wired.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useWebSpeech } from "../../hooks/useWebSpeech.js";

/** @typedef {{ sender: "ai" | "user", text: string }} GinaChatMessage */

function SendIcon() {
  return (
    <svg className="gina-chat-card__send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="gina-chat-card__mic-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpeakerIcon({ on }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M23 9l-6 6M17 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * @param {{
 *   className?: string,
 *   documentId?: string | null,
 *   assistantName?: string,
 *   openingMessage?: string,
 *   demoReply?: string,
 *   placeholder?: string,
 *   speechLang?: string,
 *   labels?: {
 *     messageAria?: string,
 *     sendAria?: string,
 *     micAria?: string,
 *     micUnsupported?: string,
 *     listening?: string,
 *     ttsOn?: string,
 *     ttsOff?: string,
 *     closeAria?: string,
 *     typingAria?: string,
 *   },
 *   onClose?: () => void,
 *   onSendMessage?: (text: string) => void | Promise<void>,
 * }} props
 */
export function GinaChatCard({
  className = "",
  documentId = null,
  assistantName = "Gina",
  openingMessage = "Hey — I’m Gina. What do you need for this document?",
  demoReply = "Got it — I’ll use this chat once tools are connected.",
  placeholder = "Type a message…",
  speechLang = "es-ES",
  labels = {},
  onClose,
  onSendMessage,
}) {
  /** @type {[GinaChatMessage[], Function]} */
  const [messages, setMessages] = useState([
    { sender: "ai", text: openingMessage },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const {
    recognitionSupported,
    synthesisSupported,
    isListening,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  } = useWebSpeech({ lang: speechLang });

  const [ttsEnabled, setTtsEnabled] = useState(() => synthesisSupported);
  const spokenCountRef = useRef(0);
  const messagesEndRef = useRef(null);

  const particles = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 11) % 100}%`,
      duration: 5 + (i % 4),
      delay: i * 0.45,
      x: ((i * 37) % 200) - 100,
    })),
    [],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, isTyping]);

  // Speak new AI messages when TTS is on (including opening once).
  useEffect(() => {
    if (!ttsEnabled || !synthesisSupported) return;
    const aiMessages = messages.filter((m) => m.sender === "ai");
    if (aiMessages.length <= spokenCountRef.current) return;
    const newest = aiMessages[aiMessages.length - 1];
    spokenCountRef.current = aiMessages.length;
    if (newest?.text) speak(newest.text, { lang: speechLang });
  }, [messages, ttsEnabled, synthesisSupported, speak, speechLang]);

  useEffect(() => () => {
    cancelSpeak();
    stopListening();
  }, [cancelSpeak, stopListening]);

  const appendTranscript = (transcript) => {
    setInput((prev) => {
      const base = prev.trim();
      return base ? `${base} ${transcript}` : transcript;
    });
  };

  const toggleMic = () => {
    if (!recognitionSupported) return;
    if (isListening) {
      stopListening();
      return;
    }
    startListening({
      onResult: appendTranscript,
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    if (isListening) stopListening();

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");
    setIsTyping(true);

    if (typeof onSendMessage === "function") {
      try {
        await onSendMessage(text);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    window.setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "ai", text: demoReply }]);
      setIsTyping(false);
    }, 1200);
  };

  const micTitle = !recognitionSupported
    ? (labels.micUnsupported || "Voice input not supported in this browser")
    : isListening
      ? (labels.listening || "Listening… tap to stop")
      : (labels.micAria || "Dictate with microphone");

  const ttsTitle = ttsEnabled
    ? (labels.ttsOn || "Speaking replies on")
    : (labels.ttsOff || "Speaking replies off");

  return (
    <div
      className={`gina-chat-card ${className}`.trim()}
      data-document-id={documentId || undefined}
    >
      <motion.div
        className="gina-chat-card__orbit"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      <div className="gina-chat-card__inner">
        <motion.div
          className="gina-chat-card__bg"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />

        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="gina-chat-card__particle"
            animate={{
              y: ["0%", "-140%"],
              x: [p.x, -p.x],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
            style={{ left: p.left, bottom: "-10%" }}
          />
        ))}

        <header className="gina-chat-card__header">
          <h2 className="gina-chat-card__title">{assistantName}</h2>
          <div className="gina-chat-card__header-actions">
            <button
              type="button"
              className={`gina-chat-card__icon-btn${ttsEnabled ? " is-active" : ""}`}
              onClick={() => {
                if (ttsEnabled) cancelSpeak();
                setTtsEnabled((v) => !v);
              }}
              disabled={!synthesisSupported}
              aria-pressed={ttsEnabled}
              aria-label={ttsTitle}
              title={ttsTitle}
            >
              <SpeakerIcon on={ttsEnabled && synthesisSupported} />
            </button>
            {typeof onClose === "function" ? (
              <button
                type="button"
                className="gina-chat-card__icon-btn"
                onClick={() => {
                  cancelSpeak();
                  stopListening();
                  onClose();
                }}
                aria-label={labels.closeAria || "Close"}
                title={labels.closeAria || "Close"}
              >
                <span aria-hidden>×</span>
              </button>
            ) : null}
          </div>
        </header>

        <div className="gina-chat-card__messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.sender}-${i}-${msg.text.slice(0, 12)}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={
                msg.sender === "ai"
                  ? "gina-chat-card__bubble gina-chat-card__bubble--ai"
                  : "gina-chat-card__bubble gina-chat-card__bubble--user"
              }
            >
              {msg.text}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              className="gina-chat-card__typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              aria-label={labels.typingAria || "Gina is typing"}
            >
              <span />
              <span />
              <span />
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="gina-chat-card__composer">
          <input
            className="gina-chat-card__input"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            aria-label={labels.messageAria || "Message Gina"}
          />
          <button
            type="button"
            className={`gina-chat-card__mic${isListening ? " is-listening" : ""}`}
            onClick={toggleMic}
            disabled={!recognitionSupported}
            aria-pressed={isListening}
            aria-label={micTitle}
            title={micTitle}
          >
            <MicIcon />
          </button>
          <button
            type="button"
            className="gina-chat-card__send"
            onClick={handleSend}
            aria-label={labels.sendAria || "Send"}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default GinaChatCard;
