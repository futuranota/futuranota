import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PROMPT_FORMATS } from '../../lib/codeBlockLanguages.js';
import { copyToClipboard } from '../../lib/copyToClipboard.js';
import GlassFolder from './GlassFolder.jsx';
import './prompt-desk.css';

const ARTS = ['aurora', 'ember', 'dusk', 'glacier', 'verdant'];

const PROMPT_MODELS = [
  { id: 'openai', label: 'ChatGPT', src: '/uploads/source/OpenAiLogo.svg' },
  { id: 'claude', label: 'Claude', src: '/uploads/claude-color.svg' },
  { id: 'grok', label: 'Grok', src: '/uploads/grok.svg' },
  { id: 'gemini', label: 'Gemini', src: '/uploads/gemini-color.svg' },
];

function uid() {
  return crypto.randomUUID();
}

function defaultStepTitle(index) {
  return `Prompt ${String(index + 1).padStart(2, '0')}`;
}

function blankStep(index = 0) {
  return {
    id: uid(),
    title: defaultStepTitle(index),
    prompt: '',
    image: '',
    format: 'text',
    promptSaved: false,
  };
}

function stepTitleOf(step, index) {
  return typeof step.title === 'string' ? step.title : defaultStepTitle(index);
}

function blankPrompt() {
  return {
    id: uid(),
    name: 'Untitled',
    meta: 'Prompt',
    modelId: '',
    stepIndex: 0,
    steps: [blankStep()],
  };
}

function blankFolder(index) {
  return {
    id: uid(),
    label: index === 0 ? 'Prompts' : `Collection ${index + 1}`,
    art: ARTS[index % ARTS.length],
    tone: index % 2 === 1 ? 'dark' : 'light',
    seed: index * 7 + 3,
    prompts: [],
  };
}

function coverImage(prompt) {
  return (prompt.steps || []).find((step) => step.image)?.image || '';
}

function stepAt(prompt) {
  const steps = prompt.steps?.length ? prompt.steps : [blankStep()];
  const index = Math.min(Math.max(prompt.stepIndex || 0, 0), steps.length - 1);
  return { steps, index, step: steps[index] };
}

function sheetsOf(prompts) {
  return prompts.map((prompt) => ({
    name: prompt.name || 'Untitled',
    meta: prompt.meta || 'Prompt',
    image: coverImage(prompt) || undefined,
    promptId: prompt.id,
  }));
}

function readImageFile(file, onLoad) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result || ''));
  reader.readAsDataURL(file);
}

function FolderCard({ folder, appearDelay, onAdd, onOpenPrompt, onRename, onDeleteFolder, onDeletePrompt }) {
  const sheets = useMemo(() => sheetsOf(folder.prompts), [folder.prompts]);
  return (
    <div className="prompt-desk__folder">
      <button
        type="button"
        className="prompt-desk__delete"
        onClick={() => onDeleteFolder(folder.id)}
      >
        Eliminar
      </button>
      <GlassFolder
        label={folder.label}
        art={folder.art}
        tone={folder.tone}
        seed={folder.seed}
        files={sheets}
        action="add"
        width={300}
        appearDelay={appearDelay}
        onLabelChange={(label) => onRename(folder.id, label)}
        onAdd={() => {
          const prompt = blankPrompt();
          onAdd(folder.id, prompt);
          return { name: prompt.name, meta: prompt.meta, promptId: prompt.id };
        }}
        onFileSelect={(file) => {
          if (file?.promptId) onOpenPrompt(folder.id, file.promptId);
        }}
        onFileDelete={(file) => {
          if (file?.promptId) onDeletePrompt(folder.id, file.promptId);
        }}
      />
    </div>
  );
}

