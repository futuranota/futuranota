import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useNavigate } from 'react-router-dom';
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
import { PromptBody, VariableDeck } from './PromptBody.jsx';
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
    imagePath: '',
    video: null,
    format: 'text',
    promptSaved: false,
  };
}

function stepTitleOf(step, index) {
  return typeof step.title === 'string' ? step.title : defaultStepTitle(index);
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

function AccountRail() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [loggingOut, setLoggingOut] = useState(false);
  const email = user?.email || '';
  const initial = (email[0] || 'F').toUpperCase();

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
    <aside className="prompt-desk__rail" aria-label="Cuenta">
      <div className="prompt-desk__account">
        <span className="prompt-desk__avatar" aria-hidden="true">{initial}</span>
        {email ? <span className="prompt-desk__email">{email}</span> : null}
        <button
          type="button"
          className="prompt-desk__signout"
          onClick={() => { void handleSignOut(); }}
          disabled={loggingOut}
        >
          {loggingOut ? t('common.signingOut') : t('common.signOut')}
        </button>
      </div>
    </aside>
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
  if ('stepIndex' in patch || 'modelId' in patch) return 'now';
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
        || JSON.stringify(prev.video) !== JSON.stringify(step.video);
    });
    if (structural) return 'now';
  }
  if (patch.stepPatch) {
    const fields = { ...patch.stepPatch };
    delete fields.id;
    delete fields.title;
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
      <AccountRail />
      <div className="prompt-desk__main">
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

function InstructionPanel({ prompt, compact, onPatch, onCompact, onExpand, onClose }) {
  const { steps, index, step } = stepAt(prompt);
  const copiedText = resolvePrompt(step.prompt, prompt.variables || []).trim();
  const canCopy = Boolean(step.promptSaved && copiedText);
  const snippet = (copiedText || 'Prompt vacío').slice(0, 90);
  const [copied, setCopied] = useState(false);
  const [showImage, setShowImage] = useState(() => Boolean(step.image) && !step.video?.embedSrc);
  const [showVideo, setShowVideo] = useState(() => Boolean(step.video?.embedSrc));
  const [dragImage, setDragImage] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoPaused, setVideoPaused] = useState(true);
  const [varsOpen, setVarsOpen] = useState(false);
  const videoRef = useRef(null);
  const showSide = showImage || showVideo;
  const chipImage = step.image || coverImage(prompt);

  function patchStep(patch) {
    onPatch({ stepPatch: { id: step.id, ...patch } });
  }

  useEffect(() => {
    setVideoDraft(step.video?.rawInput || '');
    setVideoError('');
    setVideoPaused(true);
  }, [step.id, step.video?.embedSrc]);

  useEffect(() => {
    if (step.video?.embedSrc) {
      setShowVideo(true);
      setShowImage(false);
    } else if (step.image) {
      setShowImage(true);
      setShowVideo(false);
    } else {
      setShowImage(false);
      setShowVideo(false);
    }
  }, [step.id]);

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
    patchStep({
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
    if (!frame?.contentWindow || !step.video) return;
    if (step.video.provider === 'instagram') return;
    const nextPaused = !videoPaused;
    if (step.video.provider === 'vimeo') {
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
    patchStep({ video: null });
  }

  function saveStep() {
    patchStep({ promptSaved: true });
  }

  function editStep() {
    patchStep({ promptSaved: false });
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
      <div className={showSide ? 'prompt-panel__split' : 'prompt-panel__split prompt-panel__split--prompt'}>
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
              <button
                type="button"
                className="prompt-models__item"
                onClick={() => {
                  setShowImage(true);
                  setShowVideo(false);
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
            {showVideo ? null : (
              <button
                type="button"
                className="prompt-models__item"
                onClick={() => {
                  setShowVideo(true);
                  setShowImage(false);
                }}
              >
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path className="prompt-models__play" d="M9 7v10l8-5-8-5z" />
                  </svg>
                </span>
                <span>Agregar video</span>
              </button>
            )}
            <button
              type="button"
              className={varsOpen ? 'prompt-models__item is-selected' : 'prompt-models__item'}
              aria-expanded={varsOpen}
              onClick={() => setVarsOpen((open) => !open)}
            >
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8 7h11M8 12h11M8 17h11M5 7h.01M5 12h.01M5 17h.01" />
                </svg>
              </span>
              <span>Variables</span>
            </button>
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
            {step.video?.embedSrc ? (
              <iframe
                ref={videoRef}
                className="prompt-panel__player"
                src={playbackSrc(step.video)}
                title="Video"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                sandbox={step.video?.provider === 'instagram'
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
        {showImage && step.image ? (
          <div className="prompt-panel__media-foot">
            <button type="button" className="prompt-panel__remove" onClick={() => patchStep({ image: '', imagePath: '' })}>
              Remove
            </button>
          </div>
        ) : null}
        {showVideo && step.video?.embedSrc ? (
          <div className="prompt-panel__media-foot">
            <div className="prompt-video__banner">
              {step.video?.provider === 'instagram' ? null : (
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
              )}
              <button type="button" className="prompt-video__extract">Extraer texto</button>
            </div>
            <button type="button" className="prompt-panel__remove" onClick={removeVideo}>
              Remove
            </button>
          </div>
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
            <PromptBody
              key={step.id}
              prompt={step.prompt}
              variables={prompt.variables || []}
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
          <div className="prompt-panel__foot">
            {step.prompt.trim() ? (
              <div className="prompt-panel__step-actions">
                {step.promptSaved ? (
                  <button type="button" onClick={editStep}>Editar</button>
                ) : (
                  <>
                    <button type="button" onClick={saveStep}>Guardar</button>
                    <button type="button" onClick={deleteIndex}>Eliminar</button>
                  </>
                )}
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
      <VariableDeck
        open={varsOpen}
        title={prompt.name}
        variables={prompt.variables || []}
        onChange={(variables) => onPatch({ variables })}
        onClose={() => setVarsOpen(false)}
      />
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
  const [varsOpen, setVarsOpen] = useState(false);

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
          placeholder="Título"
          aria-label="Título de esta página"
          onChange={(event) => patchStepTitle(event.target.value)}
        />
        <div className="prompt-float__library">
          <button
            type="button"
            className={varsOpen ? 'prompt-float__vars is-selected' : 'prompt-float__vars'}
            aria-expanded={varsOpen}
            onClick={() => setVarsOpen((open) => !open)}
          >
            Variables
          </button>
        </div>
        <div className="prompt-drawer">
          <PromptBody
            key={step.id}
            prompt={step.prompt}
            variables={prompt.variables || []}
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
      <VariableDeck
        open={varsOpen}
        title={prompt.name}
        variables={prompt.variables || []}
        onChange={(variables) => onPatch({ variables })}
        onClose={() => setVarsOpen(false)}
      />
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
  .prompt-drawer {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .prompt-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .prompt-body__frame {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .prompt-body__editor {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .prompt-body__editor[data-empty]::before {
    content: "Descripción";
    color: rgba(255, 255, 255, 0.38);
    pointer-events: none;
  }
  .prompt-float__library {
    position: relative;
    flex: none;
    padding: 8px 16px 0;
  }
  .prompt-float__vars {
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 999px;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 13px;
    padding: 6px 12px;
    cursor: pointer;
  }
  .prompt-float__vars.is-selected { border-color: rgba(255, 255, 255, 0.72); }
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
