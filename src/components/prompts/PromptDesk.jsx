import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { PROMPT_FORMATS } from '../../lib/codeBlockLanguages.js';
import { copyToClipboard } from '../../lib/copyToClipboard.js';
import {
  currentPromptUserId,
  loadPromptDesk,
  savePromptDesk,
  uploadPromptImage,
} from '../../lib/promptDeskSync.js';
import { normalizeEmbedSrcForPlayback, parseVideoEmbedInput } from '../../lib/videoEmbed.js';
import { resolvePrompt } from '../../lib/promptVariables.js';
import { useAuthStore } from '../../stores/authStore.js';
import GlassFolder, { MAX_VISIBLE } from './GlassFolder.jsx';
import { fetchPdfBytesFromUrl, renderPdfPageImages } from '../../lib/importPdfText.js';
import { apiClient } from '../../api/client.js';
import { API_ROUTES } from '../../api/routes.js';
import { PromptBody } from './PromptBody.jsx';
import EmbedHtml from './EmbedHtml.jsx';
import './prompt-desk.css';

const pdfFiles = new Map();

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
  return {
    id: uid(),
    title: '',
    modelIds: [],
    description: '',
    prompt: '',
    image: '',
    imagePath: '',
    video: null,
    pdf: null,
    format: 'text',
    promptSaved: false,
  };
}

function stepTitleOf(step) {
  return typeof step.title === 'string' ? step.title : '';
}

function hasSavedPrompt(prompt) {
  return (prompt?.steps || []).some((item) => item.promptSaved && String(item.prompt || '').trim());
}

const DESCRIPTION_LINES = 3;

function DescriptionField({ className, value, readOnly, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const view = node.ownerDocument.defaultView;
    node.style.height = 'auto';
    const style = view.getComputedStyle(node);
    const line = parseFloat(style.lineHeight) || 17;
    const padTop = parseFloat(style.paddingTop) || 0;
    const max = Math.ceil(line * DESCRIPTION_LINES + padTop + 2);
    const full = node.scrollHeight;
    node.style.maxHeight = `${max}px`;
    node.style.height = `${Math.min(full, max)}px`;
    node.style.overflowY = full > max + 1 ? 'auto' : 'hidden';
  }, [value, readOnly]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      placeholder="Brief description of the steps to follow"
      aria-label="Brief description"
      readOnly={readOnly}
      rows={2}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function DescriptionBlock({ className, value, readOnly, onChange }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={open ? 'prompt-desc' : 'prompt-desc prompt-desc--closed'}>
      <button
        type="button"
        className="prompt-desc__toggle"
        aria-expanded={open}
        aria-label={open ? 'Ocultar descripción' : 'Mostrar descripción'}
        title={open ? 'Ocultar descripción' : 'Mostrar descripción'}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9.5 12 15.5 18 9.5" />
        </svg>
      </button>
      {open ? (
        <DescriptionField
          className={className}
          value={value}
          readOnly={readOnly}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

function playbackSrc(video) {
  const src = normalizeEmbedSrcForPlayback(video?.embedSrc || '');
  if (!src) return '';
  try {
    const url = new URL(src);
    if (video?.provider === 'youtube') {
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('origin', window.location.origin);
    }
    return url.toString();
  } catch {
    return src;
  }
}

function blankPrompt() {
  return {
    id: uid(),
    name: 'Untitled',
    meta: 'Prompt',
    modelId: '',
    variables: [],
    stepIndex: 0,
    pdf: null,
    video: null,
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

function fileTitle(prompt) {
  return prompt.name || 'Untitled';
}

function promptsForSearch(prompts, query) {
  const q = query.trim().toLowerCase();
  if (!q) return prompts;
  const matches = [];
  const rest = [];
  for (const prompt of prompts) {
    if (fileTitle(prompt).toLowerCase().includes(q)) matches.push(prompt);
    else rest.push(prompt);
  }
  if (!matches.length) return prompts;
  const shown = matches.slice(0, MAX_VISIBLE);
  const overflow = matches.slice(MAX_VISIBLE);
  const room = MAX_VISIBLE - shown.length;
  const below = rest.slice(0, room);
  const hidden = rest.slice(room);
  return [...hidden, ...overflow, ...shown, ...below];
}

function titleHit(prompt, query) {
  return fileTitle(prompt).toLowerCase().includes(query);
}

function sheetsOf(prompts, query = '') {
  const q = query.trim().toLowerCase();
  return prompts.map((prompt) => ({
    name: fileTitle(prompt),
    meta: prompt.meta || 'Prompt',
    image: coverImage(prompt) || undefined,
    promptId: prompt.id,
    highlight: Boolean(q) && titleHit(prompt, q),
  }));
}

function readImageFile(file, onLoad) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result || ''));
  reader.readAsDataURL(file);
}

const DESK_VIEWS = [
  { id: 'home', label: 'Home', to: '/app' },
  { id: 'settings', label: 'Settings', to: '/app/settings' },
  { id: 'embed', label: 'Embed Html', to: '/app/embed' },
];

function viewFromPath(pathname) {
  if (pathname.startsWith('/app/settings')) return 'settings';
  if (pathname.startsWith('/app/embed')) return 'embed';
  return 'home';
}

function SideIcon({ name }) {
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.2l1.6 1.6M17.6 16.2l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.8l1.6-1.6M17.6 7.8l1.6-1.6" />
      </svg>
    );
  }
  if (name === 'embed') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4Z" />
    </svg>
  );
}

