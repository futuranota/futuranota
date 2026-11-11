import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { copyToClipboard } from '../../lib/copyToClipboard.js';
import {
  FREE_TELEPROMPT_MAX,
  TRANSCRIPT_FOLDER_LABEL,
  canAddTeleprompt,
  canEditTeleprompt,
  deskPlan,
  isPromptPro,
} from '../../lib/promptPlanLimits.js';
import { normalizeReferences } from '../../lib/promptReferences.js';
import { stepModelCardMeta } from '../../lib/promptModels.js';
import {
  blankTextNode,
  buildPromptInsertPayload,
  charPaceWeight,
  deskFoldersForTeleprompter,
  isTeleprompterCopyBlock,
  joinScriptText,
  makeTpId,
  nextBlockPause,
  pacedUnitsInText,
  resolveBlockCopyText,
  scriptOffsets,
  stepInsertLabel,
  stepPlainBody,
} from '../../lib/teleprompterScript.js';
import {
  VAD_THRESHOLD,
  VOICE_CPS,
  closeVadMic,
  openVadMic,
  vadLevel,
} from '../../lib/teleprompterVad.js';
import {
  TELEPROMPT_STATUS,
  applyTelepromptFreeUsageEpoch,
  blankTeleprompt,
  bumpTelepromptCreatedCount,
  clearTelepromptFreeMeters,
  formatTelepromptUploaded,
  readTelepromptCreatedCount,
  readTelepromptLibrary,
  writeTelepromptLibrary,
} from '../../lib/teleprompterLibrary.js';
import { startProCheckout } from '../../lib/billingApi.js';
import { useAuthStore } from '../../stores/authStore.js';
import { usePlanStore } from '../../stores/planStore.js';
import './teleprompter-page.css';

const DEFAULT_CPS = 14;
const FLOAT_SIZE = { width: 420, height: 480 };
const CPS_MIN = 5;
const CPS_MAX = 40;
const PACE_MODE_STORE = 'fn-teleprompter-pace-mode';
const RIGHT_TAB_STORE = 'fn-teleprompter-right-tab';
/** Legacy key — cleared so old dark preference cannot stick. */
const LEGACY_THEME_STORE = 'fn-teleprompter-theme';
const TP_THEME = 'light';

function readStoredPaceMode() {
  try {
    const value = localStorage.getItem(PACE_MODE_STORE);
    return value === 'voice' ? 'voice' : 'speed';
  } catch {
    return 'speed';
  }
}

function readStoredRightTab() {
  try {
    const value = localStorage.getItem(RIGHT_TAB_STORE);
    if (value === 'folders' || value === 'design') return value;
    return 'list';
  } catch {
    return 'list';
  }
}

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

function ScriptDesignPanel({ videoRef }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  function takeVideo(file) {
    if (!file) return;
    if (!String(file.type || '').startsWith('video/')) return;
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFileName(file.name || 'Video');
  }

  function clearVideo() {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="tp-design">
      <p className="tp-design__lead">
        Import your recorded video and reuse it as a visual reference to design your Script frame by frame.
      </p>
      <p className="tp-design__note">
        Plays on this device only — not saved to your plan storage.
      </p>
      <p className="tp-design__shortcut" aria-label="Keyboard shortcut">
        <kbd>Space</kbd>
        <span>Pause script or reference video</span>
      </p>
      {videoUrl ? (
        <div className="tp-design__player-wrap">
          <video
            ref={videoRef}
            className="tp-design__player"
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
          />
          <div className="tp-design__meta">
            <span className="tp-design__file" title={fileName}>{fileName}</span>
            <button type="button" className="tp-design__clear" onClick={clearVideo}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="tp-design__pick">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            aria-label="Import reference video"
            onChange={(event) => {
              takeVideo(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <span>Import video</span>
        </label>
      )}
    </div>
  );
}

const FLOAT_CSS = `
  html, body, #tp-float-root {
    margin: 0;
    width: 100%;
    height: 100%;
    font: 16px/1.55 ui-sans-serif, system-ui, sans-serif;
  }
  html, body {
    background: var(--tp-bg, #f4f1eb);
    color: var(--tp-ink, #1a1a1a);
  }
  html, body, #tp-float-root, .tp-float {
    --tp-bg: #f4f1eb;
    --tp-ink: #1a1a1a;
    --tp-muted: rgba(20, 20, 22, 0.45);
    --tp-line: rgba(20, 20, 22, 0.14);
    --tp-reader: #f4f1eb;
    --tp-done: #0d7a45;
    --tp-cursor-bg: rgba(13, 122, 69, 0.18);
    --tp-scroll-thumb: rgba(20, 20, 22, 0.18);
  }
  .tp-float {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    gap: 10px;
    background: var(--tp-bg);
    color: var(--tp-ink);
  }
  .tp-float.is-collapsed { padding: 8px 10px; }
  .tp-float__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .tp-float__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--tp-muted);
  }
  .tp-float__head button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--tp-line);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: 500 12px/1 ui-sans-serif, system-ui, sans-serif;
    cursor: pointer;
  }
  .tp-float__reader {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px;
    border-radius: 12px;
    background: var(--tp-reader);
    font-size: 17px;
    line-height: 1.55;
  }
  .tp-float.is-collapsed .tp-float__reader,
  .tp-float.is-collapsed .tp-float__meta { display: none; }
  .tp-float__meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--tp-muted);
    font-variant-numeric: tabular-nums;
  }
  .tp-char { color: var(--tp-muted); }
  .tp-char.is-done { color: var(--tp-done); }
  .tp-char.is-cursor {
    color: var(--tp-ink);
    background: var(--tp-cursor-bg);
    border-radius: 2px;
  }
  .tp-block {
    margin: 10px 0;
    padding: 12px;
    border: 1px solid var(--tp-line);
    border-radius: 14px;
    background: rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tp-block.is-active {
    border-color: var(--tp-done);
    box-shadow: 0 0 0 1px var(--tp-done);
  }
  .tp-block__top {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .tp-block__model {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .tp-block__model img,
  .tp-block__model svg {
    width: 16px;
    height: 16px;
  }
  .tp-block__model svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
  }
  .tp-block__meta {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tp-block__kind {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .tp-block__title {
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .tp-block__target {
    margin: 0;
    font-size: 12px;
    color: var(--tp-muted);
  }
  .tp-block__href,
  .tp-block__preview {
    font-size: 12px;
    color: var(--tp-muted);
    overflow-wrap: anywhere;
  }
  .tp-block__preview {
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tp-block__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }
  .tp-block__copy {
    flex: none;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--tp-line);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: 500 12px/1 ui-sans-serif, system-ui, sans-serif;
  }
`;

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 5.6v12.8L19 12Z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg className="is-pause" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.5" y="5.5" width="4" height="13" rx="1" />
      <rect x="13.5" y="5.5" width="4" height="13" rx="1" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.8 12a7.2 7.2 0 1 0 2.1-5.1" />
      <path d="M4.8 4.8v4.4H9.2" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 9H4.5M9 9V4.5M9 9 4.8 4.8M15 9h4.5M15 9V4.5M15 9l4.2-4.2M9 15H4.5M9 15v4.5M9 15l-4.2 4.2M15 15h4.5M15 15v4.5M15 15l4.2 4.2" />
    </svg>
  );
}

function IconGhost() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4c-3.3 0-6 2.5-6 5.7v7.8c0 .7.6 1.1 1.1.7l1.5-1 1.4 1c.4.3 1 .3 1.4 0l1.2-.9 1.2.9c.4.3 1 .3 1.4 0l1.4-1 1.5 1c.5.4 1.1 0 1.1-.7v-7.8C18 6.5 15.3 4 12 4Z" />
      <path d="M9.5 10.2v.2M14.5 10.2v.2" />
    </svg>
  );
}

