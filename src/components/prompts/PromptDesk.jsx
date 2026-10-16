import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { PROMPT_FORMATS } from '../../lib/codeBlockLanguages.js';
import { copyRichText } from '../../lib/copyToClipboard.js';
import {
  currentPromptUserId,
  loadPromptDesk,
  savePromptDesk,
  uploadPromptImage,
} from '../../lib/promptDeskSync.js';
import { supabase } from '../../lib/supabaseClient.js';
import { normalizeEmbedSrcForPlayback, parseVideoEmbedInput } from '../../lib/videoEmbed.js';
import { liftPromptPlaceholders, resolvePrompt } from '../../lib/promptVariables.js';
import { useAuthStore } from '../../stores/authStore.js';
import GlassFolder, { MAX_VISIBLE } from './GlassFolder.jsx';
import { fetchPdfBytesFromUrl, renderPdfPageImages } from '../../lib/importPdfText.js';
import { apiClient } from '../../api/client.js';
import { API_ROUTES } from '../../api/routes.js';
import { PromptBody, VariableDeck, paintMarked, readMarked } from './PromptBody.jsx';
import EmbedHtml from './EmbedHtml.jsx';
import './prompt-desk.css';

const pdfFiles = new Map();

const ARTS = ['aurora', 'ember', 'dusk', 'glacier', 'verdant'];

const HOME_FRAMES = [
  '/Portada/left%20frame.png',
  '/Portada/center-frame.png',
  '/Portada/right%20frame.png',
];

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
    pdfPage: null,
    video: null,
    pdf: null,
    format: 'text',
    promptSaved: false,
  };
}

function pdfReadError(error) {
  const message = error instanceof Error ? error.message : 'Couldn’t read the PDF.';
  const json = message.match(/\{[\s\S]*\}$/);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      if (parsed?.error) return String(parsed.error);
    } catch {
      /* The body was not JSON. */
    }
  }
  return message.length > 280 ? `${message.slice(0, 280)}…` : message;
}

function retryWaitMs(error, attempt) {
  const message = error instanceof Error ? error.message : '';
  const wait = message.match(/try again in ([0-9.]+)s/i);
  if (wait) return Math.min(60000, Math.ceil(Number(wait[1]) * 1000) + 800);
  return [20000, 45000, 60000][attempt] || 60000;
}

function shrinkPdfImage(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxEdge = 720;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height, 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function stepHasImage(step) {
  return Boolean(step?.image) || Number.isInteger(step?.pdfPage);
}

function stepTitleOf(step) {
  return typeof step.title === 'string' ? step.title : '';
}

function plainCopy(template, variables) {
  return resolvePrompt(template, variables)
    .replace(/<\/?(?:strong|em|u|s|mark)>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function richCopy(template, variables) {
  const resolved = resolvePrompt(template, variables);
  const kept = [];
  const text = resolved.replace(/<\/?(strong|em|u|s|mark)>/gi, (tag) => {
    const name = tag.replace(/<\/?|>/g, '').toLowerCase();
    const token = `\u0000${kept.length}\u0000`;
    kept.push(tag.startsWith('</') ? `</${name}>` : `<${name}>`);
    return token;
  });
  return `<!DOCTYPE html><html><body>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => kept[Number(index)] || '')
    .replace(/\n/g, '<br>')}</body></html>`;
}

function promptHasText(value) {
  return Boolean(String(value || '').replace(/<\/?(?:strong|em|u|s|mark)>/gi, '').trim());
}

const FORMAT_TOOLS = [
  { id: 'bold', label: 'Bold', command: 'bold' },
  { id: 'italic', label: 'Italic', command: 'italic' },
  { id: 'underline', label: 'Underline', command: 'underline' },
  { id: 'strike', label: 'Strikethrough', command: 'strikeThrough' },
  { id: 'highlight', label: 'Highlight', command: 'highlight' },
];

function FormatIcon({ name }) {
  const paths = {
    bold: 'M7 5h6.2a3.4 3.4 0 0 1 0 6.8H7zM7 11.8h7.2a3.6 3.6 0 0 1 0 7.2H7z',
    italic: 'M14 5h6M8 19h6M15 5 11 19',
    underline: 'M7 4.5v7a5 5 0 0 0 10 0v-7M6 19.5h12',
    strike: 'M5 12h14M8.2 7.2c.6-1.4 2-2.2 3.8-2.2 2.4 0 3.8 1.2 3.8 2.8 0 .7-.3 1.3-.8 1.8M8.4 16.8c.7 1.1 2 1.8 3.8 1.8 2.3 0 3.8-1.1 3.8-2.8',
    highlight: 'M5 16.5 9.2 6l3.2 1.8L8.2 18.3zM14 8.2l3.6-1.6 2.2 3.2-3.6 1.6zM6 20h12',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function formatKind(command) {
  if (command === 'strikeThrough') return 'strike';
  return command;
}

function nodeHasFormat(node, kind) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = node.tagName;
  const style = node.getAttribute('style') || '';
  if (kind === 'bold') return tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/i.test(style);
  if (kind === 'italic') return tag === 'I' || tag === 'EM' || /font-style:\s*italic/i.test(style);
  if (kind === 'underline') return tag === 'U' || /text-decoration[^;]*underline/i.test(style);
  if (kind === 'strike') return tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/i.test(style);
  if (kind === 'highlight') return tag === 'MARK' || /background/i.test(style);
  return false;
}

function nearestFormat(node, root, kind) {
  let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (current && current !== root) {
    if (nodeHasFormat(current, kind)) return current;
    current = current.parentElement;
  }
  return null;
}

function liftFormat(mark) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
}

function stripFormat(fragment, kind) {
  const marks = [...fragment.querySelectorAll('*')].filter((node) => nodeHasFormat(node, kind));
  marks.reverse().forEach(liftFormat);
}

function selectionHasFormat(root, kind) {
  const selection = root.ownerDocument.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return false;
  const range = selection.getRangeAt(0);
  if (nearestFormat(range.startContainer, root, kind)) return true;
  if (range.collapsed) return false;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (nodeHasFormat(node, kind) && range.intersectsNode(node)) return true;
    node = walker.nextNode();
  }
  return false;
}

function toggleTextFormat(root, command) {
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  if (!selection?.rangeCount) return;
  const kind = formatKind(command);
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer) && !root.contains(range.startContainer)) return;
  if (selectionHasFormat(root, kind)) {
    if (range.collapsed) {
      const mark = nearestFormat(range.startContainer, root, kind);
      if (!mark) return;
      const last = mark.lastChild;
      liftFormat(mark);
      if (!last) return;
      const next = doc.createRange();
      next.setStartAfter(last);
      next.collapse(true);
      selection.removeAllRanges();
      selection.addRange(next);
      return;
    }
    const fragment = range.extractContents();
    stripFormat(fragment, kind);
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      const next = doc.createRange();
      next.setStartAfter(last);
      next.collapse(true);
      selection.removeAllRanges();
      selection.addRange(next);
    }
    return;
  }
  if (command === 'highlight') {
    doc.execCommand('styleWithCSS', false, true);
    doc.execCommand('hiliteColor', false, '#f4e7a3');
    return;
  }
  doc.execCommand('styleWithCSS', false, false);
  doc.execCommand(command, false, null);
}

