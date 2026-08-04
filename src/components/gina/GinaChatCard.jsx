/**
 * Gina chat card — Call Asistente shell inside an open document.
 * Dictation: listen → insert into composer (edit STT) → Send.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useWebSpeech } from "../../hooks/useWebSpeech.js";
import { absorbDictationFinal } from "../../lib/ginaSpeechCommands.js";
import { normalizeDictationTranscript } from "../../lib/ginaSpeechVocab.js";
import { GinaAiMessageText } from "./GinaAnimatedText.jsx";
import { GinaDataVisualization } from "./GinaDataVisualization.jsx";
import { GinaThinkingStatus } from "./GinaThinkingStatus.jsx";
import { buildGinaOpeningChips } from "../../lib/gina/ginaReplyChips.js";

/** @typedef {{ sender: "ai" | "user", text: string, visualization?: { type: string, data: object } | null, learnProposal?: { title: string, body: string } | null, chips?: { id: string, label: string, text: string, primary?: boolean }[] | null }} GinaChatMessage */

function SendIcon() {
  return (
    <svg className="gina-chat-card__send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** First dictation step: park transcript in composer for edits. */
function InsertIcon() {
  return (
    <svg className="gina-chat-card__insert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

/** @param {{ active?: boolean }} props */
function DictationWaves({ active = false }) {
  return (
    <div
      className={`gina-chat-card__waves${active ? " is-active" : " is-idle"}`}
      aria-hidden="true"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} style={active ? { animationDelay: `${i * 0.08}s` } : undefined} />
      ))}
    </div>
  );
}

/**
 * @param {string} code
 * @param {Record<string, string>} labels
 */
function speechErrorMessage(code, labels) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return labels.micPermission || "Microphone permission denied. Allow mic access in the browser.";
    case "no-speech":
      return labels.micNoSpeech || "No speech detected. Tap the mic and try again.";
    case "audio-capture":
      return labels.micNoDevice || "No microphone found.";
    case "network":
      return labels.micNetwork || "Speech recognition needs a network connection.";
    case "unsupported":
      return labels.micUnsupported || "Voice input is not supported in this browser";
    case "start-failed":
      return labels.micStartFailed || "Could not start the microphone. Try again.";
    default:
      return labels.micError || "Voice input failed. Try again.";
  }
}

