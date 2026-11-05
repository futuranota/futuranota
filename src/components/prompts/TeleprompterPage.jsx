import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copyToClipboard } from '../../lib/copyToClipboard.js';
import { TRANSCRIPT_FOLDER_LABEL } from '../../lib/promptPlanLimits.js';
import { folderReferenceEntries } from '../../lib/promptReferences.js';
import { stepModelCardMeta } from '../../lib/promptModels.js';
import {
  blankTextNode,
  buildPromptInsertPayload,
  charPaceWeight,
  deskFoldersForTeleprompter,
  joinScriptText,
  makeTpId,
  nextBlockPause,
  pacedUnitsInText,
  resolveBlockCopyText,
  scriptOffsets,
  stepInsertLabel,
  stepPlainBody,
} from '../../lib/teleprompterScript.js';
import './teleprompter-page.css';

const DEFAULT_CPS = 14;
const FLOAT_SIZE = { width: 420, height: 480 };
const CPS_MIN = 5;
const CPS_MAX = 40;
const THEME_STORE = 'fn-teleprompter-theme';

const FLOAT_CSS = `
  html, body, #tp-float-root {
    margin: 0;
    width: 100%;
    height: 100%;
    font: 16px/1.55 ui-sans-serif, system-ui, sans-serif;
  }
  html, body {
    background: var(--tp-bg, #151515);
    color: var(--tp-ink, #fff);
  }
  html, body, #tp-float-root, .tp-float {
    --tp-bg: #151515;
    --tp-ink: #fff;
    --tp-muted: rgba(255, 255, 255, 0.45);
    --tp-line: rgba(255, 255, 255, 0.14);
    --tp-reader: #151515;
    --tp-done: #6ee7a8;
    --tp-cursor-bg: rgba(110, 231, 168, 0.28);
    --tp-scroll-thumb: rgba(255, 255, 255, 0.18);
  }
  html[data-tp-theme="light"],
  html[data-tp-theme="light"] body,
  html[data-tp-theme="light"] #tp-float-root,
  html[data-tp-theme="light"] .tp-float {
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

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORE);
    return value === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.2A7.4 7.4 0 0 1 9.8 4 7.5 7.5 0 1 0 20 14.2Z" />
    </svg>
  );
}

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

function ScriptBlockCard({ node, active, copyLabel, onCopy, onRemove, editing }) {
  const isUrl = node.type === 'url';
  const targetBits = [node.modelLabel, node.recommendedModel].filter((part) => String(part || '').trim());
  const preview = String(node.preview || node.body || '').trim();

  return (
    <div className={active ? 'tp-block is-active' : 'tp-block'}>
      <div className="tp-block__top">
        {isUrl ? null : (
          <span className="tp-block__model" title={node.modelLabel || 'Model'}>
            <ModelGlyph src={node.modelSrc} label={node.modelLabel} />
          </span>
        )}
        <div className="tp-block__meta">
          <span className="tp-block__kind">{isUrl ? 'URL' : 'Prompt'}</span>
          {isUrl ? (
            <>
              {String(node.title || '').trim() ? (
                <strong className="tp-block__title">{node.title}</strong>
              ) : null}
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
      {!isUrl && preview ? (
        <p className="tp-block__preview">{preview}</p>
      ) : null}
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
        return (
          <ScriptBlockCard
            key={node.id}
            node={node}
            active={activeBlockId === node.id}
            copyLabel={blockCopyLabel(copyFlash, node.id)}
            onCopy={() => onCopyBlock(node)}
            editing={false}
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
  theme,
  activeBlockId,
  copyFlash,
  canPlay,
  onToggleCollapse,
  onPlay,
  onPause,
  onCopyBlock,
}) {
  return (
    <div className={collapsed ? 'tp-float is-collapsed' : 'tp-float'} data-tp-theme={theme}>
      <div className="tp-float__head">
        <p className="tp-float__title">Teleprompter</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {playing ? (
            <button type="button" onClick={onPause}>Pause</button>
          ) : (
            <button type="button" onClick={onPlay} disabled={!canPlay}>Play</button>
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

function applyFloatTheme(hostWindow, theme) {
  if (!hostWindow?.document) return;
  const next = theme === 'light' ? 'light' : 'dark';
  hostWindow.document.documentElement.setAttribute('data-tp-theme', next);
  if (hostWindow.document.body) {
    hostWindow.document.body.setAttribute('data-tp-theme', next);
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

function mountFloatDocument(hostWindow, theme) {
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
  applyFloatTheme(hostWindow, theme);
  return mount;
}

function countFolderPrompts(folder) {
  return (folder?.prompts || []).reduce((total, file) => {
    const steps = (file.steps || []).filter((step) => (
      String(step.prompt || '').replace(/<[^>]+>/g, '').trim()
    ));
    return total + steps.length;
  }, 0);
}

function DeskBrowser({ folders, onInsertPrompt, onInsertUrl }) {
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState(null);
  const [branch, setBranch] = useState(null); /* 'prompts' | 'urls' | null */
  const [fileId, setFileId] = useState(null);

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
  const file = (folder?.prompts || []).find((item) => item.id === fileId) || null;
  const steps = (file?.steps || []).filter((step) => String(step.prompt || '').replace(/<[^>]+>/g, '').trim());
  const urlEntries = useMemo(
    () => (folder ? folderReferenceEntries(folder) : []),
    [folder],
  );
  const promptCount = folder ? countFolderPrompts(folder) : 0;
  const urlCount = urlEntries.length;

  function resetToFolders() {
    setFolderId(null);
    setBranch(null);
    setFileId(null);
  }

  function openFolder(id) {
    setFolderId(id);
    setBranch(null);
    setFileId(null);
  }

  function openBranch(next) {
    setBranch(next);
    setFileId(null);
  }

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
              className={!branch ? 'tp-browser__crumb is-current' : 'tp-browser__crumb'}
              onClick={() => openBranch(null)}
            >
              {folder.label || 'Folder'}
            </button>
          </>
        ) : null}
        {branch === 'prompts' ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <button
              type="button"
              className={!fileId ? 'tp-browser__crumb is-current' : 'tp-browser__crumb'}
              onClick={() => setFileId(null)}
            >
              Prompts
            </button>
          </>
        ) : null}
        {branch === 'urls' ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <span className="tp-browser__crumb is-current">URLs</span>
          </>
        ) : null}
        {file ? (
          <>
            <span className="tp-browser__sep" aria-hidden="true">/</span>
            <span className="tp-browser__crumb is-current">{file.name || 'File'}</span>
          </>
        ) : null}
      </div>

      <div className="tp-browser__list scroll-match-bg">
        {!folder ? (
          filteredFolders.length ? filteredFolders.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tp-browser__row"
              onClick={() => openFolder(item.id)}
            >
              <span>{item.label || 'Folder'}</span>
              <span className="tp-browser__count">{(item.prompts || []).length}</span>
            </button>
          )) : (
            <p className="tp-browser__empty">No folders on the desk.</p>
          )
        ) : !branch ? (
          <>
            <button
              type="button"
              className="tp-browser__row"
              onClick={() => openBranch('prompts')}
            >
              <span>Prompts</span>
              <span className="tp-browser__count">{promptCount}</span>
            </button>
            <button
              type="button"
              className="tp-browser__row"
              onClick={() => openBranch('urls')}
            >
              <span>URLs</span>
              <span className="tp-browser__count">{urlCount}</span>
            </button>
          </>
        ) : branch === 'urls' ? (
          urlEntries.length ? urlEntries.map((entry) => (
            <div key={`${entry.fileId}-${entry.id}`} className="tp-browser__item">
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
            <p className="tp-browser__empty">This folder has no URLs.</p>
          )
        ) : !file ? (
          (folder.prompts || []).length ? (folder.prompts || []).map((item) => {
            const n = (item.steps || []).filter((step) => (
              String(step.prompt || '').replace(/<[^>]+>/g, '').trim()
            )).length;
            return (
              <button
                key={item.id}
                type="button"
                className="tp-browser__row"
                onClick={() => setFileId(item.id)}
              >
                <span>{item.name || 'Untitled'}</span>
                <span className="tp-browser__count">{n}</span>
              </button>
            );
          }) : (
            <p className="tp-browser__empty">This folder has no files.</p>
          )
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
                  disabled={!plain}
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
      </div>
    </div>
  );
}

/**
 * Teleprompter page: script nodes (text + linked prompt/url blocks),
 * desk browser on the right, play coloring + Copy on blocks.
 */
export default function TeleprompterPage({ folders = [] }) {
  const [nodes, setNodes] = useState(() => [blankTextNode('')]);
  const [cps, setCps] = useState(DEFAULT_CPS);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [floating, setFloating] = useState(false);
  const [floatCollapsed, setFloatCollapsed] = useState(false);
  const [theme, setTheme] = useState(readStoredTheme);
  const [copyFlash, setCopyFlash] = useState({ id: '', kind: '' });
  const [pausedBlockId, setPausedBlockId] = useState('');
  const copyFlashTimerRef = useRef(0);

  const floatRef = useRef(null);
  const themeRef = useRef(theme);
  const playingRef = useRef(false);
  const cursorRef = useRef(0);
  const textRef = useRef('');
  const nodesRef = useRef(nodes);
  const cpsRef = useRef(DEFAULT_CPS);
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
  const showReader = playing || cursor > 0;
  const canPlay = Boolean(playText.trim()) || nodes.some((node) => node.type !== 'text');

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
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    cpsRef.current = cps;
  }, [cps]);

  useEffect(() => {
    themeRef.current = theme;
    try {
      localStorage.setItem(THEME_STORE, theme);
    } catch {
      /* Private mode */
    }
  }, [theme]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  function bumpCps(delta) {
    setCps((value) => Math.min(CPS_MAX, Math.max(CPS_MIN, value + delta)));
  }

  function stopLoop() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
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

  function tick(now) {
    if (!playingRef.current) return;
    const rate = Math.max(1, cpsRef.current);
    if (!lastTickRef.current) lastTickRef.current = now;
    const delta = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;
    carryRef.current += delta * rate;
    const chars = Array.from(String(textRef.current || ''));
    const end = chars.length;
    let from = cursorRef.current;
    let moved = false;
    while (from < end) {
      const cost = charPaceWeight(chars[from]);
      if (carryRef.current < cost) break;
      const rawNext = from + 1;
      const gate = nextBlockPause(nodesRef.current, from, rawNext, clearedBlocksRef.current);
      if (gate) {
        carryRef.current = 0;
        pauseAtBlock(gate.blockId, gate.at);
        return;
      }
      carryRef.current -= cost;
      from = rawNext;
      moved = true;
    }
    if (moved) {
      cursorRef.current = from;
      setCursor(from);
      if (from >= end) {
        playingRef.current = false;
        setPlaying(false);
        stopLoop();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startPlay() {
    const list = nodesRef.current || [];
    const hasBlocks = list.some((node) => node.type !== 'text');
    if (!textRef.current.trim() && !hasBlocks) return;

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

  function updateTextNode(id, body) {
    setNodes((prev) => prev.map((node) => (
      node.id === id && node.type === 'text' ? { ...node, body } : node
    )));
    resetGates();
    setCursor(0);
  }

  function removeNode(id) {
    setNodes((prev) => {
      const next = prev.filter((node) => node.id !== id);
      return next.length ? next : [blankTextNode('')];
    });
    resetGates();
    setCursor(0);
  }

  function insertPromptBlock(payload) {
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
      const last = prev[prev.length - 1];
      if (last?.type === 'text' && !String(last.body || '').trim()) {
        return [...prev.slice(0, -1), block, blankTextNode('')];
      }
      return [...prev, block, blankTextNode('')];
    });
    resetGates();
    setCursor(0);
  }

  function insertUrlBlock(payload) {
    setNodes((prev) => {
      const href = String(payload.href || '').trim();
      const block = {
        id: makeTpId(),
        type: 'url',
        href,
        title: payload.title || href,
        body: String(payload.body || href),
      };
      const last = prev[prev.length - 1];
      if (last?.type === 'text' && !String(last.body || '').trim()) {
        return [...prev.slice(0, -1), block, blankTextNode('')];
      }
      return [...prev, block, blankTextNode('')];
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
    const mount = mountFloatDocument(hostWindow, themeRef.current);
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

  useEffect(() => {
    const slot = floatRef.current;
    if (!slot?.root || !floating) return;
    if (slot.window?.closed) {
      floatRef.current = null;
      setFloating(false);
      return;
    }
    applyFloatTheme(slot.window, theme);
    slot.root.render(
      <FloatSurface
        nodes={nodes}
        cursor={cursor}
        cps={cps}
        durationLabel={durationLabel}
        elapsedLabel={elapsedLabel}
        playing={playing}
        collapsed={floatCollapsed}
        theme={theme}
        activeBlockId={activeBlockId}
        copyFlash={copyFlash}
        canPlay={canPlay}
        onToggleCollapse={toggleFloatCollapsed}
        onPlay={startPlay}
        onPause={pausePlay}
        onCopyBlock={(node) => { void copyBlock(node, slot.window); }}
      />,
    );
  }, [floating, nodes, cursor, cps, durationLabel, elapsedLabel, playing, floatCollapsed, theme, activeBlockId, copyFlash, canPlay, folders]);

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
    <div className="tp-page" data-tp-theme={theme}>
      <div className="tp-shell">
        <div className="tp-left">
          <div className="tp-paste">
            <div className="tp-paste__top">
              <label className="tp-paste__label">
                Teleprompter script
              </label>
              <div className="tp-theme" role="group" aria-label="Color theme">
                <button
                  type="button"
                  className={theme === 'dark' ? 'tp-theme__btn is-active' : 'tp-theme__btn'}
                  aria-pressed={theme === 'dark'}
                  aria-label="Dark theme"
                  title="Dark"
                  onClick={() => setTheme('dark')}
                >
                  <IconMoon />
                </button>
                <button
                  type="button"
                  className={theme === 'light' ? 'tp-theme__btn is-active' : 'tp-theme__btn'}
                  aria-pressed={theme === 'light'}
                  aria-label="Light theme"
                  title="Light"
                  onClick={() => setTheme('light')}
                >
                  <IconSun />
                </button>
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
              <div className="tp-script scroll-match-bg">
                {nodes.map((node) => (
                  node.type === 'text' ? (
                    <textarea
                      key={node.id}
                      className="tp-script__field"
                      placeholder="Write or paste your script…"
                      value={node.body}
                      rows={4}
                      onChange={(event) => updateTextNode(node.id, event.target.value)}
                    />
                  ) : (
                    <ScriptBlockCard
                      key={node.id}
                      node={node}
                      active={false}
                      copyLabel={blockCopyLabel(copyFlash, node.id)}
                      onCopy={() => { void copyBlock(node, window); }}
                      onRemove={() => removeNode(node.id)}
                      editing
                    />
                  )
                ))}
              </div>
            )}
            <p className="tp-paste__hint">
              Insert prompts or URLs from the library · Play pauses on each block for Copy · resume with Play
            </p>
          </div>

          <div className="tp-toolkit" aria-label="Toolkit">
            <div className="tp-toolkit__meta">
              <div className="tp-counter" aria-label="Speed">
                <span className="tp-counter__label">SPEED</span>
                <button
                  type="button"
                  className="tp-counter__btn"
                  aria-label="Decrease speed"
                  disabled={cps <= CPS_MIN}
                  onClick={() => bumpCps(-1)}
                >
                  −
                </button>
                <span className="tp-counter__value" aria-live="polite">{cps}</span>
                <button
                  type="button"
                  className="tp-counter__btn"
                  aria-label="Increase speed"
                  disabled={cps >= CPS_MAX}
                  onClick={() => bumpCps(1)}
                >
                  +
                </button>
              </div>

              <div className="tp-tool--time" aria-live="polite">
                <span>Duration</span>
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
                  aria-label="Pause"
                  title="Pause"
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
            </div>

            <div className="tp-toolkit__actions">
              <button
                type="button"
                className="tp-icon-btn tp-icon-btn--reset"
                onClick={resetPlay}
                disabled={!playText && cursor === 0 && !nodes.some((node) => node.type !== 'text')}
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
                  aria-label="Edit"
                  title="Edit"
                >
                  <IconEdit />
                </button>
              ) : null}
              <button
                type="button"
                className="tp-icon-btn"
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

        <div className="tp-right" aria-label="Prompt library">
          <DeskBrowser
            folders={folders}
            onInsertPrompt={insertPromptBlock}
            onInsertUrl={insertUrlBlock}
          />
        </div>
      </div>
    </div>
  );
}