export default function PromptDesk() {
  const [folders, setFolders] = useState(() => [blankFolder(0)]);
  const [active, setActive] = useState(null);
  const [compact, setCompact] = useState(false);
  const [floating, setFloating] = useState(false);
  const floatRef = useRef(null);

  const activePrompt = useMemo(() => {
    if (!active) return null;
    const folder = folders.find((item) => item.id === active.folderId);
    const prompt = folder?.prompts.find((item) => item.id === active.promptId);
    if (!folder || !prompt) return null;
    return { folder, prompt };
  }, [folders, active]);

  function addCollection() {
    setFolders((prev) => [...prev, blankFolder(prev.length)]);
  }

  function addPrompt(folderId, prompt) {
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: [...folder.prompts, prompt] }
        : folder
    )));
  }

  function patchPrompt(patch) {
    if (!active) return;
    setFolders((prev) => prev.map((folder) => {
      if (folder.id !== active.folderId) return folder;
      return {
        ...folder,
        prompts: folder.prompts.map((prompt) => (
          prompt.id === active.promptId ? { ...prompt, ...patch } : prompt
        )),
      };
    }));
  }

  function closePanel() {
    setActive(null);
    setCompact(false);
    closeFloat();
  }

  function closeFloat() {
    const slot = floatRef.current;
    if (!slot) return;
    floatRef.current = null;
    slot.root.unmount();
    slot.window.close();
    setFloating(false);
  }

  async function openFloat() {
    const api = window.documentPictureInPicture;
    if (!api?.requestWindow) {
      setCompact(true);
      return;
    }
    const openSlot = floatRef.current;
    if (openSlot?.window && !openSlot.window.closed) {
      openSlot.window.focus();
      setFloating(true);
      setCompact(false);
      return;
    }
    try {
      const pipWindow = await api.requestWindow({ width: 400, height: 360 });
      const doc = pipWindow.document;
      doc.title = '';
      const style = doc.createElement('style');
      style.textContent = FLOAT_CSS;
      doc.head.appendChild(style);
      const mount = doc.createElement('div');
      mount.id = 'prompt-float-root';
      doc.body.replaceChildren(mount);
      const root = createRoot(mount);
      const onHide = () => {
        pipWindow.removeEventListener('pagehide', onHide);
        if (floatRef.current?.window !== pipWindow) return;
        floatRef.current = null;
        root.unmount();
        setFloating(false);
      };
      pipWindow.addEventListener('pagehide', onHide);
      floatRef.current = { window: pipWindow, root };
      setFloating(true);
      setCompact(false);
    } catch {
      setCompact(true);
    }
  }

  function renameFolder(folderId, label) {
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId ? { ...folder, label } : folder
    )));
  }

  function deleteFolder(folderId) {
    setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    setActive((current) => (current?.folderId === folderId ? null : current));
    setCompact(false);
    if (active?.folderId === folderId) closeFloat();
  }

  function deletePrompt(folderId, promptId) {
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: folder.prompts.filter((prompt) => prompt.id !== promptId) }
        : folder
    )));
    setActive((current) => (current?.promptId === promptId ? null : current));
    setCompact(false);
    if (active?.promptId === promptId) closeFloat();
  }

  useEffect(() => {
    const slot = floatRef.current;
    if (!slot?.root || !floating) return;
    if (!activePrompt) {
      closeFloat();
      return;
    }
    slot.root.render(
      <FloatCard
        prompt={activePrompt.prompt}
        view={slot.window}
        onPatch={patchPrompt}
      />
    );
  });

  return (
    <div className="prompt-desk">
      <div className="prompt-desk__dots" aria-hidden="true" />
      <header className="prompt-desk__bar">
        <p className="prompt-desk__mark">Futura Nota</p>
        <button type="button" className="prompt-desk__new" onClick={addCollection}>
          Nueva colección
        </button>
      </header>
      <div className="prompt-desk__grid">
        {folders.map((folder, index) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            appearDelay={index * 120}
            onAdd={addPrompt}
            onRename={renameFolder}
            onDeleteFolder={deleteFolder}
            onDeletePrompt={deletePrompt}
            onOpenPrompt={(folderId, promptId) => {
              setActive({ folderId, promptId });
              setCompact(false);
            }}
          />
        ))}
      </div>

      {activePrompt && !floating ? (
        <InstructionPanel
          prompt={activePrompt.prompt}
          compact={compact}
          onPatch={patchPrompt}
          onCompact={() => { void openFloat(); }}
          onExpand={() => setCompact(false)}
          onClose={closePanel}
        />
      ) : null}
    </div>
  );
}