function joinTranscript(finalParts, interim) {
  const base = finalParts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const live = String(interim || "").trim();
  if (!base) return live;
  if (!live) return base;
  return `${base} ${live}`.replace(/\s+/g, " ").trim();
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
 *   labels?: Record<string, string>,
 *   onClose?: () => void,
 *   onSendMessage?: (text: string, meta?: { meetingMode?: boolean }) => void | Promise<void | string | { message?: string, reply?: string, visualization?: object | null }>,
 *   allowMeetingMode?: boolean,
 *   meetingDocumentTitle?: string,
 *   initialMeetingMode?: boolean,
 *   lockMeetingMode?: boolean,
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
  allowMeetingMode = false,
  meetingDocumentTitle = "",
  initialMeetingMode = false,
  lockMeetingMode = false,
}) {
  const chipLocale = String(speechLang || "").toLowerCase().startsWith("en") ? "en" : "es";
  /** @type {[GinaChatMessage[], Function]} */
  const [messages, setMessages] = useState(() => [
    {
      sender: "ai",
      text: openingMessage,
      chips: buildGinaOpeningChips({ locale: chipLocale }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [micError, setMicError] = useState(/** @type {string | null} */ (null));
  const [dictationFinals, setDictationFinals] = useState(/** @type {string[]} */ ([]));
  const [dictationInterim, setDictationInterim] = useState("");
  /** True while STT is actively producing speech (interim / recent result). */
  const [isHearing, setIsHearing] = useState(false);
  /** Mode B: “borrar” armed — next utterance is the phrase to remove. */
  const [deletePhraseArmed, setDeletePhraseArmed] = useState(false);
  const [deletePhraseHint, setDeletePhraseHint] = useState(/** @type {string | null} */ (null));
  const [meetingMode, setMeetingMode] = useState(Boolean(initialMeetingMode));

  useEffect(() => {
    setMeetingMode(Boolean(initialMeetingMode));
  }, [initialMeetingMode]);

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
  const skipOpeningSpeakRef = useRef(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const dictationRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const dictationFinalsRef = useRef(/** @type {string[]} */ ([]));
  const dictationInterimRef = useRef("");
  const deletePhraseArmedRef = useRef(false);
  const hearingTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const focusComposerAfterInsertRef = useRef(false);

  const liveDictation = joinTranscript(dictationFinals, dictationInterim);

  const markHearing = (active) => {
    if (hearingTimerRef.current) {
      clearTimeout(hearingTimerRef.current);
      hearingTimerRef.current = null;
    }
    if (active) {
      setIsHearing(true);
      // Linger briefly after last chunk so bars don't flicker between words.
      hearingTimerRef.current = setTimeout(() => {
        hearingTimerRef.current = null;
        setIsHearing(false);
      }, 520);
      return;
    }
    setIsHearing(false);
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  useEffect(() => {
    if (isListening || !focusComposerAfterInsertRef.current) return;
    focusComposerAfterInsertRef.current = false;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }, [isListening, input]);

  useEffect(() => {
    const el = dictationRef.current;
    if (!el || !isListening) return;
    el.scrollTop = el.scrollHeight;
  }, [liveDictation, isListening]);

  useEffect(() => () => {
    if (hearingTimerRef.current) clearTimeout(hearingTimerRef.current);
  }, []);

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
  }, [messages, isTyping, isListening, liveDictation, micError]);

  useEffect(() => {
    if (!ttsEnabled || !synthesisSupported) return;
    if (isListening) return;
    const aiMessages = messages.filter((m) => m.sender === "ai");
    if (aiMessages.length <= spokenCountRef.current) return;

    if (skipOpeningSpeakRef.current && aiMessages.length === 1) {
      spokenCountRef.current = 1;
      skipOpeningSpeakRef.current = false;
      return;
    }
    skipOpeningSpeakRef.current = false;

    const newest = aiMessages[aiMessages.length - 1];
    spokenCountRef.current = aiMessages.length;
    if (newest?.text) speak(newest.text, { lang: speechLang });
  }, [messages, ttsEnabled, synthesisSupported, speak, speechLang, isListening]);

  useEffect(() => () => {
    cancelSpeak();
    stopListening({ mode: "abort" });
  }, [cancelSpeak, stopListening]);

  const resetDictationBuffers = () => {
    dictationFinalsRef.current = [];
    dictationInterimRef.current = "";
    deletePhraseArmedRef.current = false;
    setDictationFinals([]);
    setDictationInterim("");
    setDeletePhraseArmed(false);
    setDeletePhraseHint(null);
    markHearing(false);
  };

  const startDictation = () => {
    if (!recognitionSupported) {
      setMicError(speechErrorMessage("unsupported", labels));
      return;
    }
    setMicError(null);
    resetDictationBuffers();
    cancelSpeak();

    startListening({
      onResult: ({ finalText, interimText }) => {
        setMicError(null);
        if (finalText) {
          const existing = dictationFinalsRef.current.filter(Boolean).join(" ");
          const absorbed = absorbDictationFinal(existing, finalText, {
            deletePhraseArmed: deletePhraseArmedRef.current,
          });
          const normalized = normalizeDictationTranscript(absorbed.text);
          dictationFinalsRef.current = normalized ? [normalized] : [];
          setDictationFinals([...dictationFinalsRef.current]);

          deletePhraseArmedRef.current = Boolean(absorbed.deletePhraseArmed);
          setDeletePhraseArmed(deletePhraseArmedRef.current);

          if (absorbed.phraseMiss) {
            setDeletePhraseHint(
              labels.deletePhraseMiss
              || "No encontré ese texto. Di el fragmento otra vez o di cancelar.",
            );
          } else if (absorbed.phraseDeleted) {
            setDeletePhraseHint(null);
          } else if (absorbed.deletePhraseArmed) {
            setDeletePhraseHint(
              labels.deletePhraseArmed
              || "Borrar: di el texto que quieres quitar (o cancelar).",
            );
          } else {
            setDeletePhraseHint(null);
          }

          if (absorbed.didEdit || absorbed.deletePhraseArmed || absorbed.phraseMiss) {
            dictationInterimRef.current = "";
            setDictationInterim("");
            markHearing(true);
            return;
          }
        }
        dictationInterimRef.current = interimText || "";
        setDictationInterim(interimText || "");
        markHearing(Boolean(finalText || interimText));
      },
      onError: (code) => {
        setMicError(speechErrorMessage(String(code), labels));
        resetDictationBuffers();
      },
      onEnd: () => {
        markHearing(false);
      },
    });
  };

  const cancelDictation = () => {
    stopListening({ mode: "abort" });
    resetDictationBuffers();
    setMicError(null);
  };

  const deliverUserMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { sender: "user", text: trimmed }]);
    setInput("");
    setIsTyping(true);
    const typingStartedAt = Date.now();
    const minTypingMs = 700;

    if (typeof onSendMessage === "function") {
      try {
        const history = [
          ...messages
            .filter((m) => m && typeof m.text === "string" && m.text.trim())
            .map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
            })),
          { role: "user", content: trimmed },
        ].slice(-12);

        const reply = await onSendMessage(trimmed, {
          meetingMode: Boolean(allowMeetingMode && (lockMeetingMode || meetingMode)),
          messages: history,
        });
        let aiText = "";
        let visualization = null;
        let learnProposal = null;
        let chips = null;
        if (typeof reply === "string") {
          aiText = reply.trim();
        } else if (reply && typeof reply === "object") {
          aiText = String(reply.message || reply.reply || "").trim();
          visualization = reply.visualization || null;
          learnProposal = reply.learnProposal || null;
          chips = Array.isArray(reply.chips) ? reply.chips : null;
        }
        const waitMore = minTypingMs - (Date.now() - typingStartedAt);
        if (waitMore > 0) {
          await new Promise((r) => window.setTimeout(r, waitMore));
        }
        if (aiText || visualization || learnProposal) {
          setMessages((prev) => [
            ...prev,
            {
              sender: "ai",
              text: aiText || " ",
              visualization,
              learnProposal,
              chips,
            },
          ]);
        }
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

  /**
   * Step 1: stop mic and park transcript in the composer so the user can fix
   * STT mistakes before sending.
   */
  const insertDictation = () => {
    const raw = joinTranscript(dictationFinalsRef.current, dictationInterimRef.current);
    stopListening({ mode: "stop" });
    resetDictationBuffers();
    setMicError(null);
    if (!raw.trim()) {
      setMicError(labels.micNoSpeech || "No speech detected. Tap the mic and try again.");
      return;
    }
    const text = normalizeDictationTranscript(raw);
    focusComposerAfterInsertRef.current = true;
    setInput((prev) => {
      const existing = prev.trim();
      if (!existing) return text;
      return `${existing} ${text}`;
    });
  };

  /** Step 2: send whatever is in the composer (typed or voice + edits). */
  const handleSend = async () => {
    if (isListening) {
      insertDictation();
      return;
    }
    const text = input.trim();
    if (!text) return;
    setMicError(null);
    await deliverUserMessage(text);
  };

  const micTitle = !recognitionSupported
    ? (labels.micUnsupported || "Voice input not supported in this browser")
    : isListening
      ? (labels.listeningCancel || "Cancel dictation")
      : (labels.micAria || "Dictate with microphone");

  const ttsTitle = ttsEnabled
    ? (labels.ttsOn || "Speaking replies on")
    : (labels.ttsOff || "Speaking replies off");

  const dictationInsertTitle = labels.dictationInsert || "Insert to edit";

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
                  cancelDictation();
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

        {allowMeetingMode ? (
          <div className="gina-chat-card__meeting-bar">
            {lockMeetingMode ? (
              <span className="gina-chat-card__meeting-label is-on">
                {labels.meetingToggle || "Meeting"}
              </span>
            ) : (
              <label className={`gina-chat-card__meeting-toggle${meetingMode ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={meetingMode}
                  onChange={(e) => setMeetingMode(e.target.checked)}
                />
                <span className="gina-chat-card__meeting-label">
                  {labels.meetingToggle || "Meeting"}
                </span>
              </label>
            )}
            {(lockMeetingMode || meetingMode) ? (
              <span className="gina-chat-card__meeting-hint">
                {(labels.meetingActiveHint || "Reading: {title}").replace(
                  "{title}",
                  meetingDocumentTitle || labels.meetingThisDocument || "this document",
                )}
              </span>
            ) : (
              <span className="gina-chat-card__meeting-hint gina-chat-card__meeting-hint--dim">
                {labels.meetingOffHint || "Off — Gina won’t use this document as a brief"}
              </span>
            )}
          </div>
        ) : null}

        <div className="gina-chat-card__messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.sender}-${i}-${msg.text.slice(0, 12)}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={
                msg.sender === "ai"
                  ? "gina-chat-card__turn gina-chat-card__turn--ai"
                  : "gina-chat-card__turn gina-chat-card__turn--user"
              }
            >
              <div
                className={
                  msg.sender === "ai"
                    ? "gina-chat-card__bubble gina-chat-card__bubble--ai"
                    : "gina-chat-card__bubble gina-chat-card__bubble--user"
                }
              >
                {msg.sender === "ai" ? <GinaAiMessageText text={msg.text} /> : msg.text}
              </div>
              {msg.sender === "ai" && msg.visualization ? (
                <GinaDataVisualization
                  type={msg.visualization.type}
                  data={msg.visualization.data}
                  onSelectDepartment={(deptName) => {
                    if (!deptName || isTyping) return;
                    const locale = chipLocale;
                    const text = locale === "en"
                      ? `Focus today on ${deptName}`
                      : `Enfocarme hoy en ${deptName}`;
                    void deliverUserMessage(text);
                  }}
                />
              ) : null}
              {msg.sender === "ai" && Array.isArray(msg.chips) && msg.chips.length && !isTyping ? (
                <div className="gina-chat-card__chips" role="group" aria-label="Suggested replies">
                  {msg.chips.map((chip) => (
                    <button
                      key={chip.id || chip.label}
                      type="button"
                      className={
                        "gina-chat-card__chip"
                        + (chip.primary ? " is-primary" : "")
                      }
                      onClick={() => {
                        if (isTyping) return;
                        void deliverUserMessage(chip.text || chip.label);
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {msg.sender === "ai" && msg.learnProposal && allowMeetingMode ? (
                <button
                  type="button"
                  className="gina-chat-card__learn-save"
                  onClick={async () => {
                    if (typeof onSendMessage !== "function") return;
                    setIsTyping(true);
                    try {
                      const saved = await onSendMessage("guarda", {
                        meetingMode: true,
                        saveLearnProposal: true,
                        learnProposal: msg.learnProposal,
                      });
                      let confirmText = "";
                      if (typeof saved === "string") confirmText = saved.trim();
                      else if (saved && typeof saved === "object") {
                        confirmText = String(saved.message || saved.reply || "").trim();
                      }
                      setMessages((prev) => [
                        ...prev.map((m, idx) => (
                          idx === i ? { ...m, learnProposal: null } : m
                        )),
                        ...(confirmText
                          ? [{ sender: "ai", text: confirmText, learnProposal: null }]
                          : []),
                      ]);
                    } finally {
                      setIsTyping(false);
                    }
                  }}
                >
                  {labels.learnSave || "Save to Gina’s memory"}
                </button>
              ) : null}
            </motion.div>
          ))}

          {isTyping && (
            <GinaThinkingStatus
              locale={String(speechLang || "").toLowerCase().startsWith("en") ? "en" : "es"}
              ariaLabel={labels.typingAria || "Gina is thinking"}
              phrases={Array.isArray(labels.thinkingPhrases) ? labels.thinkingPhrases : undefined}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {micError ? (
          <p className="gina-chat-card__mic-banner is-error" role="status" aria-live="polite">
            {micError}
          </p>
        ) : null}

        {isListening ? (
          <div
            ref={dictationRef}
            className={`gina-chat-card__dictation${deletePhraseArmed ? " is-delete-armed" : ""}`}
            role="status"
            aria-live="polite"
          >
            <button
              type="button"
              className="gina-chat-card__mic is-listening"
              onClick={cancelDictation}
              aria-label={micTitle}
              title={micTitle}
            >
              <MicIcon />
            </button>
            <div className="gina-chat-card__dictation-main">
              <DictationWaves active={isHearing} />
              {deletePhraseHint ? (
                <p className="gina-chat-card__dictation-hint">{deletePhraseHint}</p>
              ) : null}
              <p className="gina-chat-card__dictation-text">
                {liveDictation
                  || (deletePhraseArmed
                    ? (labels.deletePhraseArmed || "Borrar: di el texto que quieres quitar (o cancelar).")
                    : (labels.listeningHold || "Listening… speak freely. Say “borrar”, then the text to remove."))}
              </p>
            </div>
            <button
              type="button"
              className="gina-chat-card__insert gina-chat-card__insert--dictation"
              onClick={insertDictation}
              disabled={!liveDictation.trim()}
              aria-label={dictationInsertTitle}
              title={dictationInsertTitle}
            >
              <InsertIcon />
            </button>
          </div>
        ) : (
          <div className="gina-chat-card__composer">
            <textarea
              ref={inputRef}
              className="gina-chat-card__input"
              placeholder={placeholder}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                if (micError) setMicError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              aria-label={labels.messageAria || "Message Gina"}
            />
            <button
              type="button"
              className="gina-chat-card__mic"
              onClick={startDictation}
              disabled={!recognitionSupported}
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
        )}
      </div>
    </div>
  );
}

export default GinaChatCard;
