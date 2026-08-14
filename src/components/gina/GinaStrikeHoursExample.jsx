/**
 * Inline hash + struck phrase for “tachar las horas” education.
 */
export function GinaStrikeHoursPhrase({ phrase }) {
  const label = String(phrase || "").trim();
  if (!label) return null;
  return (
    <span className="gina-chat-card__strike-phrase">
      <img
        className="gina-chat-card__strike-phrase-hash"
        src="/uploads/Hash.svg"
        alt=""
        aria-hidden
        draggable={false}
      />
      <s className="gina-chat-card__strike-phrase-text">{label}</s>
    </span>
  );
}
