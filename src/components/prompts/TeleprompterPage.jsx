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
    background: #151515;
    color: #fff;
    font: 16px/1.55 ui-sans-serif, system-ui, sans-serif;
  }
  .tp-float {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    gap: 10px;
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
    opacity: 0.7;
  }
  .tp-float__head button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid rgba(255,255,255,0.14);
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
    background: #1c1c1c;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 18px;
    line-height: 1.6;
  }
  .tp-float.is-collapsed .tp-float__reader,
  .tp-float.is-collapsed .tp-float__meta {
    display: none;
  }
  .tp-char { color: rgba(255,255,255,0.35); }
  .tp-char.is-done { color: #6ee7a8; }
  .tp-char.is-cursor {
    color: #fff;
    background: rgba(110, 231, 168, 0.28);
    border-radius: 2px;
  }
  .tp-float__meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    opacity: 0.65;
    font-variant-numeric: tabular-nums;
  }
`;

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
  onToggleCollapse,
  onPlay,
  onPause,
}) {
  return (
    <div className={collapsed ? 'tp-float is-collapsed' : 'tp-float'}>
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
        <span>{cps} chars/s</span>
        <span>{elapsedLabel} / {durationLabel}</span>
      </div>
    </div>
  );
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

  const floatRef = useRef(null);
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
    slot.root.unmount();
    slot.window.close();
    setFloating(false);
    setFloatCollapsed(false);
  }

  async function openFloat() {
    const api = window.documentPictureInPicture;
    if (!api?.requestWindow) {
      window.alert('Tu Chrome no soporta Document Picture-in-Picture. Actualizá el navegador.');
      return;
    }
    const openSlot = floatRef.current;
    if (openSlot?.window && !openSlot.window.closed) {
      openSlot.window.focus();
      setFloating(true);
      return;
    }
    try {
      const pipWindow = await api.requestWindow({
        width: FLOAT_SIZE.width,
        height: FLOAT_SIZE.height,
      });
      const doc = pipWindow.document;
      doc.title = 'Teleprompter';
      const style = doc.createElement('style');
      style.id = 'tp-float-css';
      style.textContent = FLOAT_CSS;
      doc.head.appendChild(style);
      const mount = doc.createElement('div');
      mount.id = 'tp-float-root';
      doc.body.replaceChildren(mount);
      const root = createRoot(mount);
      const onHide = () => {
        pipWindow.removeEventListener('pagehide', onHide);
        if (floatRef.current?.window !== pipWindow) return;
        floatRef.current = null;
        root.unmount();
        setFloating(false);
        setFloatCollapsed(false);
      };
      pipWindow.addEventListener('pagehide', onHide);
      floatRef.current = { window: pipWindow, root };
      setFloating(true);
    } catch {
      window.alert('No se pudo abrir el float. Permití Picture-in-Picture e intentá de nuevo.');
    }
  }

  useEffect(() => {
    const slot = floatRef.current;
    if (!slot?.root || !floating) return;
    slot.root.render(
      <FloatSurface
        text={text}
        cursor={cursor}
        cps={cps}
        durationLabel={durationLabel}
        elapsedLabel={elapsedLabel}
        playing={playing}
        collapsed={floatCollapsed}
        onToggleCollapse={() => setFloatCollapsed((value) => !value)}
        onPlay={startPlay}
        onPause={pausePlay}
      />,
    );
  }, [floating, text, cursor, cps, durationLabel, elapsedLabel, playing, floatCollapsed]);

  useEffect(() => {
    const slot = floatRef.current;
    if (!slot?.window || slot.window.closed) return;
    const height = floatCollapsed ? 56 : FLOAT_SIZE.height;
    const width = floatCollapsed ? 280 : FLOAT_SIZE.width;
    try {
      slot.window.resizeTo(width, height);
    } catch {
      /* Some browsers block resizeTo on PiP. */
    }
  }, [floatCollapsed, floating]);

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
    <div className="tp-page">
      <div className="tp-shell">
        <div className="tp-left">
          <div className="tp-paste">
            <label className="tp-paste__label" htmlFor="tp-prompt">
              Pega tu prompt
            </label>
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
              Al Play, el timer calcula la duración · cada carácter se colorea a {cps} chars/s
            </p>
          </div>

          <div className="tp-toolkit" aria-label="Toolkit">
            <label className="tp-tool" htmlFor="tp-cps">
              <span>Velocidad</span>
              <input
                id="tp-cps"
                type="range"
                min={5}
                max={40}
                value={cps}
                onChange={(event) => setCps(Number(event.target.value) || DEFAULT_CPS)}
              />
              <output htmlFor="tp-cps">{cps} chars/s</output>
            </label>

            <div className="tp-tool tp-tool--time" aria-live="polite">
              <span>Duración</span>
              <strong>
                {elapsedLabel} / {durationLabel}
              </strong>
            </div>

            <div className="tp-tool-actions">
              {playing ? (
                <button type="button" className="tp-btn" onClick={pausePlay}>
                  Pause
                </button>
              ) : (
                <button type="button" className="tp-btn" onClick={startPlay} disabled={!text.trim()}>
                  Play
                </button>
              )}
              <button type="button" className="tp-btn tp-btn--ghost" onClick={resetPlay} disabled={!text && cursor === 0}>
                Reset
              </button>
              {showReader && !playing ? (
                <button
                  type="button"
                  className="tp-btn tp-btn--ghost"
                  onClick={() => {
                    resetPlay();
                  }}
                >
                  Editar
                </button>
              ) : null}
              <button
                type="button"
                className="tp-btn tp-btn--ghost"
                onClick={() => {
                  if (floating) closeFloat();
                  else void openFloat();
                }}
                title="Comprimir / expandir en Chrome (cualquier página)"
              >
                {floating ? 'Cerrar float' : 'Float'}
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
