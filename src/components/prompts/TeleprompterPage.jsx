import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './teleprompter-page.css';

const DEFAULT_CPS = 14;
const FLOAT_SIZE = { width: 420, height: 480 };

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
  .tp-float.is-collapsed {
    padding: 8px 10px;
  }
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
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 18px;
    line-height: 1.6;
    scrollbar-width: thin;
    scrollbar-color: var(--tp-scroll-thumb) var(--tp-reader);
  }
  .tp-float__reader::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .tp-float__reader::-webkit-scrollbar-track {
    background: var(--tp-reader);
  }
  .tp-float__reader::-webkit-scrollbar-thumb {
    background: var(--tp-scroll-thumb);
    border-radius: 999px;
    border: 2px solid var(--tp-reader);
  }
  .tp-float__reader::-webkit-scrollbar-thumb:hover {
    background: var(--tp-muted);
  }
  .tp-float.is-collapsed .tp-float__reader,
  .tp-float.is-collapsed .tp-float__meta {
    display: none;
  }
  .tp-char { color: var(--tp-muted); }
  .tp-char.is-done { color: var(--tp-done); }
  .tp-char.is-cursor {
    color: var(--tp-ink);
    background: var(--tp-cursor-bg);
    border-radius: 2px;
  }
  .tp-float__meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--tp-muted);
    font-variant-numeric: tabular-nums;
  }