function GhostSurface({
  nodes,
  cursor,
  cps,
  durationLabel,
  elapsedLabel,
  playing,
  activeBlockId,
  copyFlash,
  canPlay,
  onPlay,
  onPause,
  onClose,
  onCopyBlock,
}) {
  return (
    <div className="tp-ghost" data-tp-theme={TP_THEME} role="dialog" aria-label="Ghost teleprompter">
      <div className="tp-ghost__panel">
        <div className="tp-ghost__head">
          <div className="tp-ghost__titles">
            <p className="tp-ghost__title">Ghost</p>
            <p className="tp-ghost__hint">Visible on the main screen · Space pauses</p>
          </div>
          <div className="tp-ghost__actions">
            {playing ? (
              <button type="button" className="tp-ghost__btn" onClick={onPause} title="Pause · Space">
                Pause
              </button>
            ) : (
              <button type="button" className="tp-ghost__btn" onClick={onPlay} disabled={!canPlay} title="Play">
                Play
              </button>
            )}
            <button type="button" className="tp-ghost__btn tp-ghost__btn--close" onClick={onClose} aria-label="Close Ghost">
              Close
            </button>
          </div>
        </div>
        <ScriptReader
          nodes={nodes}
          cursor={cursor}
          activeBlockId={activeBlockId}
          copyFlash={copyFlash}
          onCopyBlock={onCopyBlock}
          className="tp-ghost__reader"
        />
        <div className="tp-ghost__meta">
          <span>{`SPEED ${cps}`}</span>
          <span>{elapsedLabel} / {durationLabel}</span>
          <span className="tp-ghost__shortcut"><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 19.5h4L19 9l-4-4L4.5 15.5v4Z" />
      <path d="m13.2 6.8 4 4" />
    </svg>
  );
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function countChars(value) {
  return Array.from(String(value || '')).length;
}

function CharSpan({ text, cursor, baseOffset = 0, cursorRef }) {
  const chars = useMemo(() => Array.from(String(text || '')), [text]);
  return chars.map((ch, index) => {
    const global = baseOffset + index;
    const done = global < cursor;
    const active = global === cursor;
    return (
      <span
        key={`${global}-${ch}`}
        ref={active ? cursorRef : null}
        className={done ? 'tp-char is-done' : active ? 'tp-char is-cursor' : 'tp-char'}
      >
        {ch}
      </span>
    );
  });
}

function blockCopyLabel(flash, nodeId) {
  if (!flash || flash.id !== nodeId) return 'Copy';
  if (flash.kind === 'copied') return 'Copied';
  if (flash.kind === 'empty') return 'Empty';
  return 'Failed';
}

function ModelGlyph({ src, label }) {
  if (src) {
    return <img src={src} alt="" title={label || ''} />;
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 9v3l2 2" />
    </svg>
  );
}

function ScriptBlockCard({ node, active, copyLabel, onCopy, onRemove, editing, underPrevious = false }) {
  const isUrl = node.type === 'url';
  const isInstruction = node.type === 'instruction';
  const targetBits = [node.modelLabel, node.recommendedModel].filter((part) => String(part || '').trim());
  const preview = String(node.preview || node.body || '').trim();
  const kindLabel = isInstruction ? 'Instruction' : isUrl ? 'URL' : 'Prompt';
  const cardClass = [
    'tp-block',
    active ? 'is-active' : '',
    isInstruction ? 'tp-block--instruction' : '',
  ].filter(Boolean).join(' ');

  const card = (
    <div className={cardClass}>
      <div className="tp-block__top">
        {isUrl || isInstruction ? null : (
          <span className="tp-block__model" title={node.modelLabel || 'Model'}>
            <ModelGlyph src={node.modelSrc} label={node.modelLabel} />
          </span>
        )}
        <div className="tp-block__meta">
          <span className="tp-block__kind">{kindLabel}</span>
          {isUrl ? (
            <>
              {String(node.title || '').trim() ? (
                <strong className="tp-block__title">{node.title}</strong>
              ) : null}
              {node.href ? (
                <span className="tp-block__href">{node.href}</span>
              ) : null}
            </>
          ) : isInstruction ? (
            <>
              <strong className="tp-block__title">{node.title || 'Instruction'}</strong>
              {node.href ? (
                <span className="tp-block__href">{node.href}</span>
              ) : null}
            </>
          ) : (
            <>
              <strong className="tp-block__title">{node.title || 'Prompt'}</strong>
              {targetBits.length ? (
                <p className="tp-block__target">{targetBits.join(' · ')}</p>
              ) : null}
            </>
          )}
        </div>
        <div className="tp-block__actions">
          <button type="button" className="tp-block__copy" onClick={onCopy}>
            {copyLabel}
          </button>
          {editing ? (
            <button type="button" className="tp-block__remove" onClick={onRemove} aria-label="Remove block">
              ×
            </button>
          ) : null}
        </div>
      </div>
      {(isInstruction || !isUrl) && preview ? (
        <p className="tp-block__preview">{preview}</p>
      ) : null}
    </div>
  );

  if (!isInstruction) return card;

  return (
    <div className={underPrevious ? 'tp-instruction is-under' : 'tp-instruction'}>
      {underPrevious ? (
        <div className="tp-instruction__arrow" aria-hidden="true">
          <span className="tp-instruction__stem" />
          <span className="tp-instruction__head" />
        </div>
      ) : null}
      {card}
    </div>
  );
}

function ScriptReader({ nodes, cursor, activeBlockId, copyFlash, onCopyBlock, className }) {
  const scrollerRef = useRef(null);
  const cursorRef = useRef(null);
  const offsets = useMemo(() => scriptOffsets(nodes), [nodes]);

  useLayoutEffect(() => {
    const node = cursorRef.current;
    const scroller = scrollerRef.current;
    if (!node || !scroller) return;
    const top = node.offsetTop - scroller.clientHeight * 0.35;
    scroller.scrollTop = Math.max(0, top);
  }, [cursor, activeBlockId]);

  return (
    <div ref={scrollerRef} className={className} aria-live="off">
      {nodes.map((node, index) => {
        const meta = offsets[index];
        if (node.type === 'text') {
          return (
            <div key={node.id} className="tp-script__text">
              <CharSpan text={node.body} cursor={cursor} baseOffset={meta.start} cursorRef={cursorRef} />
            </div>
          );
        }
        const prev = index > 0 ? nodes[index - 1] : null;
        return (
          <ScriptBlockCard
            key={node.id}
            node={node}
            active={activeBlockId === node.id}
            copyLabel={blockCopyLabel(copyFlash, node.id)}
            onCopy={() => onCopyBlock(node)}
            editing={false}
            underPrevious={node.type === 'instruction' && Boolean(prev)}
          />
        );
      })}
    </div>
  );
}

function FloatSurface({
  nodes,
  cursor,
  cps,
  durationLabel,
  elapsedLabel,
  playing,
  collapsed,
  activeBlockId,
  copyFlash,
  canPlay,
  onToggleCollapse,
  onPlay,
  onPause,
  onCopyBlock,
}) {
  return (
    <div className={collapsed ? 'tp-float is-collapsed' : 'tp-float'} data-tp-theme={TP_THEME}>
      <div className="tp-float__head">
        <p className="tp-float__title">Teleprompter</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {playing ? (
            <button type="button" onClick={onPause} title="Pause · Space">Pause</button>
          ) : (
            <button type="button" onClick={onPlay} disabled={!canPlay} title="Play">Play</button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>
      <ScriptReader
        nodes={nodes}
        cursor={cursor}
        activeBlockId={activeBlockId}
        copyFlash={copyFlash}
        onCopyBlock={onCopyBlock}
        className="tp-float__reader"
      />
      <div className="tp-float__meta">
        <span>{`SPEED ${cps}`}</span>
        <span>{elapsedLabel} / {durationLabel}</span>
      </div>
    </div>
  );
}

function applyFloatTheme(hostWindow) {
  if (!hostWindow?.document) return;
  hostWindow.document.documentElement.setAttribute('data-tp-theme', TP_THEME);
  if (hostWindow.document.body) {
    hostWindow.document.body.setAttribute('data-tp-theme', TP_THEME);
  }
}

function resizeFloatWindow(hostWindow, collapsed) {
  if (!hostWindow || typeof hostWindow.resizeTo !== 'function') return;
  const width = collapsed ? 280 : FLOAT_SIZE.width;
  const height = collapsed ? 72 : FLOAT_SIZE.height;
  try {
    hostWindow.resizeTo(width, height);
  } catch {
    /* ignore */
  }
}

function mountFloatDocument(hostWindow) {
  const doc = hostWindow.document;
  doc.title = 'Teleprompter';
  let style = doc.getElementById('tp-float-css');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'tp-float-css';
    doc.head.appendChild(style);
  }
  style.textContent = FLOAT_CSS;
  let mount = doc.getElementById('tp-float-root');
  if (!mount) {
    mount = doc.createElement('div');
    mount.id = 'tp-float-root';
    doc.body.replaceChildren(mount);
  }
  applyFloatTheme(hostWindow);
  return mount;
}

const FILE_NAME_FALLBACK = 'Title Description';

function fileDisplayName(file) {
  const name = String(file?.name || '').trim();
  if (!name || name === 'Untitled') return FILE_NAME_FALLBACK;
  return name;
}

function countFilePrompts(file) {
  return (file?.steps || []).filter((step) => (
    String(step.prompt || '').replace(/<[^>]+>/g, '').trim()
  )).length;
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5h6l1.5 1.5H20.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z" />
      <path d="M3.5 7.5V6A1.5 1.5 0 0 1 5 4.5h4l1.5 1.5" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l4.5 4.5V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V9h5.5" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const EMPTY_LIST_ROWS = 4;
const SCRIPT_TITLE_MAX = 72;
const UNTITLED_SCRIPT_NAME = 'Untitled script';

function TelepromptUpgradeModal({ open, busy, onClose, onUpgrade }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="tp-upgrade" role="dialog" aria-modal="true" aria-labelledby="tp-upgrade-title">
      <button type="button" className="tp-upgrade__scrim" aria-label="Close" onClick={onClose} />
      <div className="tp-upgrade__card">
        <button type="button" className="tp-upgrade__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="tp-upgrade-title">Need unlimited teleprompter scripts?</h2>
        <p className="tp-upgrade__lead">
          The Free plan includes {FREE_TELEPROMPT_MAX} scripts. Upgrade to Pro to create more and keep editing without limits.
        </p>
        <div className="tp-upgrade__compare">
          <div className="tp-upgrade__col">
            <div className="tp-upgrade__col-head">
              <h3>Free</h3>
              <span className="tp-upgrade__badge">Current plan</span>
            </div>
            <p className="tp-upgrade__tag">Best for trying Futura Nota teleprompter</p>
            <p className="tp-upgrade__section">Free, but limited</p>
            <ul className="tp-upgrade__list">
              <li>{FREE_TELEPROMPT_MAX} teleprompter scripts</li>
              <li>Edit within 5 hours after create</li>
              <li>Speed and Voice playback</li>
            </ul>
          </div>
          <div className="tp-upgrade__col tp-upgrade__col--pro">
            <div className="tp-upgrade__col-head">
              <h3>Pro</h3>
            </div>
            <p className="tp-upgrade__tag">Best for daily scripts and long sessions</p>
            <p className="tp-upgrade__price">
              $10.99<span>/mo</span>
            </p>
            <p className="tp-upgrade__section">Everything unlocked</p>
            <ul className="tp-upgrade__list">
              <li>Unlimited teleprompter scripts</li>
              <li>Unlimited editing window</li>
              <li>Full desk Pro features</li>
            </ul>
            <button
              type="button"
              className="tp-upgrade__cta"
              disabled={busy}
              onClick={onUpgrade}
            >
              {busy ? 'Opening checkout…' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelepromptList({
  items,
  activeId,
  onOpen,
  onToggleStatus,
  onDelete,
  onCreateNew,
  canCreate,
  createCapped = false,
  createPulse = false,
  showQuota = false,
  quotaUsed = 0,
  quotaMax = FREE_TELEPROMPT_MAX,
}) {
  const createFrozen = Boolean(createCapped);
  return (
    <div className="tp-list">
      <div className="tp-list__toolbar">
        {showQuota ? (
          <p
            className={createFrozen ? 'tp-list__quota is-capped' : 'tp-list__quota'}
            aria-label={`Scripts ${quotaUsed} of ${quotaMax}`}
          >
            Scripts <strong>{quotaUsed}/{quotaMax}</strong>
          </p>
        ) : <span className="tp-list__quota-spacer" aria-hidden="true" />}
        <div className="tp-list__create-wrap">
          <button
            type="button"
            className={[
              'tp-list__btn tp-list__btn--create',
              createPulse ? 'is-pulse' : '',
              createFrozen ? 'is-capped' : '',
            ].filter(Boolean).join(' ')}
            disabled={!canCreate}
            onClick={onCreateNew}
          >
            <IconEdit />
            <span>Create new</span>
          </button>
        </div>
      </div>
      <div className="tp-list__table-wrap scroll-match-bg">
        <table className="tp-list__table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Uploaded</th>
              <th scope="col">Status</th>
              <th scope="col" className="tp-list__th-action">
                <span className="tp-list__sr">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item) => {
              const active = item.id === activeId;
              const completed = item.status === TELEPROMPT_STATUS.completed;
              return (
                <tr key={item.id} className={active ? 'is-active' : undefined}>
                  <td>
                    <button
                      type="button"
                      className="tp-list__name"
                      onClick={() => onOpen(item.id)}
                    >
                      {item.name || UNTITLED_SCRIPT_NAME}
                    </button>
                  </td>
                  <td>{formatTelepromptUploaded(item.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={completed ? 'tp-list__status is-done' : 'tp-list__status is-unfinished'}
                      aria-pressed={completed}
                      onClick={() => onToggleStatus(item.id)}
                    >
                      {completed ? 'Done' : 'Unfinished'}
                    </button>
                  </td>
                  <td className="tp-list__action">
                    <button
                      type="button"
                      className="tp-list__delete"
                      aria-label={`Delete ${item.name || 'teleprompt'}`}
                      onClick={() => onDelete(item.id)}
                    >
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              );
            }) : Array.from({ length: EMPTY_LIST_ROWS }, (_, index) => (
              <tr key={`empty-${index}`} className="tp-list__empty-row" aria-hidden="true">
                <td />
                <td />
                <td />
                <td className="tp-list__action" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeskBrowser({ folders, onInsertPrompt, onInsertUrl, onInsertInstruction, canInsert = true }) {
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [leaf, setLeaf] = useState(null); /* 'prompt' | 'urls' | 'instructions' | null */
  const [instructionTitle, setInstructionTitle] = useState('');
  const [instructionBody, setInstructionBody] = useState('');
  const [instructionHref, setInstructionHref] = useState('');

  const list = useMemo(
    () => deskFoldersForTeleprompter(folders, TRANSCRIPT_FOLDER_LABEL),
    [folders],
  );

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((folder) => {
      if (String(folder.label || '').toLowerCase().includes(q)) return true;
      return (folder.prompts || []).some((file) => String(file.name || '').toLowerCase().includes(q));
    });
  }, [list, query]);

  const folder = filteredFolders.find((item) => item.id === folderId) || null;
  const files = folder?.prompts || [];
  const file = files.find((item) => item.id === fileId) || null;
  const steps = (file?.steps || []).filter((step) => String(step.prompt || '').replace(/<[^>]+>/g, '').trim());
  const urlEntries = useMemo(
    () => (file ? normalizeReferences(file).filter((item) => String(item.url || '').trim()) : []),
    [file],
  );
  const promptCount = file ? countFilePrompts(file) : 0;
  const urlCount = urlEntries.length;

  function resetToFolders() {
    setFolderId(null);
    setFileId(null);
    setLeaf(null);
  }

  function openFolder(id) {
    setFolderId(id);
    setFileId(null);
    setLeaf(null);
  }

  function openFile(id) {
    setFileId(id);
    setLeaf(null);
  }

  function backToFileRoot() {
    setLeaf(null);
  }

  function goBack() {
    if (leaf) {
      setLeaf(null);
      return;
    }
    if (fileId) {
      setFileId(null);
      setLeaf(null);
      return;
    }
    if (folderId) resetToFolders();
  }

  const canGoBack = Boolean(folderId);

  return (
    <div className="tp-browser">
      <div className="tp-browser__head">
        <p className="tp-browser__title">Library</p>
        <input
          className="tp-browser__search"
          type="search"
          value={query}
          placeholder="Search folder or file"
          aria-label="Search folder or file"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="tp-browser__nav">
        <button
          type="button"
          className={!folderId ? 'tp-browser__crumb is-current' : 'tp-browser__crumb'}
          onClick={resetToFolders}
        >
          Folders
        </button>
        {folder ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <button
              type="button"
              className={!fileId ? 'tp-browser__crumb is-current' : 'tp-browser__crumb'}
              onClick={() => openFolder(folder.id)}
            >
              {folder.label || 'Folder'}
            </button>
          </>
        ) : null}
        {file ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <button
              type="button"
              className={!leaf ? 'tp-browser__crumb is-current' : 'tp-browser__crumb'}
              onClick={backToFileRoot}
            >
              {fileDisplayName(file)}
            </button>
          </>
        ) : null}
        {leaf === 'prompt' ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <span className="tp-browser__crumb is-current">Prompt</span>
          </>
        ) : null}
        {leaf === 'urls' ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <span className="tp-browser__crumb is-current">URLs</span>
          </>
        ) : null}
        {leaf === 'instructions' ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <span className="tp-browser__crumb is-current">Instructions</span>
          </>
        ) : null}
      </div>

      <div className="tp-browser__list scroll-match-bg">
        {!folder ? (
          filteredFolders.length ? filteredFolders.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tp-browser__row tp-browser__row--nav"
              onClick={() => openFolder(item.id)}
            >
              <span className="tp-browser__row-main">
                <span className="tp-browser__glyph" aria-hidden="true"><IconFolder /></span>
                <span className="tp-browser__row-label">{item.label || 'Folder'}</span>
              </span>
              <span className="tp-browser__chevron" aria-hidden="true"><IconChevron /></span>
            </button>
          )) : (
            <p className="tp-browser__empty">No folders on the desk.</p>
          )
        ) : !file ? (
          files.length ? (
            <>
              <div className="tp-browser__section">
                <span>Files</span>
                <span className="tp-browser__count">{files.length}</span>
              </div>
              {files.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="tp-browser__row tp-browser__row--nav"
                  onClick={() => openFile(item.id)}
                >
                  <span className="tp-browser__row-main">
                    <span className="tp-browser__glyph" aria-hidden="true"><IconFile /></span>
                    <span className="tp-browser__row-label">
                      {fileDisplayName(item)}
                      {index > 0 ? (
                        <span className="tp-browser__index">{String(index + 1).padStart(2, '0')}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="tp-browser__chevron" aria-hidden="true"><IconChevron /></span>
                </button>
              ))}
            </>
          ) : (
            <p className="tp-browser__empty">This folder has no files.</p>
          )
        ) : !leaf ? (
          <>
            <button
              type="button"
              className="tp-browser__row tp-browser__row--nav"
              onClick={() => setLeaf('prompt')}
            >
              <span className="tp-browser__row-main">
                <span className="tp-browser__row-label">Prompt</span>
              </span>
              <span className="tp-browser__trail">
                <span className="tp-browser__count">{promptCount}</span>
                <span className="tp-browser__chevron" aria-hidden="true"><IconChevron /></span>
              </span>
            </button>
            <button
              type="button"
              className="tp-browser__row tp-browser__row--nav"
              onClick={() => setLeaf('urls')}
            >
              <span className="tp-browser__row-main">
                <span className="tp-browser__row-label">URLs</span>
              </span>
              <span className="tp-browser__trail">
                <span className="tp-browser__count">{urlCount}</span>
                <span className="tp-browser__chevron" aria-hidden="true"><IconChevron /></span>
              </span>
            </button>
            <button
              type="button"
              className="tp-browser__row tp-browser__row--nav"
              onClick={() => setLeaf('instructions')}
            >
              <span className="tp-browser__row-main">
                <span className="tp-browser__row-label">Instructions</span>
              </span>
              <span className="tp-browser__trail">
                <span className="tp-browser__chevron" aria-hidden="true"><IconChevron /></span>
              </span>
            </button>
          </>
        ) : leaf === 'urls' ? (
          urlEntries.length ? urlEntries.map((entry) => (
            <div key={entry.id} className="tp-browser__item">
              <div className="tp-browser__item-copy">
                <span className="tp-browser__badge">URL</span>
                {String(entry.name || '').trim() ? (
                  <strong>{entry.name}</strong>
                ) : null}
                <p className="tp-browser__href">{entry.url}</p>
              </div>
              <button
                type="button"
                className="tp-browser__insert"
                disabled={!canInsert}
                onClick={() => onInsertUrl({
                  href: entry.url,
                  title: String(entry.name || '').trim(),
                  body: entry.url,
                })}
              >
                Insert
              </button>
            </div>
          )) : (
            <p className="tp-browser__empty">This file has no URLs.</p>
          )
        ) : leaf === 'instructions' ? (
          <div className="tp-browser__instruction-form">
            <p className="tp-browser__hint">
              Short note for the teleprompter — paste a folder name, link, or reminder under the last block.
            </p>
            <label className="tp-browser__field">
              <span>Title</span>
              <input
                type="text"
                value={instructionTitle}
                placeholder="e.g. Paste Drive folder"
                onChange={(event) => setInstructionTitle(event.target.value)}
              />
            </label>
            <label className="tp-browser__field">
              <span>Note to copy</span>
              <textarea
                rows={3}
                value={instructionBody}
                placeholder="Text you’ll paste into the tool"
                onChange={(event) => setInstructionBody(event.target.value)}
              />
            </label>
            <label className="tp-browser__field">
              <span>Link (optional)</span>
              <input
                type="url"
                value={instructionHref}
                placeholder="https://"
                onChange={(event) => setInstructionHref(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="tp-browser__insert"
              disabled={
                !canInsert
                || (!String(instructionBody || '').trim() && !String(instructionHref || '').trim())
              }
              onClick={() => {
                const title = String(instructionTitle || '').trim() || 'Instruction';
                const body = String(instructionBody || '').trim();
                const href = String(instructionHref || '').trim();
                onInsertInstruction?.({ title, body, href, preview: body.slice(0, 180) });
                setInstructionTitle('');
                setInstructionBody('');
                setInstructionHref('');
              }}
            >
              Insert
            </button>
          </div>
        ) : (
          steps.length ? steps.map((step, index) => {
            const plain = stepPlainBody(file, step);
            const meta = stepModelCardMeta(file, step);
            const targetBits = [meta.modelLabel, meta.recommendedModel].filter(Boolean);
            return (
              <div key={step.id} className="tp-browser__item tp-browser__item--prompt">
                <div className="tp-browser__item-copy">
                  <div className="tp-browser__prompt-head">
                    <span className="tp-block__model" title={meta.modelLabel || 'Model'}>
                      <ModelGlyph src={meta.modelSrc} label={meta.modelLabel} />
                    </span>
                    <div>
                      <span className="tp-browser__badge">Prompt {index + 1}</span>
                      <strong>{stepInsertLabel(file, step)}</strong>
                      {targetBits.length ? (
                        <p className="tp-browser__target">{targetBits.join(' · ')}</p>
                      ) : null}
                    </div>
                  </div>
                  <p>{plain.slice(0, 120) || 'No text'}</p>
                </div>
                <button
                  type="button"
                  className="tp-browser__insert"
                  disabled={!canInsert || !plain}
                  onClick={() => onInsertPrompt(buildPromptInsertPayload(folder, file, step))}
                >
                  Insert
                </button>
              </div>
            );
          }) : (
            <p className="tp-browser__empty">This file has no prompts with text.</p>
          )
        )}
        {canGoBack ? (
          <button type="button" className="tp-browser__back" onClick={goBack}>
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Teleprompter page: script nodes (text + linked prompt/url blocks),
 * desk browser on the right, play coloring + Copy on blocks.
 */
export default function TeleprompterPage({ folders = [] }) {
  const email = useAuthStore((state) => state.user?.email || '');
  const profilePlan = usePlanStore((state) => state.profile.plan);
  const plan = deskPlan(email, profilePlan);

  const [nodes, setNodes] = useState(() => [blankTextNode('')]);
  const [scriptTitle, setScriptTitle] = useState('');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [library, setLibrary] = useState(() => readTelepromptLibrary());
  const [activeTelepromptId, setActiveTelepromptId] = useState('');
  const [createGateOpen, setCreateGateOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [rightTab, setRightTab] = useState(readStoredRightTab);
  const [cps, setCps] = useState(DEFAULT_CPS);
  const [paceMode, setPaceMode] = useState(readStoredPaceMode);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [floating, setFloating] = useState(false);
  const [floatCollapsed, setFloatCollapsed] = useState(false);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [insertAfterTextId, setInsertAfterTextId] = useState('');
  const [copyFlash, setCopyFlash] = useState({ id: '', kind: '' });
  const [saveFlash, setSaveFlash] = useState(false);
  const [createPulse, setCreatePulse] = useState(false);
  const [pausedBlockId, setPausedBlockId] = useState('');
  const [createdCount, setCreatedCount] = useState(() => readTelepromptCreatedCount());
  const copyFlashTimerRef = useRef(0);
  const saveFlashTimerRef = useRef(0);
  const createPulseTimerRef = useRef(0);
  const activeTelepromptIdRef = useRef('');
  const libraryRef = useRef(library);

  const floatRef = useRef(null);
  const designVideoRef = useRef(null);
  const playingRef = useRef(false);
  const cursorRef = useRef(0);
  const textRef = useRef('');
  const nodesRef = useRef(nodes);
  const cpsRef = useRef(DEFAULT_CPS);
  const paceModeRef = useRef(paceMode);
  const vadRef = useRef(null);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const carryRef = useRef(0);
  const clearedBlocksRef = useRef(new Set());
  const pausedBlockIdRef = useRef('');

  const playText = useMemo(() => joinScriptText(nodes), [nodes]);
  const offsets = useMemo(() => scriptOffsets(nodes), [nodes]);
  const totalPaceUnits = useMemo(() => pacedUnitsInText(playText), [playText]);
  const elapsedPaceUnits = useMemo(() => pacedUnitsInText(playText, cursor), [playText, cursor]);
  const durationSec = cps > 0 ? totalPaceUnits / cps : 0;
  const elapsedSec = cps > 0 ? elapsedPaceUnits / cps : 0;
  const durationLabel = formatDuration(durationSec);
  const elapsedLabel = formatDuration(elapsedSec);
  const showReader = sessionOpen && (playing || cursor > 0);
  const hasScriptBody = Boolean(playText.trim() || nodes.some((node) => node.type !== 'text'));
  const canPlay = sessionOpen && hasScriptBody;
  const canEditContent = sessionOpen && isEditing;
  const canSaveTeleprompt = canEditContent && hasScriptBody;
  const telepromptSlotsOpen = canAddTeleprompt(createdCount, plan);
  const isFreePlan = !isPromptPro(plan);
  const activeLibraryItem = useMemo(
    () => library.find((entry) => entry.id === activeTelepromptId) || null,
    [library, activeTelepromptId],
  );
  const editAllowedForActive = !activeLibraryItem || canEditTeleprompt(activeLibraryItem, plan);

  const activeBlockId = useMemo(() => {
    if (pausedBlockId) return pausedBlockId;
    for (let i = 0; i < offsets.length; i += 1) {
      const meta = offsets[i];
      const node = nodes[i];
      if (!node || node.type === 'text') continue;
      if (meta.start === cursor) return node.id;
    }
    let current = '';
    for (let i = 0; i < offsets.length; i += 1) {
      const meta = offsets[i];
      const node = nodes[i];
      if (!node || node.type === 'text') continue;
      if (cursor > meta.start) current = node.id;
    }
    return current;
  }, [cursor, nodes, offsets, pausedBlockId]);

  useEffect(() => {
    textRef.current = playText;
  }, [playText]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forceReset = params.get('reset-tele') === '1';
    let wiped = null;
    if (forceReset) {
      wiped = clearTelepromptFreeMeters();
      params.delete('reset-tele');
      const search = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`,
      );
    } else if (applyTelepromptFreeUsageEpoch(email)) {
      wiped = {
        createdCount: readTelepromptCreatedCount(),
        library: readTelepromptLibrary(),
      };
    }
    if (!wiped) return;
    setCreatedCount(wiped.createdCount);
    setLibrary(wiped.library);
    libraryRef.current = wiped.library;
  }, [email]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    activeTelepromptIdRef.current = activeTelepromptId;
  }, [activeTelepromptId]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    cpsRef.current = cps;
  }, [cps]);

  useEffect(() => {
    paceModeRef.current = paceMode;
    try {
      localStorage.setItem(PACE_MODE_STORE, paceMode);
    } catch {
      /* Private mode */
    }
  }, [paceMode]);

  useEffect(() => {
    try {
      localStorage.setItem(RIGHT_TAB_STORE, rightTab);
    } catch {
      /* Private mode */
    }
  }, [rightTab]);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_THEME_STORE);
    } catch {
      /* Private mode */
    }
  }, []);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => () => {
    closeVadMic(vadRef.current);
    vadRef.current = null;
    if (saveFlashTimerRef.current) {
      window.clearTimeout(saveFlashTimerRef.current);
      saveFlashTimerRef.current = 0;
    }
    if (createPulseTimerRef.current) {
      window.clearTimeout(createPulseTimerRef.current);
      createPulseTimerRef.current = 0;
    }
  }, []);

  function bumpCps(delta) {
    setCps((value) => Math.min(CPS_MAX, Math.max(CPS_MIN, value + delta)));
  }

  function stopLoop() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }

  function releaseVad() {
    closeVadMic(vadRef.current);
    vadRef.current = null;
    setVoiceReady(false);
  }

  async function ensureVad() {
    if (vadRef.current) {
      if (vadRef.current.ctx?.state === 'suspended') {
        try {
          await vadRef.current.ctx.resume();
        } catch {
          /* ignore */
        }
      }
      setVoiceReady(true);
      return true;
    }
    try {
      vadRef.current = await openVadMic();
      setVoiceReady(true);
      setVoiceNote('');
      return true;
    } catch (error) {
      setVoiceReady(false);
      setVoiceNote(error?.message || 'Microphone permission is required for Voice mode.');
      return false;
    }
  }

  async function selectPaceMode(next) {
    const mode = next === 'voice' ? 'voice' : 'speed';
    if (mode === paceMode) return;
    pausePlay();
    if (mode === 'voice') {
      const ok = await ensureVad();
      if (!ok) {
        setPaceMode('speed');
        return;
      }
      setPaceMode('voice');
      return;
    }
    releaseVad();
    setVoiceNote('');
    setPaceMode('speed');
  }

  function pauseAtBlock(blockId, at) {
    cursorRef.current = at;
    setCursor(at);
    pausedBlockIdRef.current = blockId || '';
    setPausedBlockId(blockId || '');
    playingRef.current = false;
    setPlaying(false);
    stopLoop();
  }

  function advanceCursor(from, end, chars) {
    let next = from;
    let moved = false;
    while (next < end) {
      const cost = charPaceWeight(chars[next]);
      if (carryRef.current < cost) break;
      const rawNext = next + 1;
      const gate = nextBlockPause(nodesRef.current, next, rawNext, clearedBlocksRef.current);
      if (gate) {
        carryRef.current = 0;
        pauseAtBlock(gate.blockId, gate.at);
        return { from: gate.at, moved: true, gated: true };
      }
      carryRef.current -= cost;
      next = rawNext;
      moved = true;
    }
    return { from: next, moved, gated: false };
  }

  function tick(now) {
    if (!playingRef.current) return;
    if (!lastTickRef.current) lastTickRef.current = now;
    const delta = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;

    const voiceMode = paceModeRef.current === 'voice';
    if (voiceMode) {
      const level = vadLevel(vadRef.current);
      if (level < VAD_THRESHOLD) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      carryRef.current += delta * VOICE_CPS;
    } else {
      carryRef.current += delta * Math.max(1, cpsRef.current);
    }

    const chars = Array.from(String(textRef.current || ''));
    const end = chars.length;
    const result = advanceCursor(cursorRef.current, end, chars);
    if (result.gated) return;
    if (result.moved) {
      cursorRef.current = result.from;
      setCursor(result.from);
      if (result.from >= end) {
        playingRef.current = false;
        setPlaying(false);
        stopLoop();
        markActiveScriptDone();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function startPlay() {
    const list = nodesRef.current || [];
    const hasBlocks = list.some((node) => node.type !== 'text');
    if (!textRef.current.trim() && !hasBlocks) return;

    if (paceModeRef.current === 'voice') {
      const ok = await ensureVad();
      if (!ok) {
        setPaceMode('speed');
        paceModeRef.current = 'speed';
        return;
      }
    }

    if (pausedBlockIdRef.current) {
      clearedBlocksRef.current.add(pausedBlockIdRef.current);
      pausedBlockIdRef.current = '';
      setPausedBlockId('');
    }

    if (!textRef.current.trim()) {
      /* Blocks only: highlight first uncleared gate, no char motion. */
      const gate = nextBlockPause(list, cursorRef.current, cursorRef.current, clearedBlocksRef.current);
      if (gate) {
        pauseAtBlock(gate.blockId, gate.at);
        return;
      }
      setPlaying(false);
      return;
    }

    if (cursorRef.current >= countChars(textRef.current)) {
      cursorRef.current = 0;
      setCursor(0);
      clearedBlocksRef.current = new Set();
      pausedBlockIdRef.current = '';
      setPausedBlockId('');
    }

    carryRef.current = 0;
    lastTickRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
    stopLoop();
    rafRef.current = requestAnimationFrame(tick);
  }

  function pausePlay() {
    playingRef.current = false;
    setPlaying(false);
    stopLoop();
  }

  function pauseReferenceVideo() {
    const video = designVideoRef.current;
    if (!video || video.paused) return false;
    video.pause();
    return true;
  }

  function pauseWithSpaceShortcut() {
    let handled = false;
    if (playingRef.current) {
      pausePlay();
      handled = true;
    }
    if (pauseReferenceVideo()) handled = true;
    return handled;
  }

  function resetPlay() {
    pausePlay();
    cursorRef.current = 0;
    carryRef.current = 0;
    clearedBlocksRef.current = new Set();
    pausedBlockIdRef.current = '';
    setPausedBlockId('');
    setCursor(0);
  }

  function resetGates() {
    clearedBlocksRef.current = new Set();
    pausedBlockIdRef.current = '';
    setPausedBlockId('');
  }

  function persistLibrary(next) {
    const saved = writeTelepromptLibrary(next);
    libraryRef.current = saved;
    setLibrary(saved);
    return saved;
  }

  function markActiveScriptDone() {
    const id = activeTelepromptIdRef.current;
    if (!id) return;
    const current = libraryRef.current || [];
    const item = current.find((entry) => entry.id === id);
    if (!item || item.status === TELEPROMPT_STATUS.completed) return;
    persistLibrary(current.map((entry) => (
      entry.id === id
        ? { ...entry, status: TELEPROMPT_STATUS.completed, updatedAt: new Date().toISOString() }
        : entry
    )));
  }

  function nudgeCreateNew() {
    if (sessionOpen) return;
    setRightTab('list');
    if (!canAddTeleprompt(createdCount, plan)) {
      setCreateGateOpen(true);
      return;
    }
    setCreatePulse(true);
    if (createPulseTimerRef.current) window.clearTimeout(createPulseTimerRef.current);
    createPulseTimerRef.current = window.setTimeout(() => {
      setCreatePulse(false);
      createPulseTimerRef.current = 0;
    }, 1400);
  }

  function guardIdleEditor(event) {
    if (sessionOpen) return false;
    event.preventDefault();
    event.currentTarget.blur?.();
    nudgeCreateNew();
    return true;
  }

  function clearEditor() {
    pausePlay();
    setActiveTelepromptId('');
    setScriptTitle('');
    setIsEditing(false);
    setInsertAfterTextId('');
    setNodes([blankTextNode('')]);
    cursorRef.current = 0;
    carryRef.current = 0;
    clearedBlocksRef.current = new Set();
    pausedBlockIdRef.current = '';
    setPausedBlockId('');
    setCursor(0);
  }

  function createNewTeleprompt() {
    if (isEditing) return;
    if (!canAddTeleprompt(createdCount, plan)) {
      setCreateGateOpen(true);
      setRightTab('list');
      return;
    }
    setCreateGateOpen(false);
    clearEditor();
    setSessionOpen(true);
    setIsEditing(true);
    setRightTab('list');
  }

  async function upgradeToProCheckout() {
    if (upgradeBusy) return;
    setUpgradeBusy(true);
    try {
      const { url } = await startProCheckout('monthly', { cancelReturn: 'app' });
      if (url) {
        window.location.assign(url);
        return;
      }
      throw new Error('No checkout URL');
    } catch (error) {
      console.warn('[teleprompter] checkout failed', error?.message || error);
      setUpgradeBusy(false);
    }
  }

  function discardSession() {
    if (!sessionOpen) return;
    const id = activeTelepromptId;
    clearEditor();
    setSessionOpen(false);
    if (id) {
      persistLibrary(library.filter((entry) => entry.id !== id));
    }
  }

  function beginEditSession() {
    if (!sessionOpen || isEditing) return;
    if (activeLibraryItem && !canEditTeleprompt(activeLibraryItem, plan)) return;
    setIsEditing(true);
  }

  function openTeleprompt(id) {
    const item = library.find((entry) => entry.id === id);
    if (!item) return;
    pausePlay();
    setSessionOpen(true);
    setIsEditing(false);
    setInsertAfterTextId('');
    setActiveTelepromptId(item.id);
    setScriptTitle(item.name || '');
    setNodes(item.nodes?.length ? item.nodes : [blankTextNode('')]);
    cursorRef.current = 0;
    carryRef.current = 0;
    clearedBlocksRef.current = new Set();
    pausedBlockIdRef.current = '';
    setPausedBlockId('');
    setCursor(0);
  }

  function saveCurrentTeleprompt() {
    if (!canEditContent) return;
    if (!hasScriptBody) return;
    const existing = activeTelepromptId
      ? library.find((entry) => entry.id === activeTelepromptId)
      : null;
    if (!existing && !canAddTeleprompt(createdCount, plan)) {
      setCreateGateOpen(true);
      return;
    }
    if (existing && !canEditTeleprompt(existing, plan)) return;
    const name = String(scriptTitle || '').trim() || UNTITLED_SCRIPT_NAME;
    const now = new Date().toISOString();
    const nextItem = blankTeleprompt({
      id: existing?.id,
      name: name.slice(0, SCRIPT_TITLE_MAX),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      status: existing?.status || TELEPROMPT_STATUS.pending,
      nodes,
    });
    const without = library.filter((entry) => entry.id !== nextItem.id);
    persistLibrary([nextItem, ...without]);
    if (!existing) {
      setCreatedCount(bumpTelepromptCreatedCount());
    }
    setScriptTitle(nextItem.name);
    setActiveTelepromptId(nextItem.id);
    setIsEditing(false);
    setInsertAfterTextId('');
    setRightTab('list');
    setSaveFlash(true);
    if (saveFlashTimerRef.current) window.clearTimeout(saveFlashTimerRef.current);
    saveFlashTimerRef.current = window.setTimeout(() => {
      setSaveFlash(false);
      saveFlashTimerRef.current = 0;
    }, 1600);
  }

  function deleteTeleprompt(id) {
    const next = library.filter((entry) => entry.id !== id);
    persistLibrary(next);
    if (activeTelepromptId === id) {
      clearEditor();
      setSessionOpen(false);
    }
  }

  function patchScriptTitle(value) {
    if (!canEditContent) return;
    setScriptTitle(String(value || '').slice(0, SCRIPT_TITLE_MAX));
  }

  function toggleTelepromptStatus(id) {
    persistLibrary(library.map((entry) => {
      if (entry.id !== id) return entry;
      return {
        ...entry,
        status: entry.status === TELEPROMPT_STATUS.completed
          ? TELEPROMPT_STATUS.pending
          : TELEPROMPT_STATUS.completed,
        updatedAt: new Date().toISOString(),
      };
    }));
  }

  function updateTextNode(id, body) {
    if (!canEditContent) return;
    setNodes((prev) => prev.map((node) => (
      node.id === id && node.type === 'text' ? { ...node, body } : node
    )));
    resetGates();
    setCursor(0);
  }

  function trailingTextId(list) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i]?.type === 'text') return list[i].id;
    }
    return '';
  }

  function removeNode(id) {
    if (!canEditContent) return;
    const target = nodes.find((node) => node.id === id);
    if (target?.type === 'text' && trailingTextId(nodes) === id) return;
    setInsertAfterTextId((current) => (current === id ? '' : current));
    setNodes((prev) => {
      const next = prev.filter((node) => node.id !== id);
      return next.length ? next : [blankTextNode('')];
    });
    resetGates();
    setCursor(0);
  }

  function placeBlockInScript(prev, block) {
    const anchorId = insertAfterTextId;
    const anchorIndex = anchorId
      ? prev.findIndex((node) => node.id === anchorId && node.type === 'text')
      : -1;
    let insertAt = prev.length;
    if (anchorIndex >= 0) {
      insertAt = anchorIndex + 1;
      while (insertAt < prev.length && isTeleprompterCopyBlock(prev[insertAt])) {
        insertAt += 1;
      }
    }
    const head = prev.slice(0, insertAt);
    const tail = prev.slice(insertAt);
    const prevNode = insertAt > 0 ? prev[insertAt - 1] : null;
    const extendingSequence = isTeleprompterCopyBlock(prevNode);
    // First copy-block in a sequence creates one text placeholder; later ones reuse it.
    if (extendingSequence) {
      return [...head, block, ...tail];
    }
    if (tail[0]?.type === 'text' && !String(tail[0].body || '').trim()) {
      return [...head, block, tail[0], ...tail.slice(1)];
    }
    return [...head, block, blankTextNode(''), ...tail];
  }

  function insertPromptBlock(payload) {
    if (!canEditContent) return;
    setNodes((prev) => {
      const block = {
        id: makeTpId(),
        type: 'prompt',
        folderId: payload.folderId,
        fileId: payload.fileId,
        stepId: payload.stepId,
        title: payload.title,
        body: String(payload.body || ''),
        preview: String(payload.preview || payload.body || '').slice(0, 180),
        modelId: payload.modelId || '',
        modelLabel: payload.modelLabel || '',
        modelSrc: payload.modelSrc || '',
        recommendedModel: payload.recommendedModel || '',
      };
      return placeBlockInScript(prev, block);
    });
    resetGates();
    setCursor(0);
  }

  function insertUrlBlock(payload) {
    if (!canEditContent) return;
    setNodes((prev) => {
      const href = String(payload.href || '').trim();
      const block = {
        id: makeTpId(),
        type: 'url',
        href,
        title: payload.title || href,
        body: String(payload.body || href),
      };
      return placeBlockInScript(prev, block);
    });
    resetGates();
    setCursor(0);
  }

  function insertInstructionBlock(payload) {
    if (!canEditContent) return;
    setNodes((prev) => {
      const body = String(payload.body || '').trim();
      const href = String(payload.href || '').trim();
      const block = {
        id: makeTpId(),
        type: 'instruction',
        title: String(payload.title || '').trim() || 'Instruction',
        body,
        href,
        preview: String(payload.preview || body).slice(0, 180),
      };
      return placeBlockInScript(prev, block);
    });
    resetGates();
    setCursor(0);
  }

  function flashCopy(nodeId, kind) {
    if (copyFlashTimerRef.current) {
      window.clearTimeout(copyFlashTimerRef.current);
      copyFlashTimerRef.current = 0;
    }
    setCopyFlash({ id: nodeId, kind });
    copyFlashTimerRef.current = window.setTimeout(() => {
      setCopyFlash((current) => (current.id === nodeId ? { id: '', kind: '' } : current));
      copyFlashTimerRef.current = 0;
    }, 1400);
  }

  async function copyBlock(node, hostWindow) {
    const plain = resolveBlockCopyText(node, folders);
    if (!plain) {
      flashCopy(node.id, 'empty');
      return;
    }
    if (node.type !== 'text' && plain !== String(node.body || '').trim()) {
      setNodes((prev) => prev.map((item) => (
        item.id === node.id ? { ...item, body: plain } : item
      )));
    }
    const host = hostWindow && !hostWindow.closed ? hostWindow : window;
    try {
      host.focus?.();
    } catch {
      /* ignore */
    }
    const ok = await copyToClipboard(plain, host);
    flashCopy(node.id, ok ? 'copied' : 'fail');
  }

  function closeFloat() {
    const slot = floatRef.current;
    if (!slot) return;
    floatRef.current = null;
    try {
      slot.root.unmount();
    } catch {
      /* already gone */
    }
    try {
      slot.window.close();
    } catch {
      /* already closed */
    }
    setFloating(false);
    setFloatCollapsed(false);
  }

  function bindFloatWindow(hostWindow) {
    const mount = mountFloatDocument(hostWindow);
    const root = createRoot(mount);
    const onHide = () => {
      hostWindow.removeEventListener('pagehide', onHide);
      if (floatRef.current?.window !== hostWindow) return;
      floatRef.current = null;
      try {
        root.unmount();
      } catch {
        /* already gone */
      }
      setFloating(false);
      setFloatCollapsed(false);
    };
    hostWindow.addEventListener('pagehide', onHide);
    floatRef.current = { window: hostWindow, root };
    setFloatCollapsed(false);
    setFloating(true);
    resizeFloatWindow(hostWindow, false);
  }

  async function openFloat() {
    const openSlot = floatRef.current;
    if (openSlot?.window && !openSlot.window.closed) {
      try {
        openSlot.window.focus();
      } catch {
        /* ignore */
      }
      setFloating(true);
      resizeFloatWindow(openSlot.window, false);
      setFloatCollapsed(false);
      return;
    }

    const api = window.documentPictureInPicture;
    if (api?.requestWindow) {
      try {
        const pipWindow = await api.requestWindow({
          width: FLOAT_SIZE.width,
          height: FLOAT_SIZE.height,
        });
        bindFloatWindow(pipWindow);
        return;
      } catch (error) {
        console.warn('[teleprompter] Document PiP failed', error);
        window.alert(
          error?.message
            ? `No se pudo expandir: ${error.message}`
            : 'No se pudo abrir el float. Permití Picture-in-Picture e intentá de nuevo.',
        );
        return;
      }
    }

    const popup = window.open(
      '',
      'fn-teleprompter-float',
      `popup=yes,width=${FLOAT_SIZE.width},height=${FLOAT_SIZE.height}`,
    );
    if (!popup) {
      window.alert('No se pudo abrir el float. Este Chrome no soporta Document PiP; permití popups.');
      return;
    }
    bindFloatWindow(popup);
  }

  function toggleFloatCollapsed() {
    setFloatCollapsed((value) => {
      const next = !value;
      resizeFloatWindow(floatRef.current?.window, next);
      return next;
    });
  }

  function openGhost() {
    setGhostOpen(true);
  }

  function closeGhost() {
    setGhostOpen(false);
  }

  useEffect(() => {
    if (!ghostOpen) return undefined;
    function onEscape(event) {
      if (event.key !== 'Escape') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      closeGhost();
    }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [ghostOpen]);

  useEffect(() => () => {
    setGhostOpen(false);
  }, []);

  useEffect(() => {
    function onSpacePause(event) {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      if (!pauseWithSpaceShortcut()) return;
      event.preventDefault();
    }
    window.addEventListener('keydown', onSpacePause);
    return () => window.removeEventListener('keydown', onSpacePause);
  }, []);

  useEffect(() => {
    const slot = floatRef.current;
    if (!slot?.root || !floating) return;
    if (slot.window?.closed) {
      floatRef.current = null;
      setFloating(false);
      return;
    }
    applyFloatTheme(slot.window);
    const floatWindow = slot.window;
    function onFloatSpacePause(event) {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      if (!pauseWithSpaceShortcut()) return;
      event.preventDefault();
    }
    floatWindow?.addEventListener('keydown', onFloatSpacePause);
    slot.root.render(
      <FloatSurface
        nodes={nodes}
        cursor={cursor}
        cps={cps}
        durationLabel={durationLabel}
        elapsedLabel={elapsedLabel}
        playing={playing}
        collapsed={floatCollapsed}
        activeBlockId={activeBlockId}
        copyFlash={copyFlash}
        canPlay={canPlay}
        onToggleCollapse={toggleFloatCollapsed}
        onPlay={startPlay}
        onPause={pausePlay}
        onCopyBlock={(node) => { void copyBlock(node, slot.window); }}
      />,
    );
    return () => {
      floatWindow?.removeEventListener('keydown', onFloatSpacePause);
    };
  }, [floating, nodes, cursor, cps, durationLabel, elapsedLabel, playing, floatCollapsed, activeBlockId, copyFlash, canPlay, folders]);

  useEffect(() => () => {
    stopLoop();
    const slot = floatRef.current;
    if (!slot) return;
    floatRef.current = null;
    try {
      slot.root.unmount();
      slot.window.close();
    } catch {
      /* closing */
    }
  }, []);

  return (
    <div className="tp-page" data-tp-theme={TP_THEME}>
      <div className="tp-shell">
        <div className="tp-left">
          <div
            className="tp-paste"
            onPointerDownCapture={(event) => {
              if (sessionOpen) return;
              if (event.target.closest('button, a, input, textarea')) return;
              nudgeCreateNew();
            }}
          >
            {sessionOpen ? (
              <div className="tp-float-actions" role="toolbar" aria-label="Script actions">
                {!isEditing ? (
                  <div className="tp-edit-wrap">
                    <button
                      type="button"
                      className={editAllowedForActive ? 'tp-title-action' : 'tp-title-action is-gated'}
                      aria-label="Edit"
                      title={editAllowedForActive ? 'Edit' : 'Upgrade to Pro to edit'}
                      disabled={!editAllowedForActive}
                      onClick={beginEditSession}
                    >
                      <IconEdit />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="tp-title-action tp-title-action--danger"
                  aria-label="Discard script"
                  title="Discard"
                  onClick={discardSession}
                >
                  <IconTrash />
                </button>
                {isEditing || saveFlash ? (
                  <button
                    type="button"
                    className={saveFlash ? 'tp-title-save is-saved' : 'tp-title-save'}
                    disabled={saveFlash || !canSaveTeleprompt}
                    onClick={saveCurrentTeleprompt}
                  >
                    {saveFlash ? 'Saved' : 'Save'}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="tp-paste__top">
              <div className={canEditContent ? 'tp-title-box' : 'tp-title-box is-saved'}>
                <textarea
                  id="tp-script-title"
                  className="tp-paste__title"
                  value={scriptTitle}
                  placeholder="Script Title"
                  aria-label="Script title"
                  rows={1}
                  maxLength={SCRIPT_TITLE_MAX}
                  readOnly={!canEditContent}
                  onPointerDown={(event) => {
                    if (guardIdleEditor(event)) return;
                  }}
                  onFocus={(event) => {
                    if (guardIdleEditor(event)) return;
                  }}
                  onChange={(event) => patchScriptTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (!sessionOpen) {
                      guardIdleEditor(event);
                      return;
                    }
                    if (event.key === 'Enter') event.preventDefault();
                  }}
                />
              </div>
            </div>

            {showReader ? (
              <ScriptReader
                nodes={nodes}
                cursor={cursor}
                activeBlockId={activeBlockId}
                copyFlash={copyFlash}
                onCopyBlock={(node) => { void copyBlock(node, window); }}
                className="tp-reader scroll-match-bg"
              />
            ) : (
              <div
                className={canEditContent ? 'tp-script scroll-match-bg' : 'tp-script tp-script--locked scroll-match-bg'}
                onPointerDownCapture={(event) => {
                  if (sessionOpen) return;
                  if (event.target.closest('textarea, button')) return;
                  nudgeCreateNew();
                }}
              >
                {nodes.map((node, index) => (
                  node.type === 'text' ? (
                    <div
                      key={node.id}
                      className={
                        insertAfterTextId === node.id
                          ? 'tp-script__text-wrap is-anchor'
                          : 'tp-script__text-wrap'
                      }
                      onClick={(event) => {
                        if (!canEditContent) return;
                        if (event.target.closest('.tp-script__text-remove')) return;
                        setInsertAfterTextId(node.id);
                      }}
                    >
                      {canEditContent && trailingTextId(nodes) !== node.id ? (
                        <button
                          type="button"
                          className="tp-script__text-remove"
                          aria-label="Remove text block"
                          title="Remove text block"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeNode(node.id);
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                      {insertAfterTextId === node.id ? (
                        <span className="tp-script__anchor-tag">Insert below</span>
                      ) : null}
                      <textarea
                        className="tp-script__field"
                        placeholder="Write or paste your script…"
                        value={node.body}
                        rows={4}
                        readOnly={!canEditContent}
                        onPointerDown={(event) => {
                          if (guardIdleEditor(event)) return;
                          if (canEditContent) setInsertAfterTextId(node.id);
                        }}
                        onFocus={(event) => {
                          if (guardIdleEditor(event)) return;
                          if (canEditContent) setInsertAfterTextId(node.id);
                        }}
                        onKeyDown={(event) => {
                          if (!sessionOpen) guardIdleEditor(event);
                        }}
                        onChange={(event) => updateTextNode(node.id, event.target.value)}
                      />
                    </div>
                  ) : (
                    <ScriptBlockCard
                      key={node.id}
                      node={node}
                      active={false}
                      copyLabel={blockCopyLabel(copyFlash, node.id)}
                      onCopy={() => { void copyBlock(node, window); }}
                      onRemove={() => removeNode(node.id)}
                      underPrevious={node.type === 'instruction' && index > 0}
                      editing={canEditContent}
                    />
                  )
                ))}
              </div>
            )}
            <p className="tp-paste__hint">
              {!sessionOpen
                ? 'Press Create new to start a script'
                : !isEditing
                  ? 'Saved · press Edit to change this script'
                  : paceMode === 'voice'
                    ? 'Voice mode · scroll advances while you speak · Play pauses on each block for Copy'
                    : insertAfterTextId
                      ? 'Selected text block · first Insert adds a text placeholder · more Inserts stack without new text'
                      : 'Click a text block to choose insert spot · last text block stays · remove earlier text with ×'}
            </p>
            {voiceNote ? <p className="tp-paste__hint tp-paste__hint--alert" role="status">{voiceNote}</p> : null}
          </div>

          <div className="tp-toolkit" aria-label="Toolkit">
            <div className="tp-toolkit__meta">
              <div className="tp-pace" role="group" aria-label="Pace mode">
                <button
                  type="button"
                  className={paceMode === 'speed' ? 'tp-pace__btn is-active' : 'tp-pace__btn'}
                  aria-pressed={paceMode === 'speed'}
                  disabled={!sessionOpen}
                  onClick={() => { void selectPaceMode('speed'); }}
                >
                  Speed
                </button>
                <button
                  type="button"
                  className={paceMode === 'voice' ? 'tp-pace__btn is-active' : 'tp-pace__btn'}
                  aria-pressed={paceMode === 'voice'}
                  disabled={!sessionOpen}
                  onClick={() => { void selectPaceMode('voice'); }}
                >
                  Voice
                </button>
              </div>

              {paceMode === 'speed' ? (
                <div className="tp-counter" aria-label="Speed">
                  <span className="tp-counter__label">SPEED</span>
                  <button
                    type="button"
                    className="tp-counter__btn"
                    aria-label="Decrease speed"
                    disabled={!sessionOpen || cps <= CPS_MIN}
                    onClick={() => bumpCps(-1)}
                  >
                    −
                  </button>
                  <span className="tp-counter__value" aria-live="polite">{cps}</span>
                  <button
                    type="button"
                    className="tp-counter__btn"
                    aria-label="Increase speed"
                    disabled={!sessionOpen || cps >= CPS_MAX}
                    onClick={() => bumpCps(1)}
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="tp-voice-meta" aria-live="polite">
                  <span className="tp-counter__label">VOICE</span>
                  <span className={voiceReady ? 'tp-voice-meta__state is-ready' : 'tp-voice-meta__state'}>
                    {voiceReady ? 'Mic on' : 'Mic off'}
                  </span>
                </div>
              )}

              <div className="tp-tool--time" aria-live="polite">
                <span>{paceMode === 'voice' ? 'Estimate' : 'Duration'}</span>
                <strong>
                  {elapsedLabel} / {durationLabel}
                </strong>
              </div>
            </div>

            <div className="tp-toolkit__play">
              {playing ? (
                <button
                  type="button"
                  className="tp-btn-play"
                  onClick={pausePlay}
                  disabled={!sessionOpen}
                  aria-label="Pause"
                  title="Pause · Space"
                >
                  <IconPause />
                </button>
              ) : (
                <button
                  type="button"
                  className="tp-btn-play"
                  onClick={startPlay}
                  disabled={!canPlay}
                  aria-label="Play"
                  title="Play"
                >
                  <IconPlay />
                </button>
              )}
              <p className="tp-shortcut-hint" aria-hidden="true">
                <kbd>Space</kbd> Pause
              </p>
            </div>

            <div className="tp-toolkit__actions">
              <button
                type="button"
                className="tp-icon-btn tp-icon-btn--reset"
                onClick={resetPlay}
                disabled={!sessionOpen || (!playText && cursor === 0 && !nodes.some((node) => node.type !== 'text'))}
                aria-label="Reset"
                title="Reset"
              >
                <IconReset />
              </button>
              {showReader && !playing ? (
                <button
                  type="button"
                  className="tp-icon-btn"
                  onClick={resetPlay}
                  disabled={!sessionOpen}
                  aria-label="Edit"
                  title="Edit"
                >
                  <IconEdit />
                </button>
              ) : null}
              <button
                type="button"
                className={ghostOpen ? 'tp-icon-btn is-active' : 'tp-icon-btn'}
                disabled={!sessionOpen}
                onClick={() => {
                  if (ghostOpen) closeGhost();
                  else openGhost();
                }}
                aria-label={ghostOpen ? 'Close Ghost' : 'Open Ghost overlay'}
                aria-pressed={ghostOpen}
                title={ghostOpen ? 'Close Ghost' : 'Ghost · on-screen overlay for recording'}
              >
                <IconGhost />
              </button>
              <button
                type="button"
                className="tp-icon-btn"
                disabled={!sessionOpen}
                onClick={() => {
                  const slot = floatRef.current;
                  const open = Boolean(slot?.window && !slot.window.closed);
                  if (open) closeFloat();
                  else void openFloat();
                }}
                aria-label={floating ? 'Close float' : 'Expand in Chrome'}
                title={floating ? 'Close float' : 'Expand in Chrome'}
              >
                {floating ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>
          </div>
        </div>

        <div className="tp-right" aria-label="Teleprompter library">
          <div className="tp-right__tabs" role="tablist" aria-label="Library views">
            <button
              type="button"
              role="tab"
              className={rightTab === 'list' ? 'tp-right__tab is-active' : 'tp-right__tab'}
              aria-selected={rightTab === 'list'}
              onClick={() => setRightTab('list')}
            >
              Script
            </button>
            <button
              type="button"
              role="tab"
              className={rightTab === 'design' ? 'tp-right__tab is-active' : 'tp-right__tab'}
              aria-selected={rightTab === 'design'}
              onClick={() => setRightTab('design')}
            >
              Script Design
            </button>
            <button
              type="button"
              role="tab"
              className={rightTab === 'folders' ? 'tp-right__tab is-active' : 'tp-right__tab'}
              aria-selected={rightTab === 'folders'}
              onClick={() => setRightTab('folders')}
            >
              Folders
            </button>
          </div>
          {rightTab === 'list' ? (
            <TelepromptList
              items={library}
              activeId={activeTelepromptId}
              onOpen={openTeleprompt}
              onToggleStatus={toggleTelepromptStatus}
              onDelete={deleteTeleprompt}
              onCreateNew={createNewTeleprompt}
              canCreate={!isEditing}
              createCapped={!telepromptSlotsOpen}
              createPulse={createPulse}
              showQuota={isFreePlan}
              quotaUsed={Math.min(createdCount, FREE_TELEPROMPT_MAX)}
              quotaMax={FREE_TELEPROMPT_MAX}
            />
          ) : rightTab === 'design' ? (
            <ScriptDesignPanel videoRef={designVideoRef} />
          ) : (
            <DeskBrowser
              folders={folders}
              canInsert={canEditContent}
              onInsertPrompt={insertPromptBlock}
              onInsertUrl={insertUrlBlock}
              onInsertInstruction={insertInstructionBlock}
            />
          )}
        </div>
      </div>
      <TelepromptUpgradeModal
        open={createGateOpen}
        busy={upgradeBusy}
        onClose={() => {
          if (upgradeBusy) return;
          setCreateGateOpen(false);
        }}
        onUpgrade={() => { void upgradeToProCheckout(); }}
      />
      {ghostOpen
        ? createPortal(
          <GhostSurface
            nodes={nodes}
            cursor={cursor}
            cps={cps}
            durationLabel={durationLabel}
            elapsedLabel={elapsedLabel}
            playing={playing}
            activeBlockId={activeBlockId}
            copyFlash={copyFlash}
            canPlay={canPlay}
            onPlay={startPlay}
            onPause={pausePlay}
            onClose={closeGhost}
            onCopyBlock={(node) => { void copyBlock(node); }}
          />,
          document.body,
        )
        : null}
    </div>
  );
}
