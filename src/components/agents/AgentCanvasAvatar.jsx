import { AgentIcon } from "./AgentIcon.jsx";

/**
 * Canvas / list avatar — SVG illustration when configured, icon fallback.
 * @param {{
 *   imageSrc?: string | null,
 *   iconVariant?: string,
 *   className?: string,
 *   imgClassName?: string,
 * }} props
 */
export function AgentCanvasAvatar({
  imageSrc = null,
  iconVariant = "orchestrator",
  className = "",
  imgClassName = "cnode-agent__avatar-img",
}) {
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        className={`agent-avatar-img ${imgClassName} ${className}`.trim()}
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
