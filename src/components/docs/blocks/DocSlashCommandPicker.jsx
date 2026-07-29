import { useEffect, useRef, useState } from "react";
import {
  buildSlashMenuSections,
  DOC_SLASH_COMMANDS,
} from "../../../lib/docBlockSlash.js";
import { NodeLinkColorPicker } from "./NodeLinkColorPicker.jsx";

function CommandOption({ cmd, enabled, onPick }) {
  const slashLabel = `/${cmd.ghostHint || cmd.aliases[0]}`;
  const label = cmd.menuLabel || cmd.label;
  return (
    <button
      type="button"
      role="option"
      className="doc-slash-command-picker__option"
      disabled={!enabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (!enabled) return;
        onPick?.(cmd.aliases[0]);
      }}
    >
      <span className="doc-slash-command-picker__option-label">{label}</span>
      <span className="doc-slash-command-picker__option-slash">{slashLabel}</span>
    </button>
  );
}

/** Floating slash-command picker — block commands + optional node link colors. */
export function DocSlashCommandPicker({
  commands = DOC_SLASH_COMMANDS,
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
  const sections = buildSlashMenuSections(commands);
  const hasCommands = sections.length > 0;
  const menuLabel = hasCommands ? "Document tools" : nodeLinkColorLabel;
  const buttonLabel = hasCommands ? "Block commands and node colors" : nodeLinkColorLabel;
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

  const pick = (alias) => {
    onSelectCommand?.(alias);
    setOpen(false);
  };

  return (
    <div className={rootClass} ref={rootRef}>
      {open ? (
        <div className="doc-slash-command-picker__menu" role="dialog" aria-label={menuLabel}>
          {hasCommands ? (
            <div className="doc-slash-command-picker__commands" role="listbox" aria-label="Block commands">
              {sections.map((section) => {
                if (section.kind === "group") {
                  return (
                    <div
                      key={`group:${section.id}`}
                      className="doc-slash-command-picker__group"
                      role="group"
                      aria-label={section.label}
                    >
                      <div className="doc-slash-command-picker__group-label">{section.label}</div>
                      {section.commands.map((cmd) => (
                        <CommandOption
                          key={cmd.label}
                          cmd={cmd}
                          enabled={isCommandEnabled?.(cmd) !== false}
                          onPick={pick}
                        />
                      ))}
                    </div>
                  );
                }
                const cmd = section.command;
                return (
                  <CommandOption
                    key={cmd.label}
                    cmd={cmd}
                    enabled={isCommandEnabled?.(cmd) !== false}
                    onPick={pick}
                  />
                );
              })}
            </div>
          ) : null}
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
        aria-label={buttonLabel}
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
