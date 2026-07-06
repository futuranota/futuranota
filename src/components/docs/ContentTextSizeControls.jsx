const TEXT_LARGER_ICON = "/uploads/text-larger.svg";

export function ContentTextSizeControls({
  typographyId,
  onTypographyChange,
  className = "",
}) {
  const isLarger = typographyId === "legacy";
  const rootClass = ["doc-content-text-size-controls", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass} role="group" aria-label="Text size">
      <button
        type="button"
        className={
          "doc-content-text-size-controls__btn"
          + (isLarger ? " is-active" : " is-disabled")
        }
        onClick={() => onTypographyChange(isLarger ? "normal" : "legacy")}
        aria-pressed={isLarger}
        title={isLarger ? "Larger text (16px) on" : "Larger text (16px) off"}
      >
        <img src={TEXT_LARGER_ICON} alt="" width={63} height={22} draggable={false} />
      </button>
    </div>
  );
}