function DeskSidebar({ view }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(true);
  const email = user?.email || '';
  const initial = (email[0] || 'F').toUpperCase();

  useEffect(() => {
    function onKey(event) {
      if (event.key.toLowerCase() !== 'b') return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.warn('[prompt-desk] sign out failed', error?.message || error);
    } finally {
      setLoggingOut(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <aside className={open ? 'prompt-desk__side' : 'prompt-desk__side prompt-desk__side--collapsed'} aria-label="Dashboard">
      <div className="prompt-desk__side-top">
        <button
          type="button"
          className="prompt-desk__side-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16M4 12h10M4 19h16" />
          </svg>
        </button>
      </div>
      <nav className="prompt-desk__side-nav">
        {DESK_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'prompt-desk__side-link is-current' : 'prompt-desk__side-link'}
            aria-current={view === item.id ? 'page' : undefined}
            title={item.label}
            onClick={() => navigate(item.to)}
          >
            <SideIcon name={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="prompt-desk__account">
        <span className="prompt-desk__avatar" aria-hidden="true">{initial}</span>
        <span className="prompt-desk__account-copy">
          {email ? <span className="prompt-desk__email">{email}</span> : null}
          <button
            type="button"
            className="prompt-desk__signout"
            onClick={() => { void handleSignOut(); }}
            disabled={loggingOut}
          >
            {loggingOut ? t('common.signingOut') : t('common.signOut')}
          </button>
        </span>
      </div>
    </aside>
  );
}

function DeskPlaceholder({ title }) {
  return (
    <div className="prompt-desk__page">
      <header className="prompt-desk__bar">
        <h1 className="prompt-desk__mark">{title}</h1>
      </header>
    </div>
  );
}

function FolderCard({ folder, appearDelay, searchOpen, highlightQuery, onAdd, onOpenPrompt, onRename, onDeleteFolder, onDeletePrompt }) {
  const [opened, setOpened] = useState(false);
  const sheets = useMemo(
    () => sheetsOf(folder.prompts, searchOpen ? highlightQuery : ''),
    [folder.prompts, searchOpen, highlightQuery],
  );
  return (
    <div className={searchOpen ? 'prompt-desk__folder prompt-desk__folder--hit' : 'prompt-desk__folder'}>
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
        open={searchOpen || opened}
        onOpenChange={(next) => {
          if (searchOpen) return;
          setOpened(next);
        }}
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

function saveMode(patch, beforePrompt) {
  if (!patch) return 'debounce';
  if ('stepIndex' in patch || 'modelId' in patch || 'pdf' in patch || 'video' in patch) return 'now';
  if (patch.steps && beforePrompt) {
    const prevIds = (beforePrompt.steps || []).map((item) => item.id).join();
    const nextIds = patch.steps.map((item) => item.id).join();
    if (prevIds !== nextIds) return 'now';
    const structural = patch.steps.some((step) => {
      const prev = (beforePrompt.steps || []).find((item) => item.id === step.id);
      if (!prev) return true;
      return prev.image !== step.image
        || prev.imagePath !== step.imagePath
        || prev.format !== step.format
        || prev.promptSaved !== step.promptSaved
        || JSON.stringify(prev.video) !== JSON.stringify(step.video)
        || JSON.stringify(prev.pdf || null) !== JSON.stringify(step.pdf || null);
    });
    if (structural) return 'now';
  }
  if (patch.stepPatch) {
    const fields = { ...patch.stepPatch };
    delete fields.id;
    delete fields.title;
    delete fields.description;
    delete fields.prompt;
    delete fields.promptSaved;
    if (Object.keys(fields).length) return 'now';
    if (patch.stepPatch.promptSaved && !('prompt' in patch.stepPatch) && !('title' in patch.stepPatch)) {
      return 'now';
    }
  }
  return 'debounce';
}

export default function PromptDesk() {
  const location = useLocation();
  const view = viewFromPath(location.pathname);
  const [folders, setFolders] = useState(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [active, setActive] = useState(null);
  const [compact, setCompact] = useState(false);
  const [floating, setFloating] = useState(false);
  const floatRef = useRef(null);
  const foldersRef = useRef([]);
  const savedRef = useRef([]);
  const userIdRef = useRef(null);
  const saveTimerRef = useRef(0);
  const savingRef = useRef(null);
  const queuedRef = useRef(null);

  const activePrompt = useMemo(() => {
    if (!active || !folders) return null;
    const folder = folders.find((item) => item.id === active.folderId);
    const prompt = folder?.prompts.find((item) => item.id === active.promptId);
    if (!folder || !prompt) return null;
    return { folder, prompt };
  }, [folders, active]);

  function queueSave(next, mode) {
    queuedRef.current = next;
    window.clearTimeout(saveTimerRef.current);
    if (mode === 'now') {
      void flushSave();
      return;
    }
    saveTimerRef.current = window.setTimeout(() => { void flushSave(); }, 350);
  }

  async function flushSave() {
    window.clearTimeout(saveTimerRef.current);
    const userId = userIdRef.current;
    const snapshot = queuedRef.current;
    if (!userId || !snapshot) return;
    if (savingRef.current) return;
    queuedRef.current = null;
    const previous = savedRef.current;
    savingRef.current = savePromptDesk(userId, snapshot, previous)
      .then(() => {
        savedRef.current = snapshot;
      })
      .catch((error) => {
        console.warn('[prompt-desk] save failed', error?.message || error);
        if (!queuedRef.current) queuedRef.current = snapshot;
      })
      .finally(() => {
        savingRef.current = null;
        if (queuedRef.current && queuedRef.current !== snapshot) void flushSave();
      });
    await savingRef.current;
  }

  function updateFolders(recipe, mode = 'debounce') {
    const next = recipe(foldersRef.current || []);
    foldersRef.current = next;
    setFolders(next);
    queueSave(next, mode);
  }

  function addCollection() {
    updateFolders((prev) => [...prev, blankFolder(prev.length)], 'now');
  }

  function addPrompt(folderId, prompt) {
    updateFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: [...folder.prompts, prompt] }
        : folder
    )), 'now');
  }

  function patchPrompt(patch) {
    if (!active) return;
    const before = (foldersRef.current || [])
      .find((folder) => folder.id === active.folderId)
      ?.prompts.find((prompt) => prompt.id === active.promptId);
    updateFolders((prev) => prev.map((folder) => {
      if (folder.id !== active.folderId) return folder;
      return {
        ...folder,
        prompts: folder.prompts.map((prompt) => {
          if (prompt.id !== active.promptId) return prompt;
          if (patch.stepPatch) {
            const { stepPatch, ...rest } = patch;
            return {
              ...prompt,
              ...rest,
              steps: (prompt.steps || []).map((step) => (
                step.id === stepPatch.id ? { ...step, ...stepPatch, id: step.id } : step
              )),
            };
          }
          return { ...prompt, ...patch };
        }),
      };
    }), saveMode(patch, before));
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
    updateFolders((prev) => prev.map((folder) => (
      folder.id === folderId ? { ...folder, label } : folder
    )));
  }

  function deleteFolder(folderId) {
    updateFolders((prev) => prev.filter((folder) => folder.id !== folderId), 'now');
    setActive((current) => (current?.folderId === folderId ? null : current));
    setCompact(false);
    if (active?.folderId === folderId) closeFloat();
  }

  function deletePrompt(folderId, promptId) {
    updateFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: folder.prompts.filter((prompt) => prompt.id !== promptId) }
        : folder
    )), 'now');
    setActive((current) => (current?.promptId === promptId ? null : current));
    setCompact(false);
    if (active?.promptId === promptId) closeFloat();
  }

  useEffect(() => {
    let cancel = false;
    currentPromptUserId()
      .then(async (userId) => {
        if (cancel) return;
        if (!userId) {
          const next = [blankFolder(0)];
          foldersRef.current = next;
          setFolders(next);
          return;
        }
        userIdRef.current = userId;
        const loaded = await loadPromptDesk(userId);
        if (cancel) return;
        const next = loaded.length ? loaded : [blankFolder(0)];
        foldersRef.current = next;
        savedRef.current = loaded;
        setFolders(next);
      })
      .catch((error) => {
        console.warn('[prompt-desk] load failed', error?.message || error);
        if (cancel) return;
        const next = [blankFolder(0)];
        foldersRef.current = next;
        setFolders(next);
      });
    const flush = () => { void flushSave(); };
    window.addEventListener('pagehide', flush);
    return () => {
      cancel = true;
      window.removeEventListener('pagehide', flush);
      void flushSave();
    };
  }, []);

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

  const shownFolders = useMemo(() => {
    const list = folders || [];
    const q = submitted.trim().toLowerCase();
    if (!q) return list.map((folder) => ({ folder, searchOpen: false }));
    const matched = [];
    const rest = [];
    for (const folder of list) {
      const hit = folder.prompts.some((prompt) => titleHit(prompt, q));
      if (!hit) {
        rest.push({ folder, searchOpen: false });
        continue;
      }
      matched.push({
        folder: { ...folder, prompts: promptsForSearch(folder.prompts, q) },
        searchOpen: true,
      });
    }
    return [...matched, ...rest];
  }, [folders, submitted]);

  useEffect(() => {
    if (!submitted.trim()) return;
    document.querySelector('.prompt-desk__folder--hit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [submitted, shownFolders]);

  return (
    <div className="prompt-desk">
      <div className="prompt-desk__dots" aria-hidden="true" />
      <DeskSidebar view={view} />
      <div className="prompt-desk__main">
      {view === 'settings' ? <DeskPlaceholder title="Settings" /> : null}
      {view === 'embed' ? <EmbedHtml /> : null}
      {view === 'home' ? (
      <>
      <header className="prompt-desk__bar">
        <p className="prompt-desk__mark">Futura Nota</p>
        <button type="button" className="prompt-desk__new" onClick={addCollection} disabled={!folders}>
          Nueva colección
        </button>
      </header>
      <div className="prompt-desk__search">
        <input
          type="search"
          value={query}
          placeholder="Buscar"
          aria-label="Buscar un archivo"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            setSubmitted(query.trim());
          }}
        />
      </div>
      <div className="prompt-desk__grid">
        {shownFolders.map(({ folder, searchOpen }, index) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            searchOpen={searchOpen}
            highlightQuery={submitted}
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
      </>
      ) : null}

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
    </div>
  );
}

function ModelPicker({
  modelIds,
  open,
  infoOpen,
  customDraft,
  onToggle,
  onToggleInfo,
  onCustomDraft,
  onChange,
}) {
  const ids = Array.isArray(modelIds) ? modelIds : [];
  const chosen = ids.length > 0;
  return (
    <div className="prompt-model">
      {ids.map((id) => {
        const known = PROMPT_MODELS.find((model) => model.id === id);
        const label = known?.label || id;
        return (
          <button
            key={id}
            type="button"
            className="prompt-models__item is-selected"
            aria-label={`Quitar ${label}`}
            onClick={() => onChange(ids.filter((item) => item !== id))}
          >
            {known ? <img src={known.src} alt="" /> : (
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="7" />
                </svg>
              </span>
            )}
            <span>{label}</span>
          </button>
        );
      })}
      {chosen ? null : (
        <>
          <button type="button" className="prompt-models__item" aria-expanded={open} onClick={onToggle}>
            <span className="prompt-models__glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="7" />
                <path d="M12 9v3l2 2" />
              </svg>
            </span>
            <span>Select a model</span>
          </button>
          <button
            type="button"
            className="prompt-model__info"
            aria-expanded={infoOpen}
            aria-label="Where this prompt is pasted"
            onClick={onToggleInfo}
          >
            i
          </button>
        </>
      )}
    </div>
  );
}

function ModelMenu({ customDraft, onCustomDraft, onChange }) {
  return (
    <div className="prompt-drop prompt-model__menu" role="listbox" aria-label="Select a model">
      {PROMPT_MODELS.map((model) => (
        <button
          key={model.id}
          type="button"
          role="option"
          className="prompt-drop__choice"
          onClick={() => onChange([model.id])}
        >
          <img src={model.src} alt="" />
          <span>{model.label}</span>
        </button>
      ))}
      <form
        className="prompt-model__custom"
        onSubmit={(event) => {
          event.preventDefault();
          const name = customDraft.trim();
          if (!name) return;
          onChange([name]);
        }}
      >
        <input
          value={customDraft}
          placeholder="Custom destination"
          aria-label="Custom destination"
          onChange={(event) => onCustomDraft(event.target.value)}
        />
        <button type="submit">Set</button>
      </form>
    </div>
  );
}

function InstructionPanel({ prompt, compact, onPatch, onCompact, onExpand, onClose }) {
  const { steps, index, step } = stepAt(prompt);
  const copiedText = resolvePrompt(step.prompt, prompt.variables || []).trim();
  const canCopy = Boolean(step.promptSaved && copiedText);
  const snippet = (copiedText || 'Prompt vacío').slice(0, 90);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(() => hasSavedPrompt(prompt));
  const [showImage, setShowImage] = useState(() => Boolean(step.image) && !prompt.video?.embedSrc && !prompt.pdf?.name);
  const [showVideo, setShowVideo] = useState(() => Boolean(prompt.video?.embedSrc) && !step.promptSaved);
  const [showPdf, setShowPdf] = useState(() => Boolean(prompt.pdf?.name) && !prompt.video?.embedSrc && !step.promptSaved);
  const [pdfError, setPdfError] = useState('');
  const [pdfReading, setPdfReading] = useState(false);
  const [pdfPages, setPdfPages] = useState([]);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [pdfStatus, setPdfStatus] = useState('idle');
  const pdfPagesRef = useRef([]);
  const [dragImage, setDragImage] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoPaused, setVideoPaused] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelInfo, setModelInfo] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const videoRef = useRef(null);
  const showSide = showImage || showVideo || showPdf;
  const chipImage = step.image || coverImage(prompt);

  function patchStep(patch) {
    onPatch({ stepPatch: { id: step.id, ...patch } });
  }

  useEffect(() => {
    const saved = hasSavedPrompt(prompt);
    setSheetOpen(saved);
    if (saved && index !== 0) onPatch({ stepIndex: 0 });
    setModelOpen(false);
    setModelInfo(false);
    setCustomModel('');
    setVideoDraft(prompt.video?.rawInput || '');
    setVideoError('');
    setVideoPaused(true);
    setPdfError('');
    setPdfPages([]);
    setPdfPageCount(0);
    setPdfPageIndex(0);
    setPdfStatus('idle');
    pdfPagesRef.current = [];
    const landing = (saved ? prompt.steps?.[0] : null) || step;
    const hideMedia = Boolean(saved && landing?.promptSaved);
    if (hideMedia) {
      setShowVideo(false);
      setShowPdf(false);
      setShowImage(Boolean(landing?.image));
    } else if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowImage(false);
      setShowPdf(false);
    } else if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowImage(false);
      setShowVideo(false);
    } else if (step.image) {
      setShowImage(true);
      setShowVideo(false);
      setShowPdf(false);
    } else {
      setShowImage(false);
      setShowVideo(false);
      setShowPdf(false);
    }
  }, [prompt.id]);

  useEffect(() => {
    setModelOpen(false);
    setModelInfo(false);
    setFormatOpen(false);
    setCustomModel('');
  }, [step.id]);

  useEffect(() => {
    if (!sheetOpen) return;
    if (step.promptSaved) {
      setShowPdf(false);
      setShowVideo(false);
      setShowImage(Boolean(step.image));
      return;
    }
    if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowPdf(false);
      setShowImage(false);
    } else if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowVideo(false);
      setShowImage(false);
    }
    // Only when the page changes. Saving hides the column in saveStep; the file keeps the PDF or video for the next page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => {
    if (!showPdf || !prompt.pdf?.name) {
      setPdfPages([]);
      setPdfPageCount(0);
      setPdfPageIndex(0);
      pdfPagesRef.current = [];
      setPdfStatus('idle');
      return undefined;
    }
    let cancel = false;
    const fileId = prompt.id;
    const url = prompt.pdf?.url || '';
    const name = prompt.pdf.name;
    setPdfStatus('loading');
    setPdfPageIndex(0);
    (async () => {
      try {
        const local = pdfFiles.get(fileId);
        let data = null;
        if (local) {
          data = await local.arrayBuffer();
        } else if (url) {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 15000);
          let response;
          try {
            response = await fetch(url, { signal: controller.signal });
          } finally {
            window.clearTimeout(timer);
          }
          if (!response.ok) throw new Error(`fetch_${response.status}`);
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          pdfFiles.set(fileId, new File([bytes], name, { type: 'application/pdf' }));
          data = bytes.slice();
        }
        if (cancel) return;
        if (!data) {
          setPdfStatus('missing');
          return;
        }
        const rendered = await renderPdfPageImages(data, {
          onPage(snapshot) {
            if (cancel) return;
            pdfPagesRef.current = snapshot.images;
            setPdfPages(snapshot.images);
            setPdfPageCount(snapshot.pageCount);
            setPdfStatus('ready');
          },
        });
        if (cancel) return;
        if (!rendered.images.length) {
          setPdfStatus('missing');
          setPdfError('No se pudo mostrar el PDF.');
          return;
        }
        pdfPagesRef.current = rendered.images;
        setPdfPages(rendered.images);
        setPdfPageCount(rendered.pageCount);
        setPdfStatus('ready');
      } catch (error) {
        console.warn('[prompt-desk] pdf preview failed', error?.message || error);
        if (!cancel) {
          setPdfStatus('missing');
          setPdfError('No se pudo abrir el PDF guardado.');
        }
      }
    })();
    return () => { cancel = true; };
  }, [showPdf, prompt.id, prompt.pdf?.name, prompt.pdf?.url]);

  function takeImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const stepId = step.id;
    readImageFile(file, (image) => {
      onPatch({ stepPatch: { id: stepId, image, promptSaved: false } });
      setShowImage(true);
    });
    currentPromptUserId()
      .then((userId) => {
        if (!userId) return null;
        return uploadPromptImage(file, stepId, userId);
      })
      .then((uploaded) => {
        if (!uploaded) return;
        onPatch({
          stepPatch: {
            id: stepId,
            image: uploaded.url,
            imagePath: uploaded.path,
            promptSaved: false,
          },
        });
      })
      .catch((error) => {
        console.warn('[prompt-desk] image upload failed', error?.message || error);
      });
  }

  function saveVideo(raw) {
    const parsed = parseVideoEmbedInput(raw);
    if (parsed.error || !parsed.embedSrc) {
      setVideoError(parsed.error || 'Pega un enlace de YouTube, Vimeo o Instagram.');
      return;
    }
    setVideoError('');
    setVideoDraft(parsed.rawInput);
    onPatch({
      video: {
        rawInput: parsed.rawInput,
        provider: parsed.provider,
        videoId: parsed.videoId,
        embedSrc: parsed.embedSrc,
      },
    });
  }

  function togglePlayback() {
    const frame = videoRef.current;
    if (!frame?.contentWindow || !prompt.video) return;
    if (prompt.video.provider === 'instagram') return;
    const nextPaused = !videoPaused;
    if (prompt.video.provider === 'vimeo') {
      frame.contentWindow.postMessage(JSON.stringify({ method: nextPaused ? 'pause' : 'play' }), '*');
    } else {
      frame.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: nextPaused ? 'pauseVideo' : 'playVideo',
        args: [],
      }), '*');
    }
    setVideoPaused(nextPaused);
  }

  function removeVideo() {
    setVideoDraft('');
    setVideoError('');
    setVideoPaused(true);
    setShowVideo(false);
    onPatch({ video: null });
  }

  function takePdf(file) {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setPdfError('Elige un archivo PDF.');
      return;
    }
    const fileId = prompt.id;
    pdfFiles.set(fileId, file);
    setPdfError('');
    setShowPdf(true);
    setShowImage(false);
    setShowVideo(false);
    onPatch({ pdf: { name: file.name, path: '', url: '' } });
  }

  async function extractPdf() {
    if (!prompt.pdf?.name) return;
    setPdfReading(true);
    setPdfError('');
    try {
      let images = pdfPagesRef.current;
      if (!images.length) {
        const local = pdfFiles.get(prompt.id);
        const data = local
          ? await local.arrayBuffer()
          : (prompt.pdf?.url ? await fetchPdfBytesFromUrl(prompt.pdf.url) : null);
        if (!data) {
          setPdfError('Vuelve a elegir el PDF para leerlo.');
          return;
        }
        const rendered = await renderPdfPageImages(data);
        images = rendered.images;
        pdfPagesRef.current = images;
        setPdfPages(images);
        setPdfPageCount(rendered.pageCount);
      }
      if (!images.length) {
        setPdfError('No se pudo mostrar el PDF.');
        return;
      }
      const account = useAuthStore.getState().user;
      const parts = [];
      for (let start = 0; start < images.length; start += 3) {
        const pages = images.slice(start, start + 3).map((image, offset) => ({
          index: start + offset + 1,
          image,
        }));
        const result = await apiClient(API_ROUTES.promptPdfRead, {
          method: 'POST',
          body: JSON.stringify({
            pages,
            userId: account?.id,
            userEmail: account?.email,
          }),
        });
        const piece = String(result?.text || '').trim();
        if (piece) parts.push(piece);
      }
      const text = parts.join('\n\n');
      if (!text) {
        setPdfError('Groq no encontró texto en estas páginas.');
        return;
      }
      const current = step.prompt.trim();
      patchStep({
        prompt: current ? `${current}\n\n${text}` : text,
        promptSaved: false,
      });
    } catch (error) {
      console.warn('[prompt-desk] pdf read failed', error?.message || error);
      const message = error instanceof Error ? error.message : 'No se pudo leer el PDF.';
      setPdfError(message.length > 180 ? 'No se pudo leer el PDF.' : message);
    } finally {
      setPdfReading(false);
    }
  }

  function clearPdf() {
    pdfFiles.delete(prompt.id);
    setPdfError('');
    setPdfPages([]);
    setPdfPageCount(0);
    setPdfPageIndex(0);
    setPdfStatus('idle');
    pdfPagesRef.current = [];
    setShowPdf(false);
    onPatch({ pdf: null });
  }

  function openBuiltPrompt() {
    setSheetOpen(true);
  }

  function showIndexMedia() {
    if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowImage(false);
      setShowVideo(false);
    } else if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowImage(false);
      setShowPdf(false);
    }
  }

  function saveStep() {
    setShowPdf(false);
    setShowVideo(false);
    setShowImage(Boolean(step.image));
    patchStep({ promptSaved: true });
  }

  function editStep() {
    patchStep({ promptSaved: false });
  }

  function goBack() {
    if (index <= 0) {
      setSheetOpen(false);
      showIndexMedia();
      return;
    }
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
      setSheetOpen(false);
      showIndexMedia();
      return;
    }
    const nextSteps = steps.filter((_, itemIndex) => itemIndex !== index);
    onPatch({
      steps: nextSteps,
      stepIndex: Math.min(index, nextSteps.length - 1),
    });
  }

  function commitBody({ prompt: nextPrompt, variables }) {
    if (variables && nextPrompt != null) {
      onPatch({
        variables,
        stepPatch: { id: step.id, prompt: nextPrompt, promptSaved: false },
      });
      return;
    }
    if (variables) {
      onPatch({ variables });
      return;
    }
    patchStep({ prompt: nextPrompt, promptSaved: false });
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
      className={showSide ? 'prompt-panel prompt-panel--wide' : 'prompt-panel'}
      aria-label="Prompt"
      onPaste={(event) => {
        const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith('image/'));
        if (item) takeImage(item.getAsFile());
      }}
    >
      <button type="button" className="prompt-panel__close" onClick={onClose} aria-label="Cerrar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className={showSide ? 'prompt-panel__split prompt-panel__split--side' : 'prompt-panel__split prompt-panel__split--prompt'}>
        <div className="prompt-panel__editor-tools">
          <input
            className="prompt-panel__name"
            value={prompt.name}
            placeholder="Nombre"
            aria-label="Nombre"
            onChange={(event) => onPatch({ name: event.target.value })}
          />
          <div className="prompt-models">
            <ModelPicker
              modelIds={step.modelIds}
              open={modelOpen}
              infoOpen={modelInfo}
              customDraft={customModel}
              onToggle={() => {
                setModelOpen((open) => !open);
                setModelInfo(false);
                setFormatOpen(false);
              }}
              onToggleInfo={() => {
                setModelInfo((open) => !open);
                setModelOpen(false);
                setFormatOpen(false);
              }}
              onCustomDraft={setCustomModel}
              onChange={(modelIds) => {
                patchStep({ modelIds: modelIds.slice(0, 1) });
                setCustomModel('');
                setModelOpen(false);
                setModelInfo(false);
              }}
            />
            {showImage ? null : (
              <button
                type="button"
                className="prompt-models__item"
                onClick={() => {
                  setShowImage(true);
                  setShowVideo(false);
                  setShowPdf(false);
                }}
              >
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span>Agregar imagen</span>
              </button>
            )}
            {sheetOpen || showVideo ? null : (
              <button
                type="button"
                className="prompt-models__item"
                onClick={() => {
                  setShowVideo(true);
                  setShowImage(false);
                  setShowPdf(false);
                }}
              >
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path className="prompt-models__play" d="M9 7v10l8-5-8-5z" />
                  </svg>
                </span>
                <span>Embed video</span>
              </button>
            )}
            {sheetOpen || showPdf ? null : (
              <button
                type="button"
                className="prompt-models__item"
                onClick={() => {
                  setShowPdf(true);
                  setShowImage(false);
                  setShowVideo(false);
                }}
              >
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 3h7l5 5v13H7z" />
                    <path d="M14 3v5h5" />
                  </svg>
                </span>
                <span>Agregar PDF</span>
              </button>
            )}
            <button
              type="button"
              className={sheetOpen ? 'prompt-models__item is-selected' : 'prompt-models__item'}
              onClick={openBuiltPrompt}
            >
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 4h10v16H7z" />
                  <path d="M10 8h4M10 12h4M10 16h3" />
                </svg>
              </span>
              <span>Prompt</span>
            </button>
            {sheetOpen ? (
              <button
                type="button"
                className={formatOpen ? 'prompt-format__btn is-selected' : 'prompt-format__btn'}
                aria-expanded={formatOpen}
                onClick={() => {
                  setFormatOpen((open) => !open);
                  setModelOpen(false);
                  setModelInfo(false);
                }}
              >
                {PROMPT_FORMATS.find((entry) => entry.id === (step.format || 'text'))?.label || 'Text'}
              </button>
            ) : null}
            <button type="button" className="prompt-models__item" onClick={onCompact}>
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M9 4H5v4M4 4l6 6M15 20h4v-4M20 20l-6-6" />
                </svg>
              </span>
              <span>Comprimir</span>
            </button>
          </div>
          {modelInfo ? (
            <p className="prompt-drop__note" role="note">
              Indicates which AI or platform you plan to paste your prompt into by choosing a model from the list or setting a custom destination.
            </p>
          ) : null}
          {modelOpen ? (
            <ModelMenu
              customDraft={customModel}
              onCustomDraft={setCustomModel}
              onChange={(modelIds) => {
                patchStep({ modelIds: modelIds.slice(0, 1) });
                setCustomModel('');
                setModelOpen(false);
                setModelInfo(false);
              }}
            />
          ) : null}
          {formatOpen ? (
            <div className="prompt-drop" role="listbox" aria-label="Formato">
              {PROMPT_FORMATS.map((entry) => {
                const selected = (step.format || 'text') === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? 'prompt-drop__choice is-selected' : 'prompt-drop__choice'}
                    onClick={() => patchStep({ format: entry.id, promptSaved: false })}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {showImage ? (
          <div className="prompt-panel__stage">
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
          </div>
        ) : null}
        {showVideo ? (
          <div className="prompt-panel__video">
            {prompt.video?.embedSrc ? (
              <iframe
                ref={videoRef}
                className="prompt-panel__player"
                src={playbackSrc(prompt.video)}
                title="Video"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                sandbox={prompt.video?.provider === 'instagram'
                  ? 'allow-scripts allow-same-origin allow-presentation'
                  : undefined}
              />
            ) : (
              <form
                className="prompt-panel__video-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveVideo(videoDraft);
                }}
              >
                <input
                  value={videoDraft}
                  placeholder="Pega un enlace de YouTube, Vimeo o Instagram"
                  aria-label="Enlace del video"
                  onChange={(event) => setVideoDraft(event.target.value)}
                />
                <button type="submit">Incrustar</button>
                {videoError ? <p role="alert">{videoError}</p> : null}
              </form>
            )}
          </div>
        ) : null}
        {showPdf ? (
          <div className={`prompt-panel__pdf${pdfPages.length ? ' prompt-panel__pdf--pages' : ''}`}>
            {pdfPages.length ? (
              <>
                <div className="prompt-panel__pdf-pages">
                  <img src={pdfPages[Math.min(pdfPageIndex, pdfPages.length - 1)]} alt="" />
                </div>
                <div className="prompt-panel__pdf-index">
                  <button
                    type="button"
                    aria-label="Página anterior del PDF"
                    disabled={pdfPageIndex <= 0}
                    onClick={() => setPdfPageIndex((current) => Math.max(0, current - 1))}
                  >
                    ‹
                  </button>
                  <span>{`${Math.min(pdfPageIndex, pdfPages.length - 1) + 1} / ${pdfPages.length}`}</span>
                  <button
                    type="button"
                    aria-label="Página siguiente del PDF"
                    disabled={pdfPageIndex >= pdfPages.length - 1}
                    onClick={() => setPdfPageIndex((current) => Math.min(pdfPages.length - 1, current + 1))}
                  >
                    ›
                  </button>
                </div>
              </>
            ) : pdfStatus === 'loading' ? (
              <p>Abriendo el PDF…</p>
            ) : (
              <label className="prompt-panel__pdf-pick">
                <span>{prompt.pdf?.name || 'Elige un PDF'}</span>
                {prompt.pdf?.name ? <span>Elige el PDF otra vez</span> : null}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => takePdf(event.target.files?.[0])}
                />
              </label>
            )}
          </div>
        ) : null}
        {showImage ? (
          <div className="prompt-panel__media-foot">
            <button type="button" className="prompt-panel__remove" onClick={() => setShowImage(false)}>
              Ocultar
            </button>
            {step.image ? (
              <button
                type="button"
                className="prompt-panel__remove"
                onClick={() => {
                  setShowImage(false);
                  patchStep({ image: '', imagePath: '' });
                }}
              >
                Quitar
              </button>
            ) : null}
          </div>
        ) : null}
        {showVideo ? (
          <div className="prompt-panel__media-foot">
            {prompt.video?.embedSrc && prompt.video?.provider !== 'instagram' ? (
              <button
                type="button"
                className="prompt-video__pause"
                onClick={togglePlayback}
                aria-label={videoPaused ? 'Play' : 'Pause'}
              >
                {videoPaused ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path className="prompt-video__play" d="M8 5v14l11-7-11-7z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14M16 5v14" />
                  </svg>
                )}
              </button>
            ) : null}
            <button type="button" className="prompt-panel__remove" onClick={() => setShowVideo(false)}>
              Ocultar
            </button>
            {prompt.video?.embedSrc ? (
              <button type="button" className="prompt-panel__remove" onClick={removeVideo}>
                Quitar
              </button>
            ) : null}
          </div>
        ) : null}
        {showPdf ? (
          <div className="prompt-panel__media-foot">
            {pdfPages.length ? (
              <button
                type="button"
                className="prompt-video__extract"
                disabled={pdfReading}
                onClick={() => { void extractPdf(); }}
              >
                {pdfReading ? 'Leyendo…' : 'Extraer datos'}
              </button>
            ) : null}
            {pdfError ? <p role="alert">{pdfError}</p> : null}
            <button type="button" className="prompt-panel__remove" onClick={() => setShowPdf(false)}>
              Ocultar
            </button>
            {prompt.pdf?.name ? (
              <button type="button" className="prompt-panel__remove" onClick={clearPdf}>
                Quitar
              </button>
            ) : null}
          </div>
        ) : null}
          {sheetOpen ? (
          <div className="prompt-sheet">
            <input
              className="prompt-sheet__title"
              value={stepTitleOf(step, index)}
              placeholder="Title"
              aria-label="Title"
              onChange={(event) => patchStep({ title: event.target.value })}
            />
            <DescriptionBlock
              className="prompt-sheet__description"
              value={step.description || ''}
              readOnly={Boolean(step.promptSaved)}
              onChange={(description) => patchStep({ description, promptSaved: false })}
            />
            <div className="prompt-drawer">
            <PromptBody
              key={step.id}
              prompt={step.prompt}
              variables={prompt.variables || []}
              placeholder="Insert Prompt"
              readOnly={Boolean(step.promptSaved)}
              onCommit={commitBody}
              className={
                step.format && step.format !== 'text'
                  ? 'prompt-panel__body prompt-panel__body--code'
                  : 'prompt-panel__body'
              }
              spellCheck={!step.format || step.format === 'text'}
            >
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
            </PromptBody>
            </div>
          </div>
          ) : (
          <div className="prompt-index" aria-label="Portada">
            <div className="prompt-index__fan">
              <span className="prompt-index__card" />
              <span className="prompt-index__card prompt-index__card--front" />
              <span className="prompt-index__card" />
            </div>
          </div>
          )}
          {sheetOpen ? (
          <div className="prompt-panel__foot">
            <div className="prompt-panel__step-actions">
              {step.promptSaved ? (
                <button type="button" onClick={editStep}>Editar</button>
              ) : step.prompt.trim() ? (
                <button type="button" onClick={saveStep}>Guardar</button>
              ) : null}
              <button type="button" onClick={deleteIndex}>Eliminar</button>
            </div>
          <div className="prompt-steps">
            <button
              type="button"
              className="prompt-steps__arrow"
              aria-label="Paso anterior"
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
          ) : null}
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
  const text = resolvePrompt(step.prompt, prompt.variables || []).trim();
  const canCopy = Boolean(step.promptSaved && text);
  const [copied, setCopied] = useState(false);

  function patchFloatStep(patch) {
    onPatch({ stepPatch: { id: step.id, ...patch, promptSaved: true } });
  }

  function commitBody({ prompt: nextPrompt, variables }) {
    if (variables && nextPrompt != null) {
      onPatch({
        variables,
        stepPatch: { id: step.id, prompt: nextPrompt, promptSaved: true },
      });
      return;
    }
    if (variables) {
      onPatch({ variables });
      return;
    }
    patchFloatStep({ prompt: nextPrompt });
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
    onPatch({ stepPatch: { id: step.id, title } });
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
          placeholder="Title"
          aria-label="Title"
          onChange={(event) => patchStepTitle(event.target.value)}
        />
        <DescriptionBlock
          className="prompt-float__description"
          value={step.description || ''}
          readOnly={Boolean(step.promptSaved)}
          onChange={(description) => onPatch({ stepPatch: { id: step.id, description, promptSaved: false } })}
        />
        <div className="prompt-drawer">
          <PromptBody
            key={step.id}
            prompt={step.prompt}
            variables={prompt.variables || []}
            placeholder="Insert Prompt"
            readOnly={Boolean(step.promptSaved)}
            onCommit={commitBody}
            className="prompt-float__text"
          >
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
          </PromptBody>
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
    position: relative;
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
  .prompt-desc {
    position: relative;
    flex: none;
    min-height: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .prompt-desc--closed {
    display: flex;
    justify-content: flex-end;
    min-height: 32px;
  }
  .prompt-desc__toggle {
    position: absolute;
    top: 4px;
    right: 6px;
    z-index: 1;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
  }
  .prompt-desc--closed .prompt-desc__toggle {
    position: relative;
    top: auto;
    right: auto;
  }
  .prompt-desc__toggle svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .prompt-desc--closed .prompt-desc__toggle svg { transform: rotate(-90deg); }
  .prompt-float__description {
    flex: none;
    width: 100%;
    margin: 0;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.86);
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
    padding: 8px 40px 4px 16px;
    resize: none;
    overflow-x: hidden;
    overflow-y: auto;
    outline: none;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: #2a2a2a #101010;
  }
  .prompt-float__description::-webkit-scrollbar { width: 8px; }
  .prompt-float__description::-webkit-scrollbar-track { background: #101010; }
  .prompt-float__description::-webkit-scrollbar-thumb {
    border-radius: 8px;
    background: #2a2a2a;
  }
  .prompt-float__description::placeholder { color: rgba(255, 255, 255, 0.38); }
  .prompt-body__editor[data-empty="true"]::before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.38);
  }
  .prompt-drawer {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .prompt-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .prompt-body__frame {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
  }
  .prompt-body__editor {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .prompt-body__editor[data-empty]::before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.38);
    pointer-events: none;
  }
  .prompt-library {
    position: absolute;
    z-index: 20;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.55);
  }
  .prompt-library__page {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border-radius: 16px;
    background: #151515;
    color: #fff;
    overflow: hidden;
  }
  .prompt-library__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .prompt-library__head p {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .prompt-library__head h2 { margin: 4px 0 0; font-size: 18px; font-weight: 560; }
  .prompt-library__actions { display: flex; align-items: center; gap: 8px; }
  .prompt-library__add {
    width: 32px;
    height: 32px;
    margin-top: 14px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 8px;
    background: transparent;
    color: #fff;
    padding: 0;
    cursor: pointer;
  }
  .prompt-library__add svg,
  .prompt-library__rename svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .prompt-library__close {
    width: 40px;
    height: 40px;
    flex: none;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
  }
  .prompt-library__head svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .prompt-library__info {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.45;
  }
  .prompt-library__list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .prompt-library__name {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    font: inherit;
    font-size: 13px;
    padding: 8px 10px;
    outline: none;
  }
  .prompt-library__empty { margin: 0; color: rgba(255, 255, 255, 0.62); font-size: 13px; }
  .prompt-library__item { display: flex; flex-direction: column; gap: 6px; }
  .prompt-library__row { display: flex; align-items: center; gap: 8px; }
  .prompt-library__row > button:first-child {
    flex: 1;
    min-width: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 13px;
    text-align: left;
    padding: 8px 10px;
    cursor: pointer;
  }
  .prompt-library__row > button:first-child[aria-expanded="true"] { background: rgba(255, 255, 255, 0.08); }
  .prompt-library__rename {
    width: 28px;
    height: 28px;
    flex: none;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    padding: 0;
    cursor: pointer;
    opacity: 0;
  }
  .prompt-library__item:hover .prompt-library__rename,
  .prompt-library__rename:focus-visible { opacity: 1; }
  .prompt-library__item textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 2.2em;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    font: inherit;
    font-size: 13px;
    line-height: 1.4;
    padding: 8px 10px;
    resize: none;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    outline: none;
  }
  .prompt-var,
  .prompt-var--filled {
    display: inline;
    max-width: 100%;
    padding: 0 3px;
    border-radius: 4px;
    background: rgba(255, 120, 120, 0.16);
    color: #ff8f8f;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .prompt-mention-layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    pointer-events: none;
  }
  .prompt-mention {
    position: absolute;
    z-index: 1;
    pointer-events: auto;
    min-width: 180px;
    padding: 6px;
    border-radius: 10px;
    background: #2a2a2a;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }
  .prompt-mention button,
  .prompt-mention__name {
    display: block;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    border: 0;
    background: transparent;
    color: #fff;
    padding: 8px 10px;
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .prompt-mention button.is-active { background: rgba(255, 255, 255, 0.08); }
  .prompt-mention__name { cursor: default; color: rgba(255, 255, 255, 0.62); }
  .prompt-namepop-layer {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.45);
  }
  .prompt-namepop {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    width: min(320px, calc(100% - 48px));
    padding: 16px;
    border-radius: 14px;
    background: #2a2a2a;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  }
  .prompt-namepop img { width: 36px; height: auto; }
  .prompt-namepop p { margin: 0; color: #fff; font-size: 14px; line-height: 1.35; }
  .prompt-namepop input {
    width: 100%;
    box-sizing: border-box;
    border: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.28);
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 14px;
    padding: 6px 0;
    outline: none;
  }
  .prompt-mention__name input {
    display: block;
    width: 100%;
    margin-top: 6px;
    box-sizing: border-box;
    border: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.28);
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 14px;
    padding: 4px 0;
    outline: none;
  }
  .prompt-float__text {
    flex: 1;
    width: 100%;
    min-height: 0;
    height: auto;
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
  .prompt-float__text {
    scrollbar-width: thin;
    scrollbar-color: #2a2a2a #151515;
  }
  .prompt-float__text::-webkit-scrollbar { width: 8px; height: 8px; }
  .prompt-float__text::-webkit-scrollbar-track { background: #151515; }
  .prompt-float__text::-webkit-scrollbar-thumb {
    border-radius: 8px;
    background: #2a2a2a;
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