function FormatBar({ active, onApply }) {
  return (
    <div className="prompt-formatbar" role="toolbar" aria-label="Text format">
      {FORMAT_TOOLS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active?.[item.command] ? 'prompt-formatbar__btn is-active' : 'prompt-formatbar__btn'}
          aria-label={item.label}
          aria-pressed={Boolean(active?.[item.command])}
          title={item.label}
          onMouseDown={(event) => {
            event.preventDefault();
            onApply(item.command);
          }}
        >
          <FormatIcon name={item.id} />
        </button>
      ))}
    </div>
  );
}

function DescriptionField({ className, value, readOnly, onChange, onEditFocus }) {
  const ref = useRef(null);
  const local = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || local.current === value) return;
    local.current = value;
    paintMarked(node, value, [], { chips: false });
    if (node.textContent.trim()) delete node.dataset.empty;
    else node.dataset.empty = 'true';
  }, [value]);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable={readOnly ? 'false' : 'true'}
      role="textbox"
      aria-multiline="true"
      aria-readonly={readOnly || undefined}
      aria-label="Brief description"
      data-placeholder="Brief description of the steps to follow"
      spellCheck
      suppressContentEditableWarning
      onInput={() => {
        const next = readMarked(ref.current);
        local.current = next;
        if (ref.current.textContent.trim()) delete ref.current.dataset.empty;
        else ref.current.dataset.empty = 'true';
        onChange(next);
      }}
      onFocus={() => onEditFocus?.(ref.current)}
      onMouseUp={() => onEditFocus?.(ref.current)}
      onKeyUp={() => onEditFocus?.(ref.current)}
    />
  );
}

