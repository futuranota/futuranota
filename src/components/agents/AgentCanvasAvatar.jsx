import { AgentIcon } from "./AgentIcon.jsx";

/**
 * Canvas / list avatar — SVG illustration when configured, icon fallback.
 * @param {{
 *   imageSrc?: string | null,
 *   iconVariant?: string,
 *   className?: string,
 *   imgClassName?: string,
 *   avatarKind?: 'illustration' | 'brand-icon',
 * }} props
 */
export function AgentCanvasAvatar({
  imageSrc = null,
  iconVariant = "orchestrator",
  className = "",
  imgClassName = "cnode-agent__avatar-img",
  avatarKind = "illustration",
}) {
  if (imageSrc) {
    const kindClass = avatarKind === "brand-icon" ? "agent-avatar-img--brand-icon" : "";
    return (
      <img
        src={imageSrc}
        alt=""
        className={`agent-avatar-img ${kindClass} ${imgClassName} ${className}`.trim()}
        aria-hidden
        draggable={false}
      />
    );
  }

  return (
    <AgentIcon
      variant={iconVariant}
      className={`cnode-agent__avatar-svg ${className}`.trim()}
    />
  );
}
