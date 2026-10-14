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

function blankStep() {
  return { id: uid(), prompt: '', image: '', format: 'text' };
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
      const pipWindow = await api.requestWindow({ width: 340, height: 480 });
      const doc = pipWindow.document;
      doc.title = 'Futura Nota';
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
    slot.window.document.title = activePrompt.prompt.name || 'Futura Nota';
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
          onDelete={() => deletePrompt(activePrompt.folder.id, activePrompt.prompt.id)}
        />
      ) : null}
    </div>
  );
}

function InstructionPanel({ prompt, compact, onPatch, onCompact, onExpand, onClose, onDelete }) {
  const { steps, index, step } = stepAt(prompt);
  const copiedText = step.prompt.trim();
  const snippet = (copiedText || 'Prompt vacío').slice(0, 90);
  const [copied, setCopied] = useState(false);
  const chipImage = step.image || coverImage(prompt);

  function patchStep(patch) {
    onPatch({
      steps: steps.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    });
  }

  function takeImage(file) {
    readImageFile(file, (image) => patchStep({ image }));
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
      steps: [...steps, blankStep()],
      stepIndex: steps.length,
    });
  }

  async function copyPrompt() {
    if (!copiedText) return;
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
      <header className="prompt-panel__bar">
        <input
          className="prompt-panel__name"
          value={prompt.name}
          placeholder="Nombre"
          aria-label="Nombre"
          onChange={(event) => onPatch({ name: event.target.value })}
        />
        <div className="prompt-panel__actions">
          <button type="button" onClick={onDelete}>Eliminar</button>
          <button type="button" onClick={onCompact}>Comprimir</button>
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </header>
      <div className="prompt-panel__split">
        <label
          className="prompt-panel__image"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            takeImage(event.dataTransfer.files?.[0]);
          }}
        >
          {step.image ? (
            <img src={step.image} alt="" />
          ) : (
            <span>Suelta o elige una imagen</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => takeImage(event.target.files?.[0])}
          />
        </label>
        <div className="prompt-panel__editor">
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
          </div>
          <div className="prompt-panel__tools">
            <label className="prompt-format">
              <span className="sr-only">Formato</span>
              <select
                value={step.format || 'text'}
                aria-label="Formato"
                onChange={(event) => patchStep({ format: event.target.value })}
              >
                {PROMPT_FORMATS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.id === 'text' ? 'Text' : entry.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { void copyPrompt(); }} disabled={!copiedText}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <textarea
            className={
              step.format && step.format !== 'text'
                ? 'prompt-panel__body prompt-panel__body--code'
                : 'prompt-panel__body'
            }
            value={step.prompt}
            placeholder="Pega el prompt"
            aria-label="Prompt"
            spellCheck={!step.format || step.format === 'text'}
            onChange={(event) => patchStep({ prompt: event.target.value })}
          />
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
  const image = step.image || coverImage(prompt);
  const [copied, setCopied] = useState(false);

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
      steps: [...steps, blankStep()],
      stepIndex: steps.length,
    });
  }

  async function copyPrompt() {
    if (!text) return;
    const ok = await copyInView(text, view);
    if (!ok) return;
    setCopied(true);
    view.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="prompt-float" aria-label="Prompt flotante">
      {image ? (
        <img className="prompt-float__img" src={image} alt="" />
      ) : (
        <span className="prompt-float__img prompt-float__img--empty">Sin imagen</span>
      )}
      <p className="prompt-float__name">{prompt.name || 'Untitled'}</p>
      <pre className="prompt-float__text">{text || 'Prompt vacío'}</pre>
      <button type="button" className="prompt-float__copy" onClick={() => { void copyPrompt(); }} disabled={!text}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
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
  html, body, #prompt-float-root { height: 100%; margin: 0; }
  body {
    --surface-base: #151515;
    --text-primary: #fff;
    background: var(--surface-base);
    color: var(--text-primary);
  }
  .prompt-float {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: var(--surface-base);
    color: var(--text-primary);
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .prompt-float__img {
    width: 100%;
    height: 140px;
    flex: none;
    object-fit: cover;
    border-radius: 12px;
    background: #101010;
  }
  .prompt-float__img--empty {
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.45);
    font-size: 13px;
  }
  .prompt-float__name {
    margin: 0;
    font-size: 18px;
    font-weight: 560;
    letter-spacing: -0.02em;
  }
  .prompt-float__text {
    flex: 1;
    min-height: 0;
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: 12px;
    padding: 12px;
    background: #101010;
    font: inherit;
    font-size: 13px;
    line-height: 1.45;
  }
  .prompt-float__copy {
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: inherit;
    border-radius: 999px;
    padding: 8px 14px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .prompt-float__copy:disabled { opacity: 0.35; cursor: default; }
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