function InstructionPanel({ prompt, compact, onPatch, onCompact, onExpand, onClose }) {
  const { steps, index, step } = stepAt(prompt);
  const copiedText = step.prompt.trim();
  const canCopy = Boolean(step.promptSaved && copiedText);
  const snippet = (copiedText || 'Prompt vacío').slice(0, 90);
  const [copied, setCopied] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [dragImage, setDragImage] = useState(false);
  const chipImage = step.image || coverImage(prompt);

  function patchStep(patch) {
    onPatch({
      steps: steps.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    });
  }

  function takeImage(file) {
    readImageFile(file, (image) => {
      patchStep({ image, promptSaved: false });
      setShowImage(true);
    });
  }

  function saveStep() {
    patchStep({ promptSaved: true });
  }

  function goBack() {
    if (index <= 0) return;
    onPatch({ stepIndex: index - 1 });
  }

  function goForward() {
    if (index < steps.length - 1) {
      onPatch({ stepIndex: index + 1 });
      return;
    }
    onPatch({
      steps: [...steps, blankStep(steps.length)],
      stepIndex: steps.length,
    });
  }

  function deleteIndex() {
    if (steps.length <= 1) {
      onPatch({ steps: [blankStep(0)], stepIndex: 0 });
      return;
    }
    const nextSteps = steps.filter((_, itemIndex) => itemIndex !== index);
    onPatch({
      steps: nextSteps,
      stepIndex: Math.min(index, nextSteps.length - 1),
    });
  }

  async function copyPrompt() {
    if (!canCopy) return;
    const ok = await copyToClipboard(copiedText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (compact) {
    return (
      <button type="button" className="prompt-chip" onClick={onExpand}>
        {chipImage ? (
          <img className="prompt-chip__img" src={chipImage} alt="" />
        ) : (
          <span className="prompt-chip__img prompt-chip__img--empty" aria-hidden="true" />
        )}
        <span className="prompt-chip__copy">
          <span className="prompt-chip__name">{prompt.name || 'Untitled'}</span>
          <span className="prompt-chip__snippet">{snippet}</span>
        </span>
      </button>
    );
  }

  return (
    <section
      className="prompt-panel"
      aria-label="Prompt"
      onPaste={(event) => {
        const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith('image/'));
        if (item) takeImage(item.getAsFile());
      }}
    >
      <button type="button" className="prompt-panel__close" onClick={onClose} aria-label="Cerrar">
        <img src="/uploads/closed-tab.svg" alt="" />
      </button>
      <div className={showImage ? 'prompt-panel__split' : 'prompt-panel__split prompt-panel__split--prompt'}>
        {showImage ? (
          <div className="prompt-panel__media-tools">
            <button type="button" onClick={() => setShowImage(false)}>Omitir</button>
          </div>
        ) : null}
        <div className="prompt-panel__editor-tools">
          <input
            className="prompt-panel__name"
            value={prompt.name}
            placeholder="Nombre"
            aria-label="Nombre"
            onChange={(event) => onPatch({ name: event.target.value })}
          />
          <div className="prompt-models" role="listbox" aria-label="Modelo">
            {PROMPT_MODELS.map((model) => {
              const selected = prompt.modelId === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'prompt-models__item is-selected' : 'prompt-models__item'}
                  onClick={() => onPatch({ modelId: selected ? '' : model.id })}
                >
                  <img src={model.src} alt="" />
                  <span>{model.label}</span>
                </button>
              );
            })}
            {showImage ? null : (
              <button type="button" className="prompt-models__item" onClick={() => setShowImage(true)}>
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span>Agregar imagen</span>
              </button>
            )}
            <button type="button" className="prompt-models__item" onClick={onCompact}>
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M9 4H5v4M4 4l6 6M15 20h4v-4M20 20l-6-6" />
                </svg>
              </span>
              <span>Comprimir</span>
            </button>
          </div>
          <div className="prompt-panel__tools">
            <label className="prompt-format">
              <span className="sr-only">Formato</span>
              <select
                value={step.format || 'text'}
                aria-label="Formato"
                onChange={(event) => patchStep({ format: event.target.value, promptSaved: false })}
              >
                {PROMPT_FORMATS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.id === 'text' ? 'Text' : entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {showImage ? (
            <label
              className={dragImage ? 'prompt-panel__image is-dragging' : 'prompt-panel__image'}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragImage(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragImage(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setDragImage(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragImage(false);
                takeImage(event.dataTransfer.files?.[0]);
              }}
            >
              {step.image ? (
                <img src={step.image} alt="" />
              ) : (
                <span className="prompt-panel__drop">
                  <span className="prompt-panel__drop-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 16V5" />
                      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
                      <path d="M5 19h14" />
                    </svg>
                  </span>
                  <span className="prompt-panel__drop-title">Elige una imagen o suéltala aquí</span>
                  <span className="prompt-panel__drop-hint">JPG, PNG y WEBP</span>
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                onChange={(event) => takeImage(event.target.files?.[0])}
              />
            </label>
        ) : null}
          <div className="prompt-sheet">
            <input
              className="prompt-sheet__title"
              value={stepTitleOf(step, index)}
              placeholder="Título"
              aria-label="Título de esta página"
              onChange={(event) => patchStep({ title: event.target.value })}
            />
            <div className="prompt-drawer">
            <textarea
              className={
                step.format && step.format !== 'text'
                  ? 'prompt-panel__body prompt-panel__body--code'
                  : 'prompt-panel__body'
              }
              value={step.prompt}
              placeholder="Descripción"
              aria-label="Descripción"
              spellCheck={!step.format || step.format === 'text'}
              onChange={(event) => patchStep({ prompt: event.target.value, promptSaved: false })}
            />
            {canCopy ? (
              <button
                type="button"
                className="prompt-copy"
                onClick={() => { void copyPrompt(); }}
                aria-label={copied ? 'Copiado' : 'Copiar'}
                title={copied ? 'Copiado' : 'Copiar'}
              >
                {copied ? '✓' : '⧉'}
              </button>
            ) : null}
            </div>
          </div>
          <div className="prompt-panel__foot">
            {step.prompt.trim() ? (
              <div className="prompt-panel__step-actions">
                <button type="button" onClick={saveStep}>Guardar</button>
                <button type="button" onClick={deleteIndex}>Eliminar</button>
              </div>
            ) : null}
          <div className="prompt-steps">
            <button
              type="button"
              className="prompt-steps__arrow"
              aria-label="Paso anterior"
              disabled={index <= 0}
              onClick={goBack}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 6.5 9 12l5.5 5.5" />
              </svg>
            </button>
            <span className="prompt-steps__count">{index + 1} / {steps.length}</span>
            <button
              type="button"
              className="prompt-steps__arrow"
              aria-label="Paso siguiente"
              onClick={goForward}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.5 6.5 15 12l-5.5 5.5" />
              </svg>
            </button>
          </div>
          </div>
      </div>
    </section>
  );
}

async function copyInView(text, view) {
  if (!text) return false;
  try {
    await view.navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const doc = view.document;
      const textarea = doc.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      doc.body.appendChild(textarea);
      textarea.select();
      const ok = doc.execCommand('copy');
      doc.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

function FloatCard({ prompt, view, onPatch }) {
  const { steps, index, step } = stepAt(prompt);
  const text = step.prompt.trim();
  const canCopy = Boolean(step.promptSaved && text);
  const [copied, setCopied] = useState(false);

  function patchFloatStep(patch) {
    onPatch({
      steps: steps.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch, promptSaved: true } : item
      )),
    });
  }

  function goBack() {
    if (index <= 0) return;
    onPatch({ stepIndex: index - 1 });
  }

  function goForward() {
    if (index < steps.length - 1) {
      onPatch({ stepIndex: index + 1 });
      return;
    }
    onPatch({
      steps: [...steps, blankStep(steps.length)],
      stepIndex: steps.length,
    });
  }

  function patchStepTitle(title) {
    onPatch({
      steps: steps.map((item, itemIndex) => (
        itemIndex === index ? { ...item, title } : item
      )),
    });
  }

  async function copyPrompt() {
    if (!canCopy) return;
    const ok = await copyInView(text, view);
    if (!ok) return;
    setCopied(true);
    view.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="prompt-float" aria-label="Prompt flotante">
      <div className="prompt-float__sheet">
        <input
          className="prompt-float__step"
          value={stepTitleOf(step, index)}
          placeholder="Título"
          aria-label="Título de esta página"
          onChange={(event) => patchStepTitle(event.target.value)}
        />
        <div className="prompt-drawer">
          <textarea
            className="prompt-float__text"
            value={step.prompt}
            placeholder="Descripción"
            aria-label="Descripción"
            onChange={(event) => patchFloatStep({ prompt: event.target.value })}
          />
          {canCopy ? (
            <button
              type="button"
              className="prompt-copy"
              onClick={() => { void copyPrompt(); }}
              aria-label={copied ? 'Copiado' : 'Copiar'}
              title={copied ? 'Copiado' : 'Copiar'}
            >
              {copied ? '✓' : '⧉'}
            </button>
          ) : null}
        </div>
      </div>
      <div className="prompt-steps">
        <button
          type="button"
          className="prompt-steps__arrow"
          aria-label="Paso anterior"
          disabled={index <= 0}
          onClick={goBack}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6.5 9 12l5.5 5.5" />
          </svg>
        </button>
        <span className="prompt-steps__count">{index + 1} / {steps.length}</span>
        <button
          type="button"
          className="prompt-steps__arrow"
          aria-label="Paso siguiente"
          onClick={goForward}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 6.5 15 12l-5.5 5.5" />
          </svg>
        </button>
      </div>
    </section>
  );
}

const FLOAT_CSS = `
  html, body, #prompt-float-root {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }
  body {
    --surface-base: #151515;
    --text-primary: #fff;
    background: var(--surface-base);
    color: #fff;
    color-scheme: dark;
  }
  .prompt-float {
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    overflow: hidden;
    background: var(--surface-base);
    color: var(--text-primary);
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .prompt-float__sheet {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    background: #101010;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  }
  .prompt-float__sheet:focus-within {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
  }
  .prompt-float__step {
    flex: none;
    width: 100%;
    margin: 0;
    border: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 18px;
    font-weight: 560;
    letter-spacing: -0.02em;
    padding: 14px 16px 12px;
    outline: none;
  }
  .prompt-float__step::placeholder { color: rgba(255, 255, 255, 0.38); }
  .prompt-drawer {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .prompt-float__text {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    margin: 0;
    resize: none;
    overflow: auto;
    border: 0;
    border-radius: 0;
    padding: 16px 48px 16px 16px;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 14px;
    line-height: 1.45;
    outline: none;
  }
  .prompt-float__text::placeholder { color: rgba(255, 255, 255, 0.38); }
  .prompt-float__text::-webkit-scrollbar { width: 8px; }
  .prompt-float__text::-webkit-scrollbar-thumb {
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.28);
  }
  .prompt-copy {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 8px;
    background: #333333;
    color: rgba(255, 255, 255, 0.95);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .prompt-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  .prompt-steps__arrow {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.32);
    border-radius: 50%;
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 18px rgba(0, 0, 0, 0.28);
    cursor: pointer;
  }
  .prompt-steps__arrow svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .prompt-steps__arrow:disabled { opacity: 0.35; cursor: default; }
  .prompt-steps__count {
    min-width: 48px;
    text-align: center;
    font-size: 13px;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.78);
  }
`;
