import { useEffect, useRef, useState } from "react";
import { DOC_SLASH_COMMANDS } from "../../../lib/docBlockSlash.js";
import { NodeLinkColorPicker } from "./NodeLinkColorPicker.jsx";

/** Floating slash-command picker — block commands + optional node link colors. */
export function DocSlashCommandPicker({
  onSelectCommand,
  isCommandEnabled,
  variant = "floating",
  nodeLinkColor,
  onNodeLinkColorChange,
  nodeLinkColorLabel = "Nodes colors",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const showNodeLinkColors = Boolean(onNodeLinkColorChange);
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
        <div className="doc-slash-command-picker__menu" role="dialog" aria-label="Document tools">
          <div className="doc-slash-command-picker__commands" role="listbox" aria-label="Block commands">
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
          {showNodeLinkColors ? (
            <div
              className="doc-slash-command-picker__colors"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span className="doc-slash-command-picker__colors-label">{nodeLinkColorLabel}</span>
              <NodeLinkColorPicker
                variant="inline"
                value={nodeLinkColor}
                onChange={onNodeLinkColorChange}
                label={nodeLinkColorLabel}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="doc-slash-command-picker__btn"
        aria-label="Block commands and node colors"
        aria-expanded={open}
        aria-haspopup="dialog"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span className="doc-slash-command-picker__glyph" aria-hidden>+</span>
      </button>
    </div>
  );
}
