import { useEffect, useRef, useState } from "react";
import { DOC_SLASH_COMMANDS } from "../../../lib/docBlockSlash.js";

const COMMAND_ICON_DEFAULT = "/uploads/botones/command-hover.svg";
const COMMAND_ICON_ACTIVE = "/uploads/botones/command-hover.svg";

/** Floating slash-command picker — default access to block commands. */
export function DocSlashCommandPicker({
  onSelectCommand,
  isCommandEnabled,
  variant = "floating",
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef(null);
  const rootClass = [
    "doc-slash-command-picker",
    variant === "pad" ? "doc-slash-command-picker--pad" : "doc-slash-command-picker--floating",
  ].join(" ");

  useEffect(() => {
    if (!open) return;
    const onDocDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  return (
    <div className={rootClass} ref={rootRef}>
      {open ? (
        <div className="doc-slash-command-picker__menu" role="listbox" aria-label="Block commands">
          {DOC_SLASH_COMMANDS.map((cmd) => {
            const enabled = isCommandEnabled?.(cmd) !== false;
            const slashLabel = `/${cmd.aliases[0]}`;
            return (
              <button
                key={cmd.label}
                type="button"
                role="option"
                className="doc-slash-command-picker__option"
                disabled={!enabled}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!enabled) return;
                  onSelectCommand?.(cmd.aliases[0]);
                  setOpen(false);
                }}
              >
                <span className="doc-slash-command-picker__option-label">{cmd.label}</span>
                <span className="doc-slash-command-picker__option-slash">{slashLabel}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <button
        type="button"
        className="doc-slash-command-picker__btn"
        aria-label="Block commands"
        aria-expanded={open}
        aria-haspopup="listbox"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <img
          src={hovered || open ? COMMAND_ICON_ACTIVE : COMMAND_ICON_DEFAULT}
          alt=""
          aria-hidden
          className="doc-slash-command-picker__icon"
        />
      </button>
    </div>
  );
}
