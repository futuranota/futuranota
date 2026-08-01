/**
 * Gina chat card — visual/interaction shell for Call Asistente inside a document.
 * Reference draft adapted from AIChatCard.original.tsx.
 * Not wired to Claude/tools yet; replace demo reply when integrating.
 */
import { useState } from "react";
import { motion } from "framer-motion";

/** @typedef {{ sender: "ai" | "user", text: string }} GinaChatMessage */

function SendIcon() {
  return (
    <svg
      className="gina-chat-card__send-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22 2L11 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @param {{
 *   className?: string,
 *   assistantName?: string,
 *   openingMessage?: string,
 *   onSendMessage?: (text: string) => void | Promise<void>,
 * }} props
 */
export function GinaChatCard({
  className = "",
  assistantName = "Gina",
  openingMessage = "Hey — I’m Gina. What do you need for this document?",
  onSendMessage,
}) {
  /** @type {[GinaChatMessage[], Function]} */
  const [messages, setMessages] = useState([
    { sender: "ai", text: openingMessage },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

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

    // Demo stub — remove when Gina tools are connected
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Got it — I’ll use this chat once tools are connected.",
        },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className={`gina-chat-card ${className}`.trim()}>
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

        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="gina-chat-card__particle"
            animate={{
              y: ["0%", "-140%"],
              x: [Math.random() * 200 - 100, Math.random() * 200 - 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut",
            }}
            style={{ left: `${Math.random() * 100}%`, bottom: "-10%" }}
          />
        ))}

        <header className="gina-chat-card__header">
          <h2 className="gina-chat-card__title">{assistantName}</h2>
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
              aria-label="Gina is typing"
            >
              <span />
              <span />
              <span />
            </motion.div>
          )}
        </div>

        <div className="gina-chat-card__composer">
          <input
            className="gina-chat-card__input"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            aria-label="Message Gina"
          />
          <button
            type="button"
            className="gina-chat-card__send"
            onClick={handleSend}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default GinaChatCard;