function SheetFaces({ face, onFace }) {
  return (
    <div className="prompt-sheet__faces" role="tablist" aria-label="Prompt pages">
      <button
        type="button"
        role="tab"
        aria-selected={face === 0}
        onClick={() => onFace(0)}
      >
        Instrucciones
      </button>
      <span aria-hidden="true">\</span>
      <button
        type="button"
        role="tab"
        aria-selected={face === 1}
        onClick={() => onFace(1)}
      >
        Prompt
      </button>
      <button
        type="button"
        className="prompt-sheet__next"
        onClick={() => onFace(face === 0 ? 1 : 0)}
      >
        Next
      </button>
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
    assets: [],
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
  if ('stepIndex' in patch || 'modelId' in patch || 'pdf' in patch || 'video' in patch || 'assets' in patch) return 'now';
  if (patch.steps && beforePrompt) {
    const prevIds = (beforePrompt.steps || []).map((item) => item.id).join();
    const nextIds = patch.steps.map((item) => item.id).join();
    if (prevIds !== nextIds) return 'now';
    const structural = patch.steps.some((step) => {
      const prev = (beforePrompt.steps || []).find((item) => item.id === step.id);
      if (!prev) return true;
      return prev.image !== step.image
        || prev.imagePath !== step.imagePath
        || prev.pdfPage !== step.pdfPage
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
    const prompt = activePrompt?.prompt;
    if (prompt?.pdf || (prompt?.steps || []).some((step) => step.pdfPage != null)) {
      pdfFiles.delete(prompt.id);
      patchPrompt({
        pdf: null,
        steps: (prompt.steps || []).map((step) => ({ ...step, pdfPage: null })),
      });
    }
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
    let loadedOk = false;
    let loading = false;
    let retry = false;

    async function loadDesk() {
      if (loading) {
        retry = true;
        return;
      }
      loading = true;
      try {
        const userId = await currentPromptUserId();
        if (cancel || loadedOk) return;
        if (!userId) return;
        userIdRef.current = userId;
        const loaded = await loadPromptDesk(userId);
        if (cancel || loadedOk) return;
        loadedOk = true;
        const next = loaded.length ? loaded : [blankFolder(0)];
        foldersRef.current = next;
        savedRef.current = loaded;
        setFolders(next);
      } catch (error) {
        console.warn('[prompt-desk] load failed', error?.message || error);
      } finally {
        loading = false;
        if (retry && !cancel && !loadedOk) {
          retry = false;
          void loadDesk();
        }
      }
    }

    void loadDesk();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancel || loadedOk) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        window.setTimeout(() => { void loadDesk(); }, 0);
      }
    });
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || cancel || loadedOk) return;
      void loadDesk();
    };
    document.addEventListener('visibilitychange', onVisible);
    const flush = () => { void flushSave(); };
    window.addEventListener('pagehide', flush);
    return () => {
      cancel = true;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
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

      {activePrompt ? (
        <InstructionPanel
          prompt={activePrompt.prompt}
          compact={compact}
          parked={floating}
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
  onToggle,
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
        <button type="button" className="prompt-models__item prompt-models__item--tip" aria-expanded={open} onClick={onToggle}>
          <span className="prompt-models__glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 9v3l2 2" />
            </svg>
          </span>
          <span>Select model</span>
          <span className="prompt-models__tip" role="tooltip">
            Indicates which AI or platform you plan to paste your prompt into by choosing a model from the list or setting a custom destination.
          </span>
        </button>
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
          placeholder="Custom"
          aria-label="Custom"
          maxLength={24}
          size={7}
          onChange={(event) => onCustomDraft(event.target.value)}
        />
        <button type="submit">Set</button>
      </form>
    </div>
  );
}

function InstructionPanel({ prompt, compact, parked, onPatch, onCompact, onExpand, onClose }) {
  const { steps, index, step } = stepAt(prompt);
  const copiedText = plainCopy(step.prompt, prompt.variables || []);
  const canCopy = Boolean(step.promptSaved && copiedText);
  const snippet = (copiedText || 'Prompt vacío').slice(0, 90);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
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
  const [formatOpen, setFormatOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const videoRef = useRef(null);
  const sheetWasOpen = useRef(false);
  const editRoot = useRef(null);
  const editRange = useRef(null);
  const [formatOn, setFormatOn] = useState({});
  const [sheetFace, setSheetFace] = useState(1);
  const showSide = showImage || showVideo || showPdf;
  const chipImage = step.image || coverImage(prompt);
  const promptCount = steps.filter((item) => item.promptSaved).length;
  const pageImageCount = stepHasImage(step) ? 1 : 0;
  const imageHold = useRef(false);
  const homeLogo = PROMPT_MODELS.find((model) => model.id === (step.modelIds || [])[0]) || null;

  function patchStep(patch) {
    onPatch({ stepPatch: { id: step.id, ...patch } });
  }

  useEffect(() => {
    setSheetOpen(false);
    if (index !== 0) onPatch({ stepIndex: 0 });
    setModelOpen(false);
    setFormatOpen(false);
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
    imageHold.current = false;
    setShowImage(false);
    setShowVideo(false);
    setShowPdf(false);
  }, [prompt.id]);

  useEffect(() => {
    setModelOpen(false);
    setFormatOpen(false);
    setCustomModel('');
  }, [step.id]);

  useEffect(() => {
    if (!sheetOpen || imageHold.current) return;
    if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowVideo(false);
      setShowImage(false);
      return;
    }
    if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowPdf(false);
      setShowImage(false);
      return;
    }
    setShowPdf(false);
    setShowVideo(false);
    setShowImage(stepHasImage(step));
    // The PDF stays beside the prompt until the file is closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => {
    if (!prompt.pdf?.name) {
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
          setPdfError('Couldn’t display the PDF.');
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
          setPdfError('Couldn’t open the saved PDF.');
        }
      }
    })();
    return () => { cancel = true; };
  }, [prompt.id, prompt.pdf?.name, prompt.pdf?.url]);

  function takeImage(file, replace = false) {
    if (!sheetOpen) return;
    if (!file || !file.type.startsWith('image/')) return;
    if (!replace && stepHasImage(step)) return;
    const stepId = step.id;
    readImageFile(file, (image) => {
      onPatch({ stepPatch: { id: stepId, image, pdfPage: null, promptSaved: false } });
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
            pdfPage: null,
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
      setVideoError(parsed.error || 'Paste a YouTube, Vimeo, or Instagram link.');
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
      setPdfError('Choose a PDF file.');
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
          setPdfError('Choose the PDF again to read it.');
          return;
        }
        const rendered = await renderPdfPageImages(data);
        images = rendered.images;
        pdfPagesRef.current = images;
        setPdfPages(images);
        setPdfPageCount(rendered.pageCount);
      }
      if (!images.length) {
        setPdfError('Couldn’t display the PDF.');
        return;
      }
      const account = useAuthStore.getState().user;
      let title = step.title || '';
      let description = step.description || '';
      let promptText = step.prompt || '';
      let variables = [...(prompt.variables || [])];
      let found = false;
      for (let index = 0; index < images.length; index += 1) {
        const pass = index === 0 ? 'read' : 'continue';
        const image = await shrinkPdfImage(images[index]);
        let result;
        try {
          for (let attempt = 0; ; attempt += 1) {
            try {
              result = await apiClient(API_ROUTES.promptPdfRead, {
                method: 'POST',
                body: JSON.stringify({
                  pages: [{ index: index + 1, image }],
                  pass,
                  userId: account?.id,
                  userEmail: account?.email,
                }),
              });
              break;
            } catch (error) {
              const message = error instanceof Error ? error.message : '';
              if (!message.includes('429') || attempt >= 3) throw error;
              setPdfError('Groq is busy. Waiting to read this page…');
              await new Promise((resolve) => setTimeout(resolve, retryWaitMs(error, attempt)));
            }
          }
        } catch (error) {
          console.warn('[prompt-desk] pdf read failed', error?.message || error);
          setPdfError(pdfReadError(error));
          return;
        }
        setPdfError('');
        const nextTitle = String(result?.title || '').trim();
        const nextDescription = String(result?.description || '').trim();
        const nextPrompt = String(result?.prompt || '').trim();
        let changed = false;
        if (pass === 'read' && nextTitle) {
          title = nextTitle;
          changed = true;
        }
        if (nextDescription) {
          description = description.trim() && pass !== 'read'
            ? `${description.replace(/\s+$/g, '')}\n\n${nextDescription}`
            : nextDescription;
          changed = true;
        }
        if (nextPrompt) {
          const lifted = liftPromptPlaceholders(nextPrompt, variables);
          variables = lifted.variables;
          promptText = promptText.trim()
            ? `${promptText.replace(/\s+$/g, '')}\n\n${lifted.prompt}`
            : lifted.prompt;
          changed = true;
        }
        if (!changed) continue;
        found = true;
        onPatch({
          variables,
          stepPatch: {
            id: step.id,
            title,
            description,
            prompt: promptText,
            promptSaved: false,
          },
        });
      }
      if (!found) setPdfError('Groq didn’t find text on these pages.');
    } catch (error) {
      console.warn('[prompt-desk] pdf read failed', error?.message || error);
      setPdfError(pdfReadError(error));
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
    onPatch({
      pdf: null,
      steps: steps.map((item) => ({ ...item, pdfPage: null })),
    });
  }

  function placePdfPage() {
    if (!pdfPages.length) return;
    const page = Math.min(pdfPageIndex, pdfPages.length - 1);
    patchStep({
      pdfPage: page,
      image: '',
      imagePath: '',
      promptSaved: false,
    });
  }

  function removePageImage() {
    imageHold.current = false;
    setShowImage(false);
    patchStep({ image: '', imagePath: '', pdfPage: null });
  }

  function hideImage() {
    imageHold.current = false;
    setShowImage(false);
    if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowVideo(false);
    } else if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowPdf(false);
    }
  }

  function revealImage() {
    if (!stepHasImage(step)) return;
    imageHold.current = true;
    setShowImage(true);
    setShowVideo(false);
    setShowPdf(false);
  }

  function openBuiltPrompt() {
    imageHold.current = false;
    setSheetOpen(true);
    if ((prompt.pdf?.name || prompt.video?.embedSrc) && stepHasImage(step)) {
      showIndexMedia();
      return;
    }
    if (stepHasImage(step)) {
      setShowImage(true);
      setShowVideo(false);
      setShowPdf(false);
    }
  }

  function showIndexMedia() {
    imageHold.current = false;
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

  function saveAllPrompts() {
    onPatch({
      steps: steps.map((item) => (
        promptHasText(item.prompt) ? { ...item, promptSaved: true } : item
      )),
    });
  }

  function editStep() {
    patchStep({ promptSaved: false });
  }

  function goHome() {
    setSheetOpen(false);
    setShowImage(false);
    setModelOpen(false);
    setFormatOpen(false);
    showIndexMedia();
  }

  function goBack() {
    if (index <= 0) return;
    imageHold.current = false;
    onPatch({ stepIndex: index - 1 });
  }

  function goForward() {
    imageHold.current = false;
    if (index < steps.length - 1) {
      onPatch({ stepIndex: index + 1 });
      return;
    }
    if (!promptHasText(step.prompt)) return;
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

  function commitBody({ prompt: nextPrompt, variables, keepSaved }) {
    if (keepSaved) {
      patchStep({ prompt: nextPrompt });
      return;
    }
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

  function trackEdit(root) {
    if (!root) return;
    editRoot.current = root;
    const doc = root.ownerDocument;
    const selection = doc.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (root.contains(range.commonAncestorContainer)) editRange.current = range.cloneRange();
    }
    let node = selection?.anchorNode || null;
    if (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    let highlight = false;
    while (node && node !== root) {
      const style = node.getAttribute?.('style') || '';
      if (node.tagName === 'MARK' || /background/i.test(style)) highlight = true;
      node = node.parentElement;
    }
    try {
      setFormatOn({
        bold: doc.queryCommandState('bold'),
        italic: doc.queryCommandState('italic'),
        underline: doc.queryCommandState('underline'),
        strikeThrough: doc.queryCommandState('strikeThrough'),
        highlight,
      });
    } catch {
      setFormatOn({ highlight });
    }
  }

  function applyTextFormat(command) {
    const root = editRoot.current;
    if (!root || root.getAttribute('contenteditable') === 'false') return;
    const doc = root.ownerDocument;
    root.focus();
    const selection = doc.getSelection();
    if (editRange.current) {
      selection.removeAllRanges();
      try {
        selection.addRange(editRange.current);
      } catch {
        /* The stored range belongs to a field that was replaced. */
      }
    }
    toggleTextFormat(root, command);
    root.dispatchEvent(new Event('input', { bubbles: true }));
    trackEdit(root);
  }

  function compress() {
    sheetWasOpen.current = sheetOpen;
    onCompact();
  }

  function expand() {
    if (sheetWasOpen.current) setSheetOpen(true);
    onExpand();
  }

  async function copyPrompt() {
    if (!canCopy) return;
    const ok = await copyRichText(copiedText, richCopy(step.prompt, prompt.variables || []));
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (compact) {
    return (
      <button type="button" className="prompt-chip" onClick={expand} aria-label="Expandir">
        {chipImage ? (
          <img className="prompt-chip__img" src={chipImage} alt="" />
        ) : (
          <span className="prompt-chip__img prompt-chip__img--empty" aria-hidden="true" />
        )}
        <span className="prompt-chip__copy">
          <span className="prompt-chip__name">
            {homeLogo ? <img className="prompt-chip__model" src={homeLogo.src} alt="" /> : (
              <svg className="prompt-chip__model" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="7" />
                <path d="M12 9v3l2 2" />
              </svg>
            )}
            {prompt.name || 'Untitled'}
          </span>
          <span className="prompt-chip__snippet">{snippet}</span>
        </span>
      </button>
    );
  }

  return (
    <>
    {sheetOpen && !parked ? <div className="prompt-focus-scrim" aria-hidden="true" /> : null}
    <section
      hidden={parked}
      className={[
        'prompt-panel',
        showSide ? 'prompt-panel--wide' : '',
      ].filter(Boolean).join(' ')}
      aria-label="Prompt"
      onPaste={(event) => {
        if (!sheetOpen) return;
        const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith('image/'));
        if (!item) return;
        event.preventDefault();
        takeImage(item.getAsFile());
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
            {sheetOpen ? (
            <ModelPicker
              modelIds={step.modelIds}
              open={modelOpen}
              onToggle={() => {
                setModelOpen((open) => !open);
                setFormatOpen(false);
              }}
              onChange={(modelIds) => {
                patchStep({ modelIds: modelIds.slice(0, 1) });
                setCustomModel('');
                setModelOpen(false);
              }}
            />
            ) : null}
            {sheetOpen ? (
              <button
                type="button"
                className={formatOpen ? 'prompt-format__btn is-selected' : 'prompt-format__btn'}
                aria-expanded={formatOpen}
                onClick={() => {
                  setFormatOpen((open) => !open);
                  setModelOpen(false);
                }}
              >
                {PROMPT_FORMATS.find((entry) => entry.id === (step.format || 'text'))?.label || 'Text'}
              </button>
            ) : null}
            {sheetOpen ? (
            <button type="button" className="prompt-models__item prompt-models__item--compact" onClick={compress}>
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M9 4H5v4M4 4l6 6M15 20h4v-4M20 20l-6-6" />
                </svg>
              </span>
              <span>Compress</span>
            </button>
            ) : null}
            {sheetOpen && showImage && stepHasImage(step) ? (
              <button type="button" className="prompt-models__item" onClick={hideImage}>
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.7A3 3 0 0 0 12 16a3 3 0 0 0 2.2-1" />
                    <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 4.2 9.5 7a18 18 0 0 1-2.4 3.4" />
                    <path d="M6.1 6.2C4 7.7 2.6 9.8 2 12c.8 2 4.2 6.5 9.2 7a12 12 0 0 0 4.2-1" />
                  </svg>
                </span>
                <span>Hide</span>
              </button>
            ) : null}
            {sheetOpen && !stepHasImage(step) && !showImage ? (
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
                <span>Add image</span>
              </button>
            ) : null}
            {sheetOpen ? (
              <button type="button" className="prompt-models__item" onClick={goHome}>
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 10.5 12 4l8 6.5V20H4Z" />
                  </svg>
                </span>
                <span>Home</span>
              </button>
            ) : null}
            {sheetOpen ? (
              <button type="button" className="prompt-models__item" onClick={() => setVarsOpen(true)}>
                <span className="prompt-models__glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 7h4M7 12h10M7 17h7" />
                  </svg>
                </span>
                <span>Variables</span>
              </button>
            ) : null}
            {sheetOpen ? <FormatBar active={formatOn} onApply={applyTextFormat} /> : null}
            {sheetOpen && !(showImage && stepHasImage(step)) ? (
              <button
                type="button"
                className={pageImageCount ? 'prompt-models__item is-counted' : 'prompt-models__item is-counted is-empty'}
                onClick={revealImage}
              >
                <span className="prompt-models__glyph" aria-hidden="true">{pageImageCount}</span>
                <span>image</span>
              </button>
            ) : null}
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
                <span>Add PDF</span>
              </button>
            )}
            {sheetOpen ? null : (
            <button type="button" className="prompt-models__item prompt-models__item--compact" onClick={compress}>
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M9 4H5v4M4 4l6 6M15 20h4v-4M20 20l-6-6" />
                </svg>
              </span>
              <span>Compress</span>
            </button>
            )}
            {sheetOpen ? null : (
            <button
              type="button"
              className={promptCount ? 'prompt-models__item is-counted' : 'prompt-models__item is-counted is-empty'}
              onClick={openBuiltPrompt}
            >
              <span className="prompt-models__glyph" aria-hidden="true">{promptCount}</span>
              <span>Prompt</span>
            </button>
            )}
          </div>
          {sheetOpen && modelOpen ? (
            <ModelMenu
              customDraft={customModel}
              onCustomDraft={setCustomModel}
              onChange={(modelIds) => {
                patchStep({ modelIds: modelIds.slice(0, 1) });
                setCustomModel('');
                setModelOpen(false);
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
        {sheetOpen && showImage ? (
          <div className="prompt-panel__stage">
            {step.image ? (
              <div className="prompt-panel__image">
                <img key={step.image} src={step.image} alt="" />
              </div>
            ) : Number.isInteger(step.pdfPage) ? (
              <div className="prompt-panel__image">
                {pdfPages[step.pdfPage] ? (
                  <img key={`pdf-${step.pdfPage}`} src={pdfPages[step.pdfPage]} alt="" />
                ) : (
                  <span>Opening the page…</span>
                )}
              </div>
            ) : (
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
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) => {
                    takeImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            )}
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
                <img className="prompt-panel__video-art" src="/Embed%20code.png" alt="" />
                <input
                  value={videoDraft}
                  placeholder="Paste a YouTube, Vimeo, or Instagram link"
                  aria-label="Video link"
                  onChange={(event) => setVideoDraft(event.target.value)}
                />
                <button type="submit">Embed</button>
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
                    aria-label="Previous PDF page"
                    disabled={pdfPageIndex <= 0}
                    onClick={() => setPdfPageIndex((current) => Math.max(0, current - 1))}
                  >
                    ‹
                  </button>
                  <span>{`${Math.min(pdfPageIndex, pdfPages.length - 1) + 1} / ${pdfPages.length}`}</span>
                  <button
                    type="button"
                    aria-label="Next PDF page"
                    disabled={pdfPageIndex >= pdfPages.length - 1}
                    onClick={() => setPdfPageIndex((current) => Math.min(pdfPages.length - 1, current + 1))}
                  >
                    ›
                  </button>
                </div>
              </>
            ) : pdfStatus === 'loading' ? (
              <p>Opening the PDF…</p>
            ) : (
              <label className="prompt-panel__pdf-pick">
                <img className="prompt-panel__pdf-art" src="/Pdf%20File.svg" alt="" />
                <span className="prompt-panel__pdf-link">{prompt.pdf?.name || 'Choose a PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => takePdf(event.target.files?.[0])}
                />
              </label>
            )}
          </div>
        ) : null}
        {showVideo && prompt.video?.embedSrc ? (
          <div className="prompt-panel__media-foot">
            {prompt.video?.provider !== 'instagram' ? (
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
            <button type="button" className="prompt-panel__remove" onClick={removeVideo}>
              Remove
            </button>
          </div>
        ) : null}
        {showPdf && prompt.pdf?.name ? (
          <div className="prompt-panel__media-foot">
            <p className="prompt-pdf__meta">{prompt.pdf.name}</p>
            <div className="prompt-panel__pdf-actions">
              <button type="button" className="prompt-pdf__remove" onClick={clearPdf}>
                <span aria-hidden="true">×</span>
                Remove
              </button>
              {sheetOpen && pdfPages.length ? (
                <>
                  <button
                    type="button"
                    className="prompt-video__extract"
                    disabled={pdfReading}
                    onClick={() => { void extractPdf(); }}
                  >
                    {pdfReading ? 'Reading…' : 'Extract data'}
                  </button>
                  <button type="button" className="prompt-video__extract" onClick={placePdfPage}>
                    {stepHasImage(step) ? 'Replace' : 'Add as image'}
                  </button>
                </>
              ) : null}
            </div>
            <p className="prompt-pdf__note">Note: PDFs are not saved permanently. Use them as a reference to create or insert your prompts.</p>
            {pdfError ? <p role="alert">{pdfError}</p> : null}
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
            <SheetFaces face={sheetFace} onFace={setSheetFace} />
            {sheetFace === 0 ? (
              <DescriptionField
                className="prompt-sheet__description"
                value={step.description || ''}
                readOnly={Boolean(step.promptSaved)}
                onChange={(description) => patchStep({ description, promptSaved: false })}
                onEditFocus={trackEdit}
              />
            ) : (
            <div className="prompt-drawer">
            <PromptBody
              key={step.id}
              prompt={step.prompt}
              variables={prompt.variables || []}
              placeholder="Create or Insert Prompt"
              readOnly={Boolean(step.promptSaved)}
              onCommit={commitBody}
              className={
                step.format && step.format !== 'text'
                  ? 'prompt-panel__body prompt-panel__body--code'
                  : 'prompt-panel__body'
              }
              spellCheck={!step.format || step.format === 'text'}
              onEditFocus={trackEdit}
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
            )}
          </div>
          ) : (
          <div className="prompt-home">
          <div className="prompt-index">
            <button
              type="button"
              className="prompt-index__fan"
              aria-label="Abrir prompt"
              onClick={openBuiltPrompt}
            >
              {[steps[index - 1] || null, step, steps[index + 1] || null].map((page, place) => {
                const text = page ? plainCopy(page.prompt, prompt.variables || []) : '';
                return (
                  <span
                    key={page?.id || `empty-${place}`}
                    className={place === 1 ? 'prompt-index__card prompt-index__card--front' : 'prompt-index__card'}
                  >
                    {page?.image ? (
                      <img src={page.image} alt="" />
                    ) : text ? (
                      <span className="prompt-index__text">{text}</span>
                    ) : (
                      <img className="prompt-index__default" src={HOME_FRAMES[place]} alt="" />
                    )}
                  </span>
                );
              })}
            </button>
            <div className="prompt-index__side">
              {homeLogo ? (
                <img
                  className="prompt-index__logo"
                  src={homeLogo.src}
                  alt=""
                />
              ) : null}
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
          </div>
          )}
          {sheetOpen ? (
          <div className="prompt-panel__foot">
            <div className="prompt-panel__step-actions">
              {step.promptSaved ? (
                <button type="button" onClick={editStep}>Editar</button>
              ) : stepHasImage(step) ? (
                <label className="prompt-panel__step-file">
                  Editar
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    onChange={(event) => {
                      takeImage(event.target.files?.[0], true);
                      event.target.value = '';
                    }}
                  />
                </label>
              ) : null}
              {stepHasImage(step) ? (
                <button type="button" onClick={removePageImage}>Remover</button>
              ) : null}
              <button type="button" onClick={deleteIndex}>Eliminar</button>
            </div>
          <div className="prompt-steps">
            {steps.some((item) => !item.promptSaved && promptHasText(item.prompt)) ? (
              <button type="button" className="prompt-steps__save" onClick={saveAllPrompts}>
                Guardar
              </button>
            ) : null}
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
              aria-label="Next prompt"
              disabled={index >= steps.length - 1 && !promptHasText(step.prompt)}
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
      <VariableDeck
        open={varsOpen}
        title={prompt.name}
        variables={prompt.variables || []}
        onChange={(variables) => onPatch({ variables })}
        onClose={() => setVarsOpen(false)}
      />
    </section>
    </>
  );
}

async function copyInView(plain, html, view) {
  if (!plain) return false;
  try {
    const Item = view.ClipboardItem;
    if (view.navigator.clipboard?.write && typeof Item !== 'undefined') {
      await view.navigator.clipboard.write([
        new Item({
          'text/plain': new view.Blob([plain], { type: 'text/plain' }),
          'text/html': new view.Blob([html || plain], { type: 'text/html' }),
        }),
      ]);
      return true;
    }
  } catch {
    // The compact window falls back to plain text.
  }
  try {
    await view.navigator.clipboard.writeText(plain);
    return true;
  } catch {
    try {
      const doc = view.document;
      const textarea = doc.createElement('textarea');
      textarea.value = plain;
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
  const plain = plainCopy(step.prompt, prompt.variables || []);
  const canCopy = Boolean(step.promptSaved && plain);
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const floatModelName = (step.modelIds || [])[0] || '';
  const floatModel = PROMPT_MODELS.find((model) => model.id === floatModelName) || null;

  function commitBody({ prompt: nextPrompt, variables, keepSaved }) {
    if (keepSaved) {
      onPatch({ stepPatch: { id: step.id, prompt: nextPrompt } });
      return;
    }
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
    onPatch({ stepPatch: { id: step.id, prompt: nextPrompt, promptSaved: false } });
  }

  function saveAllPrompts() {
    onPatch({
      steps: steps.map((item) => (
        promptHasText(item.prompt) ? { ...item, promptSaved: true } : item
      )),
    });
  }

  function editFloatStep() {
    onPatch({ stepPatch: { id: step.id, promptSaved: false } });
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
    if (!promptHasText(step.prompt)) return;
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
    const ok = await copyInView(plain, richCopy(step.prompt, prompt.variables || []), view);
    if (!ok) return;
    setCopied(true);
    view.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="prompt-float" aria-label="Prompt flotante">
      <div className="prompt-float__sheet">
        <div className="prompt-float__head">
        <span className="prompt-float__model" title={floatModel?.label || floatModelName || 'Select model'}>
          {floatModel ? <img src={floatModel.src} alt="" /> : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 9v3l2 2" />
            </svg>
          )}
        </span>
        <input
          className="prompt-float__step"
          value={stepTitleOf(step, index)}
          placeholder="Title"
          aria-label="Title"
          onChange={(event) => patchStepTitle(event.target.value)}
        />
        <button
          type="button"
          className="prompt-float__instructions"
          onClick={() => setShowInstructions((open) => !open)}
        >
          {showInstructions ? 'See prompt' : 'See instructions'}
        </button>
        </div>
        <div className="prompt-drawer">
          {showInstructions ? (
            <div className="prompt-float__text prompt-float__instructions-body">
              {step.description?.trim()
                ? step.description.replace(/<\/?(?:strong|em|u|s|mark)>/gi, '')
                : 'No instructions yet.'}
            </div>
          ) : (
          <PromptBody
            key={step.id}
            prompt={step.prompt}
            variables={prompt.variables || []}
            placeholder="Create or Insert Prompt"
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
          )}
        </div>
      </div>
      <div className="prompt-steps">
        {steps.some((item) => !item.promptSaved && promptHasText(item.prompt)) ? (
          <button type="button" className="prompt-steps__save" onClick={saveAllPrompts}>
            Guardar
          </button>
        ) : step.promptSaved ? (
          <button type="button" className="prompt-steps__save" onClick={editFloatStep}>
            Editar
          </button>
        ) : null}
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
          aria-label="Next prompt"
          disabled={index >= steps.length - 1 && !promptHasText(step.prompt)}
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
    --surface-base: transparent;
    --text-primary: #1a1a1a;
    background: transparent;
    color: #1a1a1a;
    color-scheme: light;
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
    background: rgba(255, 255, 255, 0.38);
    backdrop-filter: blur(20px) saturate(1.5);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    color: #1a1a1a;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .prompt-float__sheet {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 2px dashed rgba(20, 20, 22, 0.45);
    border-radius: 14px;
    background: #fff;
    overflow: hidden;
  }
  .prompt-float__sheet:focus-within {
    border-color: rgba(20, 20, 22, 0.72);
  }
  .prompt-float__head { position: relative; flex: none; }
  .prompt-float__model {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
  }
  .prompt-float__model img,
  .prompt-float__model svg {
    width: 18px;
    height: 18px;
    display: block;
  }
  .prompt-float__model svg {
    fill: none;
    stroke: #1a1a1a;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .prompt-float__step {
    flex: none;
    width: 100%;
    margin: 0;
    border: 0;
    border-bottom: 1px solid rgba(20, 20, 22, 0.08);
    background: transparent;
    color: #1a1a1a;
    font: inherit;
    font-size: 18px;
    font-weight: 560;
    letter-spacing: -0.02em;
    padding: 14px 132px 12px 42px;
    outline: none;
  }
  .prompt-float__instructions {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 0;
    border-radius: 999px;
    background: #f4f1eb;
    color: #3d3b3b;
    font: inherit;
    font-size: 12px;
    line-height: 1;
    padding: 7px 10px;
    cursor: pointer;
  }
  .prompt-float__instructions-body { white-space: pre-wrap; }
  .prompt-float__step::placeholder { color: rgba(20, 20, 22, 0.38); }
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
    background: #fff;
    color: #111;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.45;
    outline: none;
  }
  .prompt-float__text::placeholder { color: rgba(20, 20, 22, 0.38); }
  .prompt-body__editor[data-empty="true"]::before,
  .prompt-body__editor[data-empty]::before {
    color: rgba(20, 20, 22, 0.38);
  }
  .prompt-float__text {
    scrollbar-width: thin;
    scrollbar-color: rgba(20, 20, 22, 0.28) #fff;
  }
  .prompt-float__text::-webkit-scrollbar { width: 8px; height: 8px; }
  .prompt-float__text::-webkit-scrollbar-track { background: #fff; }
  .prompt-float__text::-webkit-scrollbar-thumb {
    border-radius: 8px;
    background: rgba(20, 20, 22, 0.28);
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
    border: 1px solid rgba(20, 20, 22, 0.16);
    border-radius: 8px;
    background: #fff;
    color: #111;
    font-size: 14px;
    font-weight: 650;
    line-height: 1;
    cursor: pointer;
  }
  .prompt-steps {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 46px;
  }
  .prompt-steps__save {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 36px;
    margin: 0;
    padding: 0 14px;
    border: 1px solid rgba(20, 20, 22, 0.16);
    border-radius: 999px;
    color: #111;
    background: #fff;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .prompt-steps__arrow {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(20, 20, 22, 0.16);
    border-radius: 50%;
    color: #111;
    background: #fff;
    font-weight: 650;
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
    color: #111;
    font-weight: 650;
  }
`;