`;

const CPS_MIN = 5;
const CPS_MAX = 40;
const THEME_STORE = 'fn-teleprompter-theme';

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

function CharReader({ text, cursor, className }) {
  const chars = useMemo(() => Array.from(String(text || '')), [text]);
  const scrollerRef = useRef(null);
  const cursorRef = useRef(null);

  useLayoutEffect(() => {
    const node = cursorRef.current;
    const scroller = scrollerRef.current;
    if (!node || !scroller) return;
    const top = node.offsetTop - scroller.clientHeight * 0.35;
    scroller.scrollTop = Math.max(0, top);
  }, [cursor]);

  return (
    <div ref={scrollerRef} className={className} aria-live="off">
      {chars.map((ch, index) => {
        const done = index < cursor;
        const active = index === cursor;
        return (
          <span
            key={`${index}-${ch}`}
            ref={active ? cursorRef : null}
            className={done ? 'tp-char is-done' : active ? 'tp-char is-cursor' : 'tp-char'}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

function FloatSurface({
  text,
  cursor,
  cps,
  durationLabel,
  elapsedLabel,
  playing,
  collapsed,
  theme,
  onToggleCollapse,
  onPlay,
  onPause,
}) {
  return (
    <div
      className={collapsed ? 'tp-float is-collapsed' : 'tp-float'}
      data-tp-theme={theme}
    >
      <div className="tp-float__head">
        <p className="tp-float__title">Teleprompter</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {playing ? (
            <button type="button" onClick={onPause}>Pause</button>
          ) : (
            <button type="button" onClick={onPlay} disabled={!text}>Play</button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir' : 'Comprimir'}
          >
            {collapsed ? 'Expand' : 'Comprimir'}
          </button>
        </div>
      </div>
      <CharReader text={text} cursor={cursor} className="tp-float__reader" />
      <div className="tp-float__meta">
        <span>{cps}</span>
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
    /* Some hosts ignore resizeTo; CSS still shrinks the card. */
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

/**
 * Dedicated teleprompter page: paste prompt, toolkit (chars/s + timer),
 * character coloring on Play, Document PiP float (compress / expand on any page).
 * Right panel is a placeholder until product defines it.
 */
export default function TeleprompterPage() {
  const [text, setText] = useState('');
  const [cps, setCps] = useState(DEFAULT_CPS);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [floating, setFloating] = useState(false);
  const [floatCollapsed, setFloatCollapsed] = useState(false);
  const [theme, setTheme] = useState(readStoredTheme);

  const floatRef = useRef(null);
  const themeRef = useRef(theme);
  const playingRef = useRef(false);
  const cursorRef = useRef(0);
  const textRef = useRef('');
  const cpsRef = useRef(DEFAULT_CPS);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const carryRef = useRef(0);

  const totalChars = countChars(text);
  const durationSec = cps > 0 ? totalChars / cps : 0;
  const elapsedSec = cps > 0 ? cursor / cps : 0;
  const durationLabel = formatDuration(durationSec);
  const elapsedLabel = formatDuration(elapsedSec);
  const showReader = playing || cursor > 0;

  useEffect(() => {
    textRef.current = text;
  }, [text]);

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

  function bumpCps(delta) {
    setCps((value) => Math.min(CPS_MAX, Math.max(CPS_MIN, value + delta)));
  }

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  function stopLoop() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }

  function tick(now) {
    if (!playingRef.current) return;
    const rate = Math.max(1, cpsRef.current);
    if (!lastTickRef.current) lastTickRef.current = now;
    const delta = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;
    carryRef.current += delta * rate;
    const steps = Math.floor(carryRef.current);
    if (steps > 0) {
      carryRef.current -= steps;
      const next = Math.min(countChars(textRef.current), cursorRef.current + steps);
      cursorRef.current = next;
      setCursor(next);
      if (next >= countChars(textRef.current)) {
        playingRef.current = false;
        setPlaying(false);
        stopLoop();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startPlay() {
    if (!textRef.current) return;
    if (cursorRef.current >= countChars(textRef.current)) {
      cursorRef.current = 0;
      setCursor(0);
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
    setCursor(0);
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

    // No PiP API — open a real popup in the same user-gesture turn (no await above).
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
        text={text}
        cursor={cursor}
        cps={cps}
        durationLabel={durationLabel}
        elapsedLabel={elapsedLabel}
        playing={playing}
        collapsed={floatCollapsed}
        theme={theme}
        onToggleCollapse={toggleFloatCollapsed}
        onPlay={startPlay}
        onPause={pausePlay}
      />,
    );
  }, [floating, text, cursor, cps, durationLabel, elapsedLabel, playing, floatCollapsed, theme]);

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
              <label className="tp-paste__label" htmlFor="tp-prompt">
                Pega tu prompt
              </label>
              <div className="tp-theme" role="group" aria-label="Tema de color">
                <button
                  type="button"
                  className={theme === 'dark' ? 'tp-theme__btn is-active' : 'tp-theme__btn'}
                  aria-pressed={theme === 'dark'}
                  aria-label="Tema oscuro"
                  title="Oscuro"
                  onClick={() => setTheme('dark')}
                >
                  <IconMoon />
                </button>
                <button
                  type="button"
                  className={theme === 'light' ? 'tp-theme__btn is-active' : 'tp-theme__btn'}
                  aria-pressed={theme === 'light'}
                  aria-label="Tema claro"
                  title="Claro"
                  onClick={() => setTheme('light')}
                >
                  <IconSun />
                </button>
              </div>
            </div>
            {showReader ? (
              <CharReader text={text} cursor={cursor} className="tp-reader scroll-match-bg" />
            ) : (
              <textarea
                id="tp-prompt"
                className="tp-paste__field scroll-match-bg"
                placeholder="Pega aquí el texto del teleprompter…"
                value={text}
                rows={12}
                onChange={(event) => {
                  setText(event.target.value);
                  setCursor(0);
                }}
              />
            )}
            <p className="tp-paste__hint">
              Al Play, el timer calcula la duración · el texto se colorea al ritmo del counter
            </p>
          </div>

          <div className="tp-toolkit" aria-label="Toolkit">
            <div className="tp-toolkit__meta">
              <div className="tp-counter" aria-label="Velocidad">
                <button
                  type="button"
                  className="tp-counter__btn"
                  aria-label="Bajar velocidad"
                  disabled={cps <= CPS_MIN}
                  onClick={() => bumpCps(-1)}
                >
                  −
                </button>
                <span className="tp-counter__value" aria-live="polite">{cps}</span>
                <button
                  type="button"
                  className="tp-counter__btn"
                  aria-label="Subir velocidad"
                  disabled={cps >= CPS_MAX}
                  onClick={() => bumpCps(1)}
                >
                  +
                </button>
              </div>

              <div className="tp-tool--time" aria-live="polite">
                <span>Duración</span>
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
                  disabled={!text.trim()}
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
                disabled={!text && cursor === 0}
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
                  aria-label="Editar"
                  title="Editar"
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
                aria-label={floating ? 'Cerrar float' : 'Expandir en Chrome'}
                title={floating ? 'Cerrar float' : 'Expandir en Chrome'}
              >
                {floating ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>
          </div>
        </div>

        <div className="tp-right" aria-label="Panel derecho — pendiente">
          <div className="tp-right__placeholder">
            <p>Panel derecho</p>
            <p className="tp-right__muted">Contenido por definir</p>
          </div>
        </div>
      </div>
    </div>
  );
}
