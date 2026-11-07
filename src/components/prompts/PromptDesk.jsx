import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { PROMPT_FORMATS } from '../../lib/codeBlockLanguages.js';
import { copyRichText } from '../../lib/copyToClipboard.js';
import {
  currentPromptUserId,
  downloadPromptDocument,
  loadPromptDesk,
  loadPromptStorageTree,
  promptDocumentKind,
  removePromptBrandLogo,
  savePromptDesk,
  uploadPromptCover,
} from '../../lib/promptDeskSync.js';
import { applyPreviewUsageEpoch, clearPreviewDeskUsage, readDeskToolCalls, spendDeskToolCall } from '../../lib/promptDeskUsage.js';
import {
  PROMPT_LIMIT_COPY,
  PROMPT_STORAGE_BYTES,
  TRANSCRIPT_FOLDER_LABEL,
  canAddPromptFile,
  canAddPromptFolder,
  canAddPromptPage,
  creditBalance,
  deskPlan,
  promptLimits,
  promptToolCallsLeft,
} from '../../lib/promptPlanLimits.js';
import { storageTreeFromDesk } from '../../lib/promptStorageTree.js';
import { supabase } from '../../lib/supabaseClient.js';
import { normalizeEmbedSrcForPlayback, parseVideoEmbedInput } from '../../lib/videoEmbed.js';
import { beautifyPastedText, prepareFileHomeText } from '../../lib/promptBeautify.js';
import { fixPromptText } from '../../lib/promptFixText.js';
import { savedPromptCount, stepsMarkedAfterSave } from '../../lib/promptStepSave.js';
import { hasHighlightBackground } from '../../lib/promptInlineMark.js';
import { translateDeskText } from '../../lib/promptTranslate.js';
import { organizePlainLists } from '../../lib/promptTextRepair.js';
import {
  documentVariables,
  liftDocumentPlaceholders,
  liftPromptPlaceholders,
  resetDocumentPlaceholders,
  resolvePrompt,
  stampVariables,
} from '../../lib/promptVariables.js';
import { exportPromptDocumentMarkdown } from '../../lib/exportPromptDocumentMarkdown.js';
import {
  STRUCTURE_MODEL_IDS,
  joinParagraphs,
  joinPdfPageTexts,
  numberTranscriptParagraphs,
  prepareSheetFields,
  previewParagraphs,
  readAssistanceMarkers,
  transcriptHasMarkers,
} from '../../lib/promptStructure.js';
import {
  appendOrganizedSheets,
  blankPromptStep,
  isTranscriptPrompt,
  normalizePromptFile,
  stepsFromOrganizedSheets,
  filePageCaption,
} from '../../lib/promptPages.js';
import {
  blankReference,
  legacyFieldsFromReferences,
  normalizeReferences,
  promptHasReferences,
  withNormalizedReferences,
} from '../../lib/promptReferences.js';
import { cancelProSubscription, fetchAffiliateLink, startProCheckout } from '../../lib/billingApi.js';
import { buildPromoShareMessage, copyReferralShareMessage } from '../../lib/referralShareMessage.js';
import { useKofiOverlay } from '../../lib/useKofiOverlay.js';
import { useStripeCheckoutReturn } from '../../lib/useStripeCheckoutReturn.js';
import { useAuthStore } from '../../stores/authStore.js';
import { usePlanStore } from '../../stores/planStore.js';
import GlassFolder, { MAX_VISIBLE } from './GlassFolder.jsx';
import {
  extractPdfPageTexts,
  fetchPdfBytesFromUrl,
  normalizePdfExtractedText,
  renderPdfPageImages,
} from '../../lib/importPdfText.js';
import { ocrPdfPageImages } from '../../lib/ocrPdfPage.js';
import { apiClient } from '../../api/client.js';
import { API_ROUTES } from '../../api/routes.js';
import { PromptBody, VariableDeck, applyBulletPoint, applyTitleShortcut, caretInBullet, continueBullet, insertSanitizedPaste, paintMarked, readMarked } from './PromptBody.jsx';
import EmbedHtml from './EmbedHtml.jsx';
import StorageDistrict from './StorageDistrict.jsx';
import TeleprompterPage from './TeleprompterPage.jsx';
import './prompt-desk.css';

const pdfFiles = new Map();

const ARTS = ['aurora', 'ember', 'dusk', 'glacier', 'verdant'];

const HOME_FRAMES = [
  '/Portada/left%20frame.png',
  '/Portada/center-frame.png',
  '/Portada/right%20frame.png',
];

const FLOAT_OPEN_SIZE = { width: 400, height: 360 };
const FLOAT_COLLAPSED_WIDTH = 340;

/** Temporary A/B: open-file sheet = left step list + right prompt body. Set false to revert. */
const PROMPT_SPLIT_LAYOUT = true;

function resizeFloatHost(host, width, height) {
  if (!host || typeof host.resizeTo !== 'function') return;
  try {
    host.resizeTo(Math.max(200, Math.round(width)), Math.max(72, Math.round(height)));
  } catch {
    // Some hosts ignore resizeTo; CSS still shrinks the card.
  }
}

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
  return blankPromptStep();
}

function fileDocumentKind(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.md') || name.endsWith('.markdown') || type === 'text/markdown') return 'md';
  if (name.endsWith('.txt') || type === 'text/plain') return 'txt';
  return '';
}

function bytesToText(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new TextDecoder().decode(bytes);
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

async function promptApi(body) {
  const { data: { session } } = await supabase.auth.getSession();
  return apiClient(API_ROUTES.promptPdfRead, {
    method: 'POST',
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
    body: JSON.stringify(body),
  });
}

function activeDeskPlan() {
  const email = useAuthStore.getState().user?.email || '';
  return deskPlan(email, usePlanStore.getState().profile.plan);
}

async function freeToolAllowed() {
  const email = useAuthStore.getState().user?.email || '';
  const profilePlan = usePlanStore.getState().profile.plan;
  const plan = deskPlan(email, profilePlan);
  if (promptToolCallsLeft(0, plan) === Infinity) return { ok: true };
  const userId = useAuthStore.getState().user?.id || await currentPromptUserId();
  const used = await readDeskToolCalls({ userId, email, profilePlan });
  if (used == null) return { ok: false, message: PROMPT_LIMIT_COPY.usage };
  if (promptToolCallsLeft(used, plan) <= 0) return { ok: false, message: PROMPT_LIMIT_COPY.tools };
  return { ok: true };
}

function retryWaitMs(error, attempt) {
  const message = error instanceof Error ? error.message : '';
  const wait = message.match(/try again in ([0-9.]+)s/i);
  if (wait) return Math.min(60000, Math.ceil(Number(wait[1]) * 1000) + 800);
  return [20000, 45000, 60000][attempt] || 60000;
}

function stepHasImage(step) {
  return Boolean(step?.image) || Number.isInteger(step?.pdfPage);
}

function plainCopy(template, variables) {
  return resolvePrompt(template, variables)
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?ul>/gi, '')
    .replace(/<\/?(?:strong|em|u|s|mark|h1)>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function richCopy(template, variables) {
  const resolved = resolvePrompt(template, variables);
  const kept = [];
  const text = resolved.replace(/<\/?(strong|em|u|s|mark|h1|ul|li)>/gi, (tag) => {
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
  return Boolean(String(value || '').replace(/<\/?(?:strong|em|u|s|mark|h1|ul|li)>/gi, '').trim());
}

function stepHasDraft(item) {
  return promptHasText(item?.prompt) || promptHasText(item?.description);
}

function stepHasWork(item) {
  if (!item) return false;
  return stepHasDraft(item)
    || Boolean(String(item.image || '').trim() || String(item.imagePath || '').trim())
    || Number.isInteger(item.pdfPage)
    || Boolean(item.video?.embedSrc)
    || (item.modelIds || []).length > 0
    || Boolean(String(item.recommendedModel || '').trim())
    || Boolean(item.format && item.format !== 'text');
}

const DEFAULT_PROMPT_NAME = 'Title Description';

function promptDisplayName(prompt) {
  const name = String(prompt?.name || '').trim();
  if (!name || name === 'Untitled') return DEFAULT_PROMPT_NAME;
  return name;
}

function promptLevelWork(prompt) {
  const name = String(prompt?.name || '').trim();
  const named = Boolean(name) && name !== 'Untitled' && name !== DEFAULT_PROMPT_NAME;
  const hasVars = documentVariables(prompt).some((variable) => (
    String(variable?.name || '').trim() || String(variable?.value || '').trim()
  ));
  const hasMedia = Boolean(
    prompt?.video?.embedSrc
    || prompt?.pdf?.name
    || promptHasReferences(prompt)
  );
  return named || hasVars || hasMedia;
}

function promptNeedsSave(prompt, currentStep) {
  const steps = prompt?.steps || [];
  if (steps.some((item) => !item.promptSaved && stepHasWork(item))) return true;
  return Boolean(currentStep && !currentStep.promptSaved && promptLevelWork(prompt));
}

function markStepUnsaved(stepId, patch = {}) {
  const stepPatch = patch.stepPatch
    ? { ...patch.stepPatch, promptSaved: false }
    : { id: stepId, promptSaved: false };
  return { ...patch, stepPatch };
}

function stepsAfterSave(prompt) {
  return stepsMarkedAfterSave(prompt?.steps, stepHasWork);
}

const FORMAT_TOOLS = [
  { id: 'bold', label: 'Bold', command: 'bold' },
  { id: 'italic', label: 'Italic', command: 'italic' },
  { id: 'underline', label: 'Underline', command: 'underline' },
  { id: 'strike', label: 'Strikethrough', command: 'strikeThrough' },
  { id: 'highlight', label: 'Highlight', command: 'highlight' },
  { id: 'bullet', label: 'Bullet point', command: 'bullet' },
];

function FormatIcon({ name }) {
  const paths = {
    bold: 'M7 5h6.2a3.4 3.4 0 0 1 0 6.8H7zM7 11.8h7.2a3.6 3.6 0 0 1 0 7.2H7z',
    italic: 'M14 5h6M8 19h6M15 5 11 19',
    underline: 'M7 4.5v7a5 5 0 0 0 10 0v-7M6 19.5h12',
    strike: 'M5 12h14M8.2 7.2c.6-1.4 2-2.2 3.8-2.2 2.4 0 3.8 1.2 3.8 2.8 0 .7-.3 1.3-.8 1.8M8.4 16.8c.7 1.1 2 1.8 3.8 1.8 2.3 0 3.8-1.1 3.8-2.8',
    highlight: 'M5 16.5 9.2 6l3.2 1.8L8.2 18.3zM14 8.2l3.6-1.6 2.2 3.2-3.6 1.6zM6 20h12',
    bullet: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
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
  if (kind === 'highlight') return tag === 'MARK' || hasHighlightBackground(style);
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

function FormatBar({ active, onApply, disabled = false }) {
  return (
    <div className={disabled ? 'prompt-formatbar is-locked' : 'prompt-formatbar'} role="toolbar" aria-label="Text format">
      {FORMAT_TOOLS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active?.[item.command] ? 'prompt-formatbar__btn is-active' : 'prompt-formatbar__btn'}
          aria-label={item.label}
          aria-pressed={Boolean(active?.[item.command])}
          title={item.label}
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            if (disabled) return;
            onApply(item.command);
          }}
        >
          <FormatIcon name={item.id} />
        </button>
      ))}
    </div>
  );
}

function PdfPager({ index, count, onPrev, onNext }) {
  if (!count) return null;
  const page = Math.min(index, count - 1) + 1;
  return (
    <div className="prompt-pdf__pager">
      <button type="button" aria-label="Previous PDF page" disabled={index <= 0} onClick={onPrev}>‹</button>
      <span>{`${page} / ${count}`}</span>
      <button type="button" aria-label="Next PDF page" disabled={index >= count - 1} onClick={onNext}>›</button>
    </div>
  );
}

function DescriptionField({
  className,
  value,
  readOnly,
  onChange,
  onEditFocus,
  onUrlPaste,
  label = "Brief description",
  placeholder = "Brief description of the steps to follow",
}) {
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
      aria-label={label}
      data-placeholder={placeholder}
      spellCheck
      suppressContentEditableWarning
      onInput={() => {
        const next = readMarked(ref.current);
        local.current = next;
        if (ref.current.textContent.trim()) delete ref.current.dataset.empty;
        else ref.current.dataset.empty = 'true';
        onChange(next);
      }}
      onFocus={() => {
        onEditFocus?.(ref.current);
        const node = ref.current;
        if (!node || node.textContent.trim()) return;
        const doc = node.ownerDocument;
        const selection = doc.getSelection();
        if (!selection) return;
        const range = doc.createRange();
        range.setStart(node, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }}
      onMouseUp={() => onEditFocus?.(ref.current)}
      onPaste={(event) => {
        if (readOnly) return;
        if (!insertSanitizedPaste(event, ref.current, onUrlPaste)) return;
        const next = readMarked(ref.current);
        local.current = next;
        if (ref.current.textContent.trim()) delete ref.current.dataset.empty;
        else ref.current.dataset.empty = 'true';
        onChange(next);
      }}
      onKeyDown={(event) => {
        if (readOnly) return;
        if (event.key !== 'Enter' || event.shiftKey) return;
        if (continueBullet(ref.current)) {
          event.preventDefault();
          const next = readMarked(ref.current);
          local.current = next;
          if (ref.current.textContent.trim()) delete ref.current.dataset.empty;
          else ref.current.dataset.empty = 'true';
          onChange(next);
          return;
        }
        if (!applyTitleShortcut(ref.current)) return;
        event.preventDefault();
        const next = readMarked(ref.current);
        local.current = next;
        if (ref.current.textContent.trim()) delete ref.current.dataset.empty;
        else ref.current.dataset.empty = 'true';
        onChange(next);
      }}
      onKeyUp={() => onEditFocus?.(ref.current)}
    />
  );
}

function TranslateControl({ busy, note, onTarget }) {
  return (
    <span className="prompt-translate">
      <label className="prompt-models__item prompt-translate__pick">
        <span className="prompt-models__glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 6h8M9 6c0 6-2 9-5 11" />
            <path d="M7 11h4" />
            <path d="M14 18l3-8 3 8" />
            <path d="M15.2 15.5h3.6" />
          </svg>
        </span>
        <select
          aria-label="Translate"
          value=""
          disabled={busy}
          onChange={(event) => {
            const lang = event.target.value;
            if (lang) onTarget(lang);
          }}
        >
          <option value="">{busy ? 'Translating…' : 'Translate'}</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
        </select>
      </label>
      {note ? <span className="prompt-translate__note" role="status">{note}</span> : null}
    </span>
  );
}

function PromptTitleField({ className, value, onChange, titleRef, placeholder = 'Prompt title', readOnly = false }) {
  return (
    <textarea
      ref={titleRef}
      className={className}
      value={value}
      placeholder={placeholder}
      aria-label="Title"
      rows={1}
      readOnly={readOnly}
      onChange={(event) => {
        if (readOnly) return;
        onChange(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
    />
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
  return withNormalizedReferences({
    id: uid(),
    name: '',
    meta: 'Prompt',
    modelId: '',
    variables: [],
    stepIndex: 0,
    pdf: null,
    video: null,
    referenceUrl: '',
    referenceName: '',
    references: [],
    cover: '',
    coverPath: '',
    coverSkipped: false,
    assets: [],
    steps: [blankPromptStep()],
  });
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

function isTranscriptFolder(folder) {
  return folder?.label === TRANSCRIPT_FOLDER_LABEL;
}

function blankTranscriptFolder(index) {
  return {
    id: uid(),
    label: TRANSCRIPT_FOLDER_LABEL,
    art: ARTS[index % ARTS.length],
    tone: index % 2 === 1 ? 'dark' : 'light',
    seed: index * 7 + 11,
    prompts: [],
  };
}

function ensureTranscriptFolder(folders) {
  const list = folders || [];
  if (list.some(isTranscriptFolder)) return list;
  return [...list, blankTranscriptFolder(list.length)];
}

function blankTranscript() {
  return {
    ...blankPrompt(),
    name: 'Untitled transcript',
    meta: 'Transcript',
  };
}

function transcriptTitle(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '').trim();
  return base || 'Untitled transcript';
}

function coverImage(prompt) {
  return prompt.cover || '';
}

function stepAt(prompt) {
  const steps = prompt.steps?.length
    ? prompt.steps
    : [isTranscriptPrompt(prompt) ? blankStep() : blankPromptStep()];
  const index = Math.min(Math.max(prompt.stepIndex || 0, 0), steps.length - 1);
  return { steps, index, step: steps[index] };
}

function fileTitle(prompt) {
  return promptDisplayName(prompt);
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

const PDF_VIEW_MIN_ZOOM = 1;
const PDF_VIEW_MAX_ZOOM = 6;

function clampPdfZoom(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return PDF_VIEW_MIN_ZOOM;
  return Math.min(PDF_VIEW_MAX_ZOOM, Math.max(PDF_VIEW_MIN_ZOOM, next));
}

/**
 * Display size: page width = viewport × zoom, height from aspect (not capped to viewport).
 * Tall pages overflow → side/vertical scroll like the original preview.
 */
function pdfStageLayout(viewport, natural, zoom) {
  const vw = Math.max(1, Number(viewport?.w) || 400);
  const vh = Math.max(1, Number(viewport?.h) || 300);
  const nw = Math.max(1, Number(natural?.w) || 1);
  const nh = Math.max(1, Number(natural?.h) || 1);
  const z = clampPdfZoom(zoom);
  const width = Math.max(1, vw * z);
  const scale = width / nw;
  return {
    fitScale: vw / nw,
    scale,
    width,
    height: Math.max(1, nh * scale),
    vw,
    vh,
    nw,
    nh,
  };
}

const DESK_VIEWS = [
  { id: 'home', label: 'Prompt Library', to: '/app' },
  { id: 'teleprompter', label: 'Teleprompter', to: '/app/teleprompter' },
  { id: 'embed', label: 'Embed Prompt', to: '/app/embed' },
  { id: 'settings', label: 'Settings', to: '/app/settings/storage' },
];

const SETTINGS_PANES = [
  { id: 'storage', label: 'Storage', to: '/app/settings/storage' },
  { id: 'billing', label: 'Payments & Billings', to: '/app/settings/billing' },
];

function settingsPaneFromPath(pathname) {
  if (!pathname.startsWith('/app/settings')) return null;
  if (pathname.startsWith('/app/settings/billing')) return 'billing';
  return 'storage';
}

/** /app/settings/storage/list/files/:fileId · /list/folders/:folderId · /list */
function storageFocusFromPath(pathname) {
  if (!pathname.startsWith('/app/settings/storage')) {
    return { view: null, fileId: null, folderId: null };
  }
  const rest = pathname.slice('/app/settings/storage'.length).replace(/^\//, '');
  const parts = rest ? rest.split('/').filter(Boolean) : [];
  let view = null;
  let fileId = null;
  let folderId = null;
  if (parts[0] === 'list' || parts[0] === 'district') {
    view = parts[0];
    if (parts[1] === 'files' && parts[2]) fileId = decodeURIComponent(parts[2]);
    if (parts[1] === 'folders' && parts[2]) folderId = decodeURIComponent(parts[2]);
  }
  return { view, fileId, folderId };
}

function storageFileHref(fileId) {
  return `/app/settings/storage/list/files/${encodeURIComponent(fileId)}`;
}

function viewFromPath(pathname) {
  if (pathname.startsWith('/app/settings')) return 'settings';
  if (pathname.startsWith('/app/embed')) return 'embed';
  if (pathname.startsWith('/app/transcribe')) return 'transcribe';
  if (pathname.startsWith('/app/teleprompter')) return 'teleprompter';
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
  if (name === 'transcribe') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    );
  }
  if (name === 'teleprompter') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 12h8M8 15h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4Z" />
    </svg>
  );
}

function firstHttpUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return '';
  return match[0].replace(/[.,;:!?)]+$/g, '');
}

function DeskSidebar({ view, settingsPane }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const profilePlan = usePlanStore((state) => state.profile.plan);
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(view === 'settings');
  const email = user?.email || '';
  const initial = (email[0] || 'F').toUpperCase();
  const isPro = deskPlan(email, profilePlan) === 'pro';

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

  useEffect(() => {
    if (view === 'settings') setSettingsOpen(true);
  }, [view]);

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    // Paint beige auth canvas before unmount so /app → /login does not flash dark.
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.style.background = '#f4f1eb';
    document.body.style.backgroundImage = 'none';
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
          item.id === 'settings' ? (
            <div key={item.id} className="prompt-desk__side-group">
              <button
                type="button"
                className={view === item.id ? 'prompt-desk__side-link is-current' : 'prompt-desk__side-link'}
                aria-expanded={settingsOpen}
                aria-current={view === item.id ? 'page' : undefined}
                title={item.label}
                onClick={() => {
                  if (!open) {
                    navigate(item.to);
                    return;
                  }
                  const next = !settingsOpen;
                  setSettingsOpen(next);
                  if (next && view !== 'settings') navigate(item.to);
                }}
              >
                <SideIcon name={item.id} />
                <span>{item.label}</span>
              </button>
              {settingsOpen && open ? (
                <div className="prompt-desk__side-picker" role="group" aria-label="Settings section">
                  {SETTINGS_PANES.map((pane) => (
                    <button
                      key={pane.id}
                      type="button"
                      className={settingsPane === pane.id ? 'prompt-desk__side-sublink is-current' : 'prompt-desk__side-sublink'}
                      aria-current={settingsPane === pane.id ? 'page' : undefined}
                      onClick={() => navigate(pane.to)}
                    >
                      {pane.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div key={item.id}>
              <button
                type="button"
                className={view === item.id ? 'prompt-desk__side-link is-current' : 'prompt-desk__side-link'}
                aria-current={view === item.id ? 'page' : undefined}
                title={item.label}
                onClick={() => navigate(item.to)}
              >
                <SideIcon name={item.id} />
                <span>{item.label}</span>
              </button>
            </div>
          )
        ))}
      </nav>
      <div className="prompt-desk__account">
        <span className="prompt-desk__avatar" aria-hidden="true">{initial}</span>
        <span className="prompt-desk__account-copy">
          {email ? <span className="prompt-desk__email">{email}</span> : null}
          <span className="prompt-desk__account-row">
            <button
              type="button"
              className="prompt-desk__signout"
              onClick={() => { void handleSignOut(); }}
              disabled={loggingOut}
            >
              {loggingOut ? t('common.signingOut') : t('common.signOut')}
            </button>
            <span
              className={isPro ? 'prompt-desk__plan-chip is-pro' : 'prompt-desk__plan-chip'}
              title={isPro ? 'Pro' : 'Free'}
            >
              {isPro ? 'Pro' : 'Free'}
            </span>
          </span>
        </span>
      </div>
    </aside>
  );
}

const PRO_BILLING_FEATURE_KEYS = [
  'deskBilling.featureLibrary',
  'deskBilling.featureEmbed',
  'deskBilling.featureTeleprompt',
  'deskBilling.featureStorage',
  'deskBilling.featureAi',
  'deskBilling.featureUrlVars',
  'deskBilling.featureCopy',
  'deskBilling.featureSales',
];

function BillingCheckIcon() {
  return (
    <svg className="prompt-billing__check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6.5 10.2 8.8 12.5 13.5 7.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BillingSettings() {
  const { t } = useI18n();
  const profile = usePlanStore((state) => state.profile);
  const fetchProfile = usePlanStore((state) => state.fetchProfile);
  const pro = profile.plan === 'pro';
  const canCancel = pro && Boolean(profile.stripeSubscriptionId);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [note, setNote] = useState('');
  const [promoUrl, setPromoUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const shareMessage = useMemo(
    () => buildPromoShareMessage(promoUrl, t),
    [promoUrl, t],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAffiliateLink()
      .then((data) => {
        if (!cancelled) setPromoUrl(data?.url || '');
      })
      .catch(() => {
        if (!cancelled) setPromoUrl('');
      });
    return () => { cancelled = true; };
  }, []);

  const upgrade = async () => {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const { url } = await startProCheckout('monthly', { cancelReturn: 'app' });
      if (!url) throw new Error('Stripe checkout URL missing');
      window.location.assign(url);
    } catch (error) {
      setNote(error instanceof Error ? error.message : t('deskBilling.checkoutFailed'));
      setBusy(false);
    }
  };

  const cancelPlan = async () => {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      await cancelProSubscription();
      await fetchProfile();
      setConfirmCancel(false);
      setNote(t('deskBilling.canceled'));
    } catch (error) {
      setNote(error instanceof Error ? error.message : t('deskBilling.cancelFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copyPromo = async () => {
    if (!shareMessage) return;
    try {
      await copyReferralShareMessage(shareMessage, promoUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="prompt-desk__page prompt-billing">
      <header className="prompt-desk__bar">
        <p className="prompt-desk__mark">{t('deskBilling.title')}</p>
      </header>
      <div className="prompt-billing__sheet">
        <section className="prompt-billing__card" aria-labelledby="prompt-billing-plan">
          <p className="prompt-billing__kicker">{pro ? t('deskBilling.pro') : t('deskBilling.free')}</p>
          <h2 id="prompt-billing-plan" className="prompt-billing__plan">{t('deskBilling.planName')}</h2>
          <p className="prompt-billing__price">
            $10.99<span>{t('deskBilling.priceSuffix')}</span>
          </p>
          <p className="prompt-billing__note">{t('deskBilling.desc')}</p>
          <ul className="prompt-billing__list" role="list">
            {PRO_BILLING_FEATURE_KEYS.map((key) => (
              <li key={key} className="prompt-billing__list-item">
                <BillingCheckIcon />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          {note ? <p className="prompt-billing__status" role="status">{note}</p> : null}
          {pro && !canCancel ? (
            <p className="prompt-billing__note">{t('deskBilling.managedNote')}</p>
          ) : null}
          {pro ? (
            canCancel ? (
              confirmCancel ? (
                <div className="prompt-billing__actions">
                  <button type="button" className="prompt-billing__cancel" onClick={cancelPlan} disabled={busy}>
                    {busy ? t('deskBilling.processing') : t('deskBilling.confirmCancel')}
                  </button>
                  <button
                    type="button"
                    className="prompt-desk__new"
                    onClick={() => setConfirmCancel(false)}
                    disabled={busy}
                  >
                    {t('deskBilling.keepPro')}
                  </button>
                </div>
              ) : (
                <button type="button" className="prompt-billing__ghost" onClick={() => setConfirmCancel(true)}>
                  {t('deskBilling.cancelPlan')}
                </button>
              )
            ) : null
          ) : (
            <button type="button" className="prompt-billing__cta" onClick={upgrade} disabled={busy}>
              {busy ? t('deskBilling.openingCheckout') : t('deskBilling.upgrade')}
            </button>
          )}
        </section>

        <section className="prompt-billing__promo" aria-labelledby="prompt-billing-promo">
          <h2 id="prompt-billing-promo" className="prompt-billing__promo-title">{t('deskBilling.promoTitle')}</h2>
          <p className="prompt-billing__promo-hint">{t('deskBilling.promoHint')}</p>
          <label className="prompt-billing__promo-label" htmlFor="prompt-billing-promo-text">
            {t('deskBilling.promoLabel')}
          </label>
          <textarea
            id="prompt-billing-promo-text"
            className="prompt-billing__promo-text scroll-match-bg"
            rows={8}
            readOnly
            value={shareMessage}
            placeholder={t('deskBilling.promoPlaceholder')}
          />
          <button
            type="button"
            className="prompt-billing__cta"
            onClick={() => { void copyPromo(); }}
            disabled={!shareMessage}
          >
            {copied ? t('deskBilling.promoCopied') : t('deskBilling.promoCopy')}
          </button>
        </section>
      </div>
    </div>
  );
}

function StorageSettings({ folders, focusView, focusFileId, focusFolderId, onDeleteFile }) {
  const navigate = useNavigate();
  const [bytesById, setBytesById] = useState({});
  const [brandBytes, setBrandBytes] = useState(0);
  const [note, setNote] = useState('');
  const [deleteAsk, setDeleteAsk] = useState(null);
  const root = useMemo(() => {
    const tree = storageTreeFromDesk(folders || []);
    const children = brandBytes > 0
      ? [...tree.children, { id: 'embed-brand', name: 'Branding', kind: 'file', bytes: brandBytes }]
      : tree.children;
    const next = { ...tree, children };
    if (!Object.keys(bytesById).length) return next;
    const paint = (node) => {
      if (node.kind === 'file') {
        const bytes = bytesById[node.id];
        return bytes != null ? { ...node, bytes } : node;
      }
      return { ...node, children: (node.children || []).map(paint) };
    };
    return paint(next);
  }, [folders, bytesById, brandBytes]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const userId = await currentPromptUserId();
      if (!userId) return;
      try {
        const tree = await loadPromptStorageTree(userId);
        if (cancel) return;
        const next = {};
        const walk = (node) => {
          if (node.kind === 'file' && node.id) next[node.id] = node.bytes;
          (node.children || []).forEach(walk);
        };
        walk(tree);
        const brand = (tree.children || []).find((child) => child.id === 'embed-brand');
        setBrandBytes(brand ? Number(brand.bytes) || 0 : 0);
        setBytesById(next);
      } catch (error) {
        console.warn('[prompt-desk] storage load failed', error?.message || error);
        if (!cancel) setNote('No pude leer el storage.');
      }
    })();
    return () => { cancel = true; };
  }, []);

  function handleDelete(node) {
    if (!node || node.kind !== 'file') return;
    if (node.id === 'embed-brand') {
      setDeleteAsk({ kind: 'brand', label: 'Branding' });
      return;
    }
    if (!onDeleteFile) return;
    const folder = (folders || []).find((entry) => (
      (entry.prompts || []).some((prompt) => prompt.id === node.id)
    ));
    if (!folder) return;
    setDeleteAsk({
      kind: 'file',
      label: node.name || 'este archivo',
      folderId: folder.id,
      fileId: node.id,
    });
  }

  function confirmDeleteAsk() {
    const ask = deleteAsk;
    setDeleteAsk(null);
    if (!ask) return;
    if (ask.kind === 'brand') {
      (async () => {
        try {
          const userId = await currentPromptUserId();
          if (!userId) return;
          await removePromptBrandLogo(userId);
          setBrandBytes(0);
          setBytesById((prev) => {
            const next = { ...prev };
            delete next['embed-brand'];
            return next;
          });
        } catch (error) {
          setNote(error?.message || 'No pude borrar el branding.');
        }
      })();
      return;
    }
    if (ask.kind === 'file' && ask.folderId && ask.fileId) {
      onDeleteFile(ask.folderId, ask.fileId);
      navigate('/app/settings/storage/list', { replace: true });
    }
  }

  return (
    <div className="prompt-desk__storage">
      {note ? <p className="prompt-desk__limit" role="status">{note}</p> : null}
      <StorageDistrict
        root={root}
        capacityBytes={PROMPT_STORAGE_BYTES}
        title="Storage"
        defaultView={focusView || 'district'}
        focusFileId={focusFileId}
        focusFolderId={focusFolderId}
        onDelete={handleDelete}
      />
      {deleteAsk ? createPortal(
        <div className="prompt-home-save-layer">
          <div className="prompt-home-save" role="dialog" aria-label="Confirmar eliminar">
            <p>{`¿Eliminar “${deleteAsk.label}”?`}</p>
            <div>
              <button type="button" className="prompt-home-save__danger" onClick={confirmDeleteAsk}>
                Eliminar
              </button>
              <button type="button" onClick={() => setDeleteAsk(null)}>Cancelar</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function TranscribePage({ prompts, onCreate, onSave, onDelete }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = prompts.find((item) => item.id === selectedId) || null;
  const savedStep = selected ? stepAt(selected).step : null;
  const savedText = savedStep?.promptSaved ? (savedStep.prompt || '') : '';
  const savedTitle = selected?.name || 'Untitled transcript';
  const [title, setTitle] = useState(savedTitle);
  const [text, setText] = useState(savedText);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (selectedId && !prompts.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [prompts, selectedId]);

  useEffect(() => {
    setTitle(selected?.name || 'Untitled transcript');
    const step = selected ? stepAt(selected).step : null;
    setText(step?.promptSaved ? (step.prompt || '') : '');
    setReading(false);
    setSaving(false);
    setCopied(false);
    setError('');
    setNote('');
  }, [selectedId]);

  const dirty = text !== savedText || (selected ? title.trim() !== savedTitle : Boolean(text.trim()));

  async function readFile(file) {
    if (!file || reading) return;
    const kind = fileDocumentKind(file);
    if (!kind) {
      setError('Choose a PDF, Markdown, or text file.');
      return;
    }
    setReading(true);
    setError('');
    setNote('');
    try {
      const data = await file.arrayBuffer();
      let next = '';
      if (kind !== 'pdf') {
        next = normalizePdfExtractedText(bytesToText(data));
      } else {
        const rendered = await renderPdfPageImages(data);
        const extracted = await extractPdfPageTexts(data, { maxPages: rendered.images.length });
        const texts = rendered.images.map((_, index) => extracted.pages[index] || '');
        const missing = texts
          .map((page, index) => (page ? -1 : index))
          .filter((index) => index >= 0);
        if (missing.length) {
          const recognized = await ocrPdfPageImages(missing.map((index) => rendered.images[index]));
          missing.forEach((pageIndex, index) => {
            texts[pageIndex] = normalizePdfExtractedText(recognized[index] || '');
          });
        }
        next = joinPdfPageTexts(texts.map((page) => normalizePdfExtractedText(page)));
      }
      if (!next) {
        setError('Couldn’t find text in this file.');
        return;
      }
      setText(next);
      if (!title.trim() || title === 'Untitled transcript') setTitle(transcriptTitle(file.name));
    } catch (readError) {
      setError(pdfReadError(readError));
    } finally {
      setReading(false);
    }
  }

  async function copyText() {
    const value = text.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  function startNew() {
    setSelectedId(null);
    setTitle('Untitled transcript');
    setText('');
    setError('');
    setNote('');
    setCopied(false);
  }

  async function saveTranscript() {
    const value = text.trim();
    const nextTitle = title.trim() || transcriptTitle('');
    if (!value || saving) return;
    setText(value);
    setTitle(nextTitle);
    setSaving(true);
    setError('');
    setNote('');
    try {
      if (selected && savedStep) {
        await onSave(selected.id, {
          name: nextTitle,
          steps: [{
            ...savedStep,
            prompt: value,
            description: '',
            promptSaved: true,
            format: 'text',
            sheetFace: 1,
          }],
        });
        setNote('Saved');
        return;
      }
      const id = await onCreate({ name: nextTitle, text: value });
      if (!id) return;
      setSelectedId(id);
      setNote('Saved');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Couldn’t save the transcript.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="prompt-transcribe" aria-label="Transcribe File">
      <aside className="prompt-transcribe__list">
        <button type="button" className="prompt-transcribe__new" onClick={startNew}>
          New transcript
        </button>
        <div className="prompt-transcribe__saved scroll-match-bg">
          {prompts.length ? prompts.map((item) => (
            <div key={item.id} className={item.id === selectedId ? 'prompt-transcribe__row is-current' : 'prompt-transcribe__row'}>
              <button type="button" onClick={() => setSelectedId(item.id)}>
                {item.name || 'Untitled transcript'}
              </button>
              <button type="button" aria-label={`Delete ${item.name || 'transcript'}`} onClick={() => onDelete(item.id)}>
                ×
              </button>
            </div>
          )) : (
            <p className="prompt-transcript__status">No transcripts yet.</p>
          )}
        </div>
      </aside>
      <div className="prompt-transcribe__reader">
      <div className="prompt-transcript">
        <textarea
          className="prompt-panel__name"
          value={title}
          placeholder="Title"
          aria-label="Title"
          rows={1}
          onChange={(event) => {
            setTitle(event.target.value);
            setNote('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
        />
        {!text && !reading ? (
          <label className="prompt-transcript__pick">
            <img src="/Pdf%20File.svg" alt="" />
            <span>Choose a file</span>
            <input
              type="file"
              accept="application/pdf,.pdf,.md,.markdown,text/plain,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void readFile(file);
              }}
            />
          </label>
        ) : null}
        {reading ? <p className="prompt-transcript__status">Reading the file…</p> : null}
        {error ? <p className="prompt-transcript__status" role="alert">{error}</p> : null}
        {text ? (
          <textarea
            className="prompt-transcript__text scroll-match-bg"
            value={text}
            aria-label="Transcript"
            spellCheck
            onChange={(event) => {
              setText(event.target.value);
              setNote('');
            }}
          />
        ) : null}
        <div className="prompt-transcript__actions">
          {text ? (
            <button type="button" onClick={() => { void copyText(); }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          ) : null}
          {text ? (
            <button type="button" disabled={saving || !dirty || !text.trim()} onClick={() => { void saveTranscript(); }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
          {text && !reading ? (
            <label className="prompt-transcript__replace">
              <span>Replace file</span>
              <input
                type="file"
                accept="application/pdf,.pdf,.md,.markdown,text/plain,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void readFile(file);
                }}
              />
            </label>
          ) : null}
          {note ? <span className="prompt-transcript__note" role="status">{note}</span> : null}
        </div>
      </div>
      </div>
    </section>
  );
}

function FolderCard({ folder, appearDelay, searchOpen, highlightQuery, onAdd, onOpenPrompt, onRename, canAdd = true }) {
  const [opened, setOpened] = useState(false);
  const sheets = useMemo(
    () => sheetsOf(folder.prompts, searchOpen ? highlightQuery : ''),
    [folder.prompts, searchOpen, highlightQuery],
  );
  return (
    <div className={searchOpen ? 'prompt-desk__folder prompt-desk__folder--hit' : 'prompt-desk__folder'}>
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
        addDisabled={!canAdd}
        onAdd={() => {
          const prompt = blankPrompt();
          const id = onAdd(folder.id, prompt);
          if (!id) return null;
          return { name: prompt.name, meta: prompt.meta, promptId: id };
        }}
        onFileSelect={(file, index) => {
          const promptId = file?.promptId || folder.prompts[index]?.id;
          if (promptId) onOpenPrompt(folder.id, promptId);
        }}
      />
    </div>
  );
}

function saveMode(patch, beforePrompt) {
  if (!patch) return 'debounce';
  if ('stepIndex' in patch || 'modelId' in patch || 'name' in patch || 'pdf' in patch || 'video' in patch || 'assets' in patch || 'referenceUrl' in patch || 'referenceName' in patch || 'references' in patch || 'coverPath' in patch || 'coverSkipped' in patch) return 'now';
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
        || prev.recommendedModel !== step.recommendedModel
        || JSON.stringify(prev.modelIds || []) !== JSON.stringify(step.modelIds || [])
        || JSON.stringify(prev.video) !== JSON.stringify(step.video)
        || JSON.stringify(prev.pdf || null) !== JSON.stringify(step.pdf || null);
    });
    if (structural) return 'now';
    const committedText = patch.steps.some((step) => {
      const prev = (beforePrompt.steps || []).find((item) => item.id === step.id);
      if (!step.promptSaved) return false;
      if (!prev) return true;
      return prev.prompt !== step.prompt
        || prev.description !== step.description
        || prev.promptSaved !== step.promptSaved;
    });
    if (committedText) return 'now';
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
  return 'skip';
}

function CreditGlass({ credits, ready, empty }) {
  const shown = ready ? credits : '—';
  return (
    <div
      className={empty ? 'prompt-credits is-empty' : 'prompt-credits'}
      role="status"
      aria-label={ready ? `${credits} créditos` : 'Créditos'}
    >
      <span className="prompt-credits__coin" aria-hidden="true">
        <img src="/PLANT%20TOKEN.png" alt="" />
      </span>
      <span className="prompt-credits__copy">
        <strong>{shown}</strong>
        <small>créditos</small>
      </span>
    </div>
  );
}

export default function PromptDesk() {
  const location = useLocation();
  const view = viewFromPath(location.pathname);
  // Support me (Ko-fi): free zones only — Home + Embed Prompt.
  useKofiOverlay(view === 'home' || view === 'embed');
  const settingsPane = settingsPaneFromPath(location.pathname);
  const storageFocus = storageFocusFromPath(location.pathname);
  const navigate = useNavigate();
  useStripeCheckoutReturn();

  useEffect(() => {
    document.body.classList.add('prompt-desk-body');
    document.body.style.background = '#f4f1eb';
    document.body.style.backgroundImage = 'none';
    return () => {
      document.body.classList.remove('prompt-desk-body');
      document.body.style.background = '';
      document.body.style.backgroundImage = '';
    };
  }, []);

  const [folders, setFolders] = useState(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [limitNote, setLimitNote] = useState('');
  const [active, setActive] = useState(null);
  const [compact, setCompact] = useState(false);
  const [floating, setFloating] = useState(false);
  const [toolCalls, setToolCalls] = useState(0);
  const [clicksReady, setClicksReady] = useState(false);
  const toolCallsRef = useRef(0);
  const spendLock = useRef(false);
  const email = useAuthStore((state) => state.user?.email || '');
  const profilePlan = usePlanStore((state) => state.profile.plan);
  const plan = deskPlan(email, profilePlan);
  const clicksLeft = promptToolCallsLeft(toolCalls, plan);
  const credits = creditBalance(clicksLeft, plan);
  const floatRef = useRef(null);
  const foldersRef = useRef([]);
  const savedRef = useRef([]);
  const userIdRef = useRef(null);
  const saveTimerRef = useRef(0);
  const savingRef = useRef(null);
  const queuedRef = useRef(null);
  const committedRef = useRef({ steps: {}, files: {} });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reset-desk') === '1') {
      clearPreviewDeskUsage(email || undefined);
      toolCallsRef.current = 0;
      setToolCalls(0);
      params.delete('reset-desk');
      const search = params.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
    } else {
      applyPreviewUsageEpoch(email || undefined);
    }
    let cancel = false;
    (async () => {
      const userId = useAuthStore.getState().user?.id || await currentPromptUserId();
      const used = await readDeskToolCalls({
        userId,
        email: useAuthStore.getState().user?.email || '',
        profilePlan: usePlanStore.getState().profile.plan,
      });
      if (cancel || used == null) {
        if (!cancel) setClicksReady(true);
        return;
      }
      toolCallsRef.current = used;
      setToolCalls(used);
      setClicksReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [email, profilePlan, location.pathname, location.search, navigate]);

  async function spendClick() {
    const account = {
      userId: userIdRef.current || useAuthStore.getState().user?.id || '',
      email: useAuthStore.getState().user?.email || '',
      profilePlan: usePlanStore.getState().profile.plan,
    };
    const currentPlan = deskPlan(account.email, account.profilePlan);
    if (promptToolCallsLeft(toolCallsRef.current, currentPlan) <= 0) return false;
    if (spendLock.current) return false;
    spendLock.current = true;
    try {
      const result = await spendDeskToolCall(account);
      if (!result.ok) {
        const spent = Number(result.toolCalls);
        if (Number.isFinite(spent)) {
          toolCallsRef.current = spent;
          setToolCalls(spent);
        }
        return false;
      }
      if (!result.unlimited) {
        const spent = Number(result.toolCalls);
        const next = Number.isFinite(spent) ? spent : toolCallsRef.current + 1;
        toolCallsRef.current = next;
        setToolCalls(next);
      }
      return true;
    } finally {
      spendLock.current = false;
    }
  }

  const activePrompt = useMemo(() => {
    if (!active || !folders) return null;
    const folder = folders.find((item) => item.id === active.folderId);
    const prompt = folder?.prompts.find((item) => item.id === active.promptId);
    if (!folder || !prompt) return null;
    return { folder, prompt };
  }, [folders, active]);

  function seedCommitted(folders) {
    const steps = {};
    const files = {};
    (folders || []).forEach((folder) => {
      (folder.prompts || []).forEach((prompt) => {
        files[prompt.id] = {
          name: prompt.name || '',
          variables: documentVariables(prompt),
          references: normalizeReferences(prompt),
          ...legacyFieldsFromReferences(normalizeReferences(prompt)),
        };
        (prompt.steps || []).forEach((step) => {
          steps[step.id] = {
            prompt: step.promptSaved ? (step.prompt || '') : '',
            description: step.promptSaved ? (step.description || '') : '',
          };
        });
      });
    });
    committedRef.current = { steps, files };
  }

  function rememberSaved(folders) {
    const committed = committedRef.current || { steps: {}, files: {} };
    (folders || []).forEach((folder) => {
      (folder.prompts || []).forEach((prompt) => {
        let dirty = false;
        (prompt.steps || []).forEach((step) => {
          const saved = committed.steps[step.id] || { prompt: '', description: '' };
          if (step.promptSaved) {
            committed.steps[step.id] = {
              prompt: step.prompt || '',
              description: step.description || '',
            };
            return;
          }
          if ((step.prompt || '') !== saved.prompt || (step.description || '') !== saved.description) dirty = true;
        });
        if (!dirty) {
          committed.files[prompt.id] = {
            name: prompt.name || '',
            variables: documentVariables(prompt),
            references: normalizeReferences(prompt),
            ...legacyFieldsFromReferences(normalizeReferences(prompt)),
          };
        }
      });
    });
    committedRef.current = committed;
  }

  function foldersForStorage(folders) {
    const committed = committedRef.current;
    if (!committed) return folders;
    return (folders || []).map((folder) => ({
      ...folder,
      prompts: (folder.prompts || []).map((prompt) => {
        const file = committed.files[prompt.id];
        let revertFile = false;
        const steps = (prompt.steps || []).map((step) => {
          const saved = committed.steps[step.id] || { prompt: '', description: '' };
          const draftPrompt = step.prompt || '';
          const draftDescription = step.description || '';
          if (!step.promptSaved && (draftPrompt !== saved.prompt || draftDescription !== saved.description)) {
            revertFile = true;
            return { ...step, prompt: saved.prompt, description: saved.description };
          }
          return step;
        });
        if (!revertFile || !file) return { ...prompt, steps };
        const references = normalizeReferences(file);
        return withNormalizedReferences({
          ...prompt,
          name: file.name,
          variables: documentVariables({ id: prompt.id, variables: file.variables }),
          references,
          steps,
        });
      }),
    }));
  }

  function queueSave(next, mode) {
    if (mode === 'skip') return Promise.resolve();
    rememberSaved(next);
    queuedRef.current = foldersForStorage(next);
    window.clearTimeout(saveTimerRef.current);
    if (mode === 'now') return flushSave();
    saveTimerRef.current = window.setTimeout(() => { void flushSave(); }, 350);
    return Promise.resolve();
  }

  async function flushSave() {
    window.clearTimeout(saveTimerRef.current);
    const userId = userIdRef.current;
    if (!userId || !queuedRef.current) return;
    if (savingRef.current) {
      await savingRef.current;
      return flushSave();
    }
    const snapshot = queuedRef.current;
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
    return queueSave(next, mode);
  }

  function addCollection() {
    const plan = activeDeskPlan();
    if (!canAddPromptFolder(foldersRef.current, plan)) {
      setLimitNote(PROMPT_LIMIT_COPY.folder);
      return;
    }
    setLimitNote('');
    updateFolders((prev) => [...prev, blankFolder(prev.length)], 'now');
  }

  function addPrompt(folderId, prompt) {
    const plan = activeDeskPlan();
    if (!canAddPromptFile(foldersRef.current, plan, folderId)) {
      setLimitNote(PROMPT_LIMIT_COPY.file);
      return null;
    }
    setLimitNote('');
    const created = { ...prompt, variables: [] };
    updateFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: [...folder.prompts, created] }
        : folder
    )), 'now');
    return created.id;
  }

  function patchPrompt(patch, mode) {
    if (!active) return;
    const before = (foldersRef.current || [])
      .find((folder) => folder.id === active.folderId)
      ?.prompts.find((prompt) => prompt.id === active.promptId);
    return updateFolders((prev) => prev.map((folder) => {
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
    }), mode || saveMode(patch, before));
  }

  function closePanel() {
    const folder = (foldersRef.current || []).find((item) => item.id === active?.folderId);
    const prompt = folder?.prompts.find((item) => item.id === active?.promptId);
    const savedFile = Boolean(prompt?.pdf?.path);
    if (!savedFile && (prompt?.pdf || (prompt?.steps || []).some((step) => step.pdfPage != null))) {
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
      const pipWindow = await api.requestWindow({
        width: FLOAT_OPEN_SIZE.width,
        height: FLOAT_OPEN_SIZE.height,
      });
      const doc = pipWindow.document;
      doc.title = '';
      const style = doc.createElement('style');
      style.id = 'prompt-float-css';
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

  function patchFolderPrompt(folderId, promptId, patch, mode) {
    const before = (foldersRef.current || [])
      .find((folder) => folder.id === folderId)
      ?.prompts.find((prompt) => prompt.id === promptId);
    return updateFolders((prev) => prev.map((folder) => {
      if (folder.id !== folderId) return folder;
      return {
        ...folder,
        prompts: folder.prompts.map((prompt) => (
          prompt.id === promptId ? { ...prompt, ...patch } : prompt
        )),
      };
    }), mode || saveMode(patch, before));
  }

  function createTranscript({ name, text }) {
    setLimitNote('');
    const created = blankTranscript();
    created.name = name;
    created.steps = [{
      ...blankPromptStep(),
      prompt: text,
      description: '',
      promptSaved: true,
      format: 'text',
    }];
    updateFolders((prev) => prev.map((folder) => (
      isTranscriptFolder(folder)
        ? { ...folder, prompts: [...folder.prompts, created] }
        : folder
    )), 'now');
    return created.id;
  }

  function saveTranscriptItem(promptId, patch) {
    const folder = (foldersRef.current || []).find(isTranscriptFolder);
    if (!folder) return null;
    return patchFolderPrompt(folder.id, promptId, { ...patch, meta: 'Transcript' }, 'now');
  }

  function deleteTranscript(promptId) {
    const folder = (foldersRef.current || []).find(isTranscriptFolder);
    if (!folder) return;
    deletePrompt(folder.id, promptId);
  }

  function renameFolder(folderId, label) {
    const current = (foldersRef.current || []).find((folder) => folder.id === folderId);
    if (isTranscriptFolder(current)) return;
    updateFolders((prev) => prev.map((folder) => (
      folder.id === folderId ? { ...folder, label } : folder
    )));
  }

  function deleteFolder(folderId) {
    const current = (foldersRef.current || []).find((folder) => folder.id === folderId);
    if (isTranscriptFolder(current)) return;
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
        const base = loaded.length ? loaded : [blankFolder(0)];
        const next = ensureTranscriptFolder(base);
        foldersRef.current = next;
        savedRef.current = loaded;
        seedCommitted(next);
        setFolders(next);
        if (next !== base) void queueSave(next, 'now');
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
        key={activePrompt.prompt.id}
        prompt={activePrompt.prompt}
        view={slot.window}
        hostWindow={slot.window}
        onPatch={patchPrompt}
      />
    );
  });

  const shownFolders = useMemo(() => {
    const list = (folders || []).filter((folder) => !isTranscriptFolder(folder));
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

  const folderLimitReached = Boolean(folders) && !canAddPromptFolder(folders, plan);

  useEffect(() => {
    if (!submitted.trim()) return;
    document.querySelector('.prompt-desk__folder--hit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [submitted, shownFolders]);

  return (
    <div className="prompt-desk">
      <div className="prompt-desk__dots" aria-hidden="true" />
      <DeskSidebar
        view={view}
        settingsPane={settingsPane}
      />
      <div className="prompt-desk__main">
      {view === 'home' ? (
        <CreditGlass
          credits={credits}
          ready={clicksReady}
          empty={Number.isFinite(clicksLeft) && clicksLeft <= 0}
        />
      ) : null}
      {view === 'settings' && settingsPane === 'billing' ? <BillingSettings /> : null}
      {view === 'settings' && settingsPane !== 'billing' ? (
        <StorageSettings
          folders={folders || []}
          focusView={storageFocus.view}
          focusFileId={storageFocus.fileId}
          focusFolderId={storageFocus.folderId}
          onDeleteFile={deletePrompt}
        />
      ) : null}
      {view === 'embed' ? <EmbedHtml plan={plan} email={email} profilePlan={profilePlan} /> : null}
      {view === 'teleprompter' ? (
        <TeleprompterPage
          folders={(folders || []).filter((folder) => !isTranscriptFolder(folder))}
        />
      ) : null}
      {view === 'transcribe' ? (
        <>
          {limitNote ? <p className="prompt-desk__limit" role="status">{limitNote}</p> : null}
          <TranscribePage
            prompts={(folders || []).find(isTranscriptFolder)?.prompts || []}
            onCreate={createTranscript}
            onSave={saveTranscriptItem}
            onDelete={deleteTranscript}
          />
        </>
      ) : null}
      {view === 'home' ? (
      <>
      <header className="prompt-desk__bar">
        <img src="/navbar.svg" alt="Futura Nota" className="prompt-desk__logo" />
        <span className={folderLimitReached ? 'prompt-desk__new-wrap prompt-desk__new-wrap--tip' : 'prompt-desk__new-wrap'}>
          <button
            type="button"
            className="prompt-desk__new"
            onClick={addCollection}
            disabled={!folders || folderLimitReached}
            aria-label={folderLimitReached ? 'Free plan folder limit reached' : 'New Collection'}
            aria-describedby={folderLimitReached ? 'prompt-desk-new-tip' : undefined}
          >
            New Collection
          </button>
          {folderLimitReached ? (
            <span className="prompt-desk__new-tip" id="prompt-desk-new-tip" role="tooltip">
              <strong>Free Plan Limitations:</strong>
              Unlock to Pro for Unlimited Folders & Files
            </span>
          ) : null}
        </span>
      </header>
      {limitNote ? <p className="prompt-desk__limit" role="status">{limitNote}</p> : null}
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
            canAdd={canAddPromptFile(folders, plan, folder.id)}
            onOpenPrompt={(folderId, promptId) => {
              setActive({ folderId, promptId });
              setCompact(false);
            }}
          />
        ))}
      </div>
      </>
      ) : null}

      {view === 'home' && activePrompt ? (
        <InstructionPanel
          key={activePrompt.prompt.id}
          prompt={activePrompt.prompt}
          compact={compact}
          parked={floating}
          plan={plan}
          clicksLeft={clicksLeft}
          onSpendClick={spendClick}
          onPatch={patchPrompt}
          onCompact={() => { void openFloat(); }}
          onExpand={() => setCompact(false)}
          onClose={closePanel}
          onOpenStorage={() => navigate(storageFileHref(activePrompt.prompt.id))}
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
  readOnly = false,
}) {
  const ids = Array.isArray(modelIds) ? modelIds : [];
  const chosen = ids.length > 0;
  return (
    <div className="prompt-model">
      {ids.map((id) => {
        const known = PROMPT_MODELS.find((model) => model.id === id);
        const label = known?.label || id;
        const face = (
          <>
            {known ? <img src={known.src} alt="" /> : (
              <span className="prompt-models__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="7" />
                </svg>
              </span>
            )}
            <span>{label}</span>
          </>
        );
        if (readOnly) {
          return (
            <span key={id} className="prompt-models__item is-selected is-readonly">
              {face}
            </span>
          );
        }
        return (
          <button
            key={id}
            type="button"
            className="prompt-models__item is-selected"
            aria-label={`Quitar ${label}`}
            onClick={() => onChange(ids.filter((item) => item !== id))}
          >
            {face}
          </button>
        );
      })}
      {chosen || readOnly ? null : (
        <button type="button" className="prompt-models__item prompt-models__item--tip" aria-expanded={open} onClick={onToggle}>
          <span className="prompt-models__glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 9v3l2 2" />
            </svg>
          </span>
          <span>Plataforma objetivo</span>
          <span className="prompt-models__tip" role="tooltip">
            Indica a qué plataforma vas a pegar este prompt (ChatGPT, Claude, Gemini…) o definí un destino custom.
          </span>
        </button>
      )}
    </div>
  );
}

function ModelMenu({ customDraft, onCustomDraft, onChange }) {
  return (
    <div className="prompt-drop prompt-model__menu" role="listbox" aria-label="Plataforma objetivo">
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

function InstructionPanel({
  prompt,
  compact,
  parked,
  plan,
  clicksLeft,
  onSpendClick,
  onPatch,
  onCompact,
  onExpand,
  onClose,
  onOpenStorage,
}) {
  const { steps, index, step } = stepAt(prompt);
  const ownedVariables = useMemo(() => documentVariables(prompt), [prompt]);
  const copiedText = plainCopy(step.prompt, ownedVariables);
  const canCopy = Boolean(step.promptSaved && copiedText);
  const snippet = (copiedText || 'Prompt vacío').slice(0, 90);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfFolded, setPdfFolded] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [limitNote, setLimitNote] = useState('');
  const [pdfReading, setPdfReading] = useState(false);
  const [pdfImproving, setPdfImproving] = useState(false);
  const [pdfPasted, setPdfPasted] = useState(false);
  const [urlOffer, setUrlOffer] = useState('');
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDrafting, setUrlDrafting] = useState(true);
  const [urlName, setUrlName] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [urlEditing, setUrlEditing] = useState(false);
  const [editingRefId, setEditingRefId] = useState('');
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState('');
  const urlFieldRef = useRef(null);
  const fileReferences = useMemo(() => normalizeReferences(prompt), [prompt]);
  const [pdfPages, setPdfPages] = useState([]);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [pdfPick, setPdfPick] = useState([]);
  const [pdfStatus, setPdfStatus] = useState('idle');
  const [pdfScan, setPdfScan] = useState('');
  const [keptTranscript, setKeptTranscript] = useState('');
  const [pdfScanReading, setPdfScanReading] = useState(false);
  const [organizeAsk, setOrganizeAsk] = useState(null);
  const [organizeLater, setOrganizeLater] = useState(false);
  const [organizeError, setOrganizeError] = useState('');
  const [organizePreview, setOrganizePreview] = useState(null);
  const organizeMap = useRef(new Map());
  const organizeSheets = useRef([]);
  const organizeMode = useRef('replace');
  const [pdfPlain, setPdfPlain] = useState('');
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfNatural, setPdfNatural] = useState({ w: 0, h: 0 });
  const [pdfViewportSize, setPdfViewportSize] = useState({ w: 0, h: 0 });
  const [pdfViewTouched, setPdfViewTouched] = useState(false);
  const [pdfPanning, setPdfPanning] = useState(false);
  const pdfPagesRef = useRef([]);
  const pdfLoadedName = useRef('');
  const pdfSheetRef = useRef(null);
  const pdfViewportRef = useRef(null);
  const pdfPanDrag = useRef(null);
  const textPanelKept = useRef(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoError, setVideoError] = useState('');
  const [homeSaveAsk, setHomeSaveAsk] = useState(false);
  const [coverAsk, setCoverAsk] = useState(false);
  const coverPickRef = useRef(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [recommendedOpen, setRecommendedOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const sheetWasOpen = useRef(false);
  const editRoot = useRef(null);
  const editRange = useRef(null);
  const [formatOn, setFormatOn] = useState({});
  const [translateTarget, setTranslateTarget] = useState('es');
  const [translateBusy, setTranslateBusy] = useState(false);
  const [translateNote, setTranslateNote] = useState('');

  useEffect(() => {
    if (!urlOpen) return;
    setUrlDrafting(true);
    setUrlName('');
    setUrlDraft('');
    setUrlEditing(false);
    setEditingRefId('');
  }, [urlOpen]);

  const rightText = String(keptTranscript || pdfScan || '').trim();
  // Plain-text-beside / home transcript panel retired: PDF stays fixed while editing prompts.
  const textBesidePrompt = false;
  const showPdfPreview = showPdf && !pdfFolded;
  const pdfTranscriptWide = false;
  // Image upload + Assets panel retired — side only for video / PDF preview.
  const showSide = showVideo || showPdfPreview;
  const chipImage = coverImage(prompt);
  const cover = coverImage(prompt);
  const needCoverChoice = !cover && !prompt.coverSkipped;
  const promptCount = savedPromptCount(steps, (item) => (
    promptHasText(item?.prompt)
    || Boolean(String(item?.image || '').trim() || String(item?.imagePath || '').trim())
    || Number.isInteger(item?.pdfPage)
  ));
  const imageHold = useRef(false);
  const sideHold = useRef(false);
  const savedStepsRef = useRef({});
  const savedPromptRef = useRef(null);
  const openedStepIds = useRef(new Set());
  const openedFor = useRef(null);
  if (openedFor.current !== prompt.id) {
    openedFor.current = prompt.id;
    openedStepIds.current = new Set(steps.map((item) => item.id));
  }
  const sheetModelName = (step.modelIds || [])[0] || '';
  const homeLogo = PROMPT_MODELS.find((model) => model.id === sheetModelName) || null;
  const sheetPlatformLabel = homeLogo?.label || sheetModelName || '';
  const sheetRecommended = String(step.recommendedModel || '').trim();
  const pdfPickCount = pdfPick.filter(Boolean).length;

  function patchStep(patch) {
    onPatch({ stepPatch: { id: step.id, ...patch } });
  }

  async function copyHref(href, refId = '') {
    const text = String(href || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setUrlCopied(true);
      setCopiedRefId(refId);
      window.setTimeout(() => {
        setUrlCopied(false);
        setCopiedRefId('');
      }, 1200);
    } catch {
      setUrlCopied(false);
      setCopiedRefId('');
    }
  }

  useEffect(() => {
    // Always land on the 3-card home; user opens the writing sheet from there.
    setSheetOpen(false);
    if (index !== 0) onPatch({ stepIndex: 0 });
    setModelOpen(false);
    setRecommendedOpen(false);
    setFormatOpen(false);
    setCustomModel('');
    setVideoDraft(prompt.video?.rawInput || '');
    setVideoError('');
    setPdfError('');
    setPdfPasted(false);
    setUrlOffer('');
    setUrlOpen(false);
    setUrlName('');
    setUrlDraft('');
    setUrlEditing(false);
    setEditName('');
    setEditUrl('');
    setUrlCopied(false);
    setPdfPages([]);
    setPdfPageCount(0);
    setPdfPageIndex(0);
    setPdfStatus('idle');
    setPdfScan('');
    setKeptTranscript('');
    setPdfScanReading(false);
    setPdfFolded(false);
    setPdfPlain('');
    pdfPagesRef.current = [];
    pdfLoadedName.current = '';
    textPanelKept.current = false;
    imageHold.current = false;
    sideHold.current = false;
    setShowVideo(false);
    setShowPdf(false);
    setHomeSaveAsk(false);
    savedPromptRef.current = null;
    savedStepsRef.current = {};
    if (!isTranscriptPrompt(prompt)) {
      const next = normalizePromptFile(prompt);
      const prev = prompt.steps || [];
      const changed = next.steps.length !== prev.length
        || next.steps.some((item, itemIndex) => item.id !== prev[itemIndex]?.id);
      if (changed) {
        onPatch({ steps: next.steps, stepIndex: next.stepIndex });
      }
    }
  }, [prompt.id]);

  useEffect(() => {
    const next = { ...savedStepsRef.current };
    for (const item of steps) {
      if (!item.promptSaved) continue;
      next[item.id] = {
        prompt: item.prompt || '',
        description: item.description || '',
        title: item.title || '',
      };
    }
    savedStepsRef.current = next;
    if (!promptNeedsSave(prompt, step)) {
      const references = normalizeReferences(prompt);
      savedPromptRef.current = {
        name: prompt.name || '',
        variables: ownedVariables.map((item) => ({ ...item })),
        references,
        ...legacyFieldsFromReferences(references),
      };
    }
  }, [steps, prompt, step]);

  useEffect(() => {
    setModelOpen(false);
    setRecommendedOpen(false);
    setFormatOpen(false);
    setCustomModel('');
  }, [step.id]);

  useEffect(() => {
    if (step.promptSaved) setFormatOpen(false);
  }, [step.promptSaved]);

  useEffect(() => {
    // New prompt page: release image hold so a kept PDF can show again.
    imageHold.current = false;
    if (!sheetOpen || sideHold.current) return;
    if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowVideo(false);
      return;
    }
    if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowPdf(false);
      return;
    }
    setShowPdf(false);
    setShowVideo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => {
    if (!prompt.pdf?.name) {
      setPdfPages([]);
      setPdfPageCount(0);
      setPdfPageIndex(0);
      pdfPagesRef.current = [];
      setPdfStatus('idle');
      if (!textPanelKept.current) setPdfScan('');
      setPdfScanReading(false);
      setPdfPlain('');
      pdfLoadedName.current = '';
      return undefined;
    }
    let cancel = false;
    const fileId = prompt.id;
    const url = prompt.pdf?.url || '';
    const name = prompt.pdf.name;
    setPdfStatus('loading');
    setPdfPageIndex(0);
    setPdfScanReading(false);
    setPdfPlain('');
    if (pdfLoadedName.current !== name) {
      pdfLoadedName.current = name;
      if (textPanelKept.current) {
        setPdfFolded(true);
      } else {
        setPdfScan('');
        setPdfFolded(false);
      }
    }
    const kind = prompt.pdf?.kind || promptDocumentKind(name);
    const storedPath = prompt.pdf?.path || '';
    (async () => {
      try {
        const local = pdfFiles.get(fileId);
        let data = null;
        const keepFile = (buffer) => {
          const bytes = new Uint8Array(buffer);
          const fileType = kind === 'md' ? 'text/markdown' : kind === 'txt' ? 'text/plain' : 'application/pdf';
          pdfFiles.set(fileId, new File([bytes], name, { type: fileType }));
          return bytes.slice();
        };
        if (local) {
          data = await local.arrayBuffer();
        } else if (storedPath) {
          const buffer = await downloadPromptDocument(storedPath);
          data = keepFile(buffer);
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
          data = keepFile(await response.arrayBuffer());
        }
        if (cancel) return;
        if (!data) {
          setPdfStatus('missing');
          setPdfScanReading(false);
          return;
        }
        if (kind !== 'pdf') {
          if (cancel) return;
          pdfPagesRef.current = [];
          setPdfPages([]);
          setPdfPageCount(0);
          setPdfPlain(bytesToText(data));
          setPdfStatus('ready');
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
          setPdfScanReading(false);
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
          setPdfScanReading(false);
          setPdfError('Couldn’t open the saved PDF.');
        }
      }
    })();
    return () => { cancel = true; };
  }, [prompt.id, prompt.pdf?.name, prompt.pdf?.path, prompt.pdf?.url]);

  useEffect(() => {
    setPdfPick((current) => (
      current.length === pdfPages.length
        ? current
        : pdfPages.map((_, index) => current[index] === true)
    ));
  }, [pdfPages.length]);

  useEffect(() => {
    setPdfZoom(1);
    setPdfViewTouched(false);
    setPdfNatural({ w: 0, h: 0 });
    const node = pdfViewportRef.current;
    if (node) {
      node.scrollLeft = 0;
      node.scrollTop = 0;
    }
  }, [pdfPageIndex]);

  useLayoutEffect(() => {
    const node = pdfViewportRef.current;
    if (!node) return undefined;
    const sync = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      setPdfViewportSize((prev) => (
        prev.w === w && prev.h === h ? prev : { w, h }
      ));
    };
    sync();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(sync)
      : null;
    observer?.observe(node);

    const onWheel = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      setPdfZoom((current) => clampPdfZoom(current * factor));
      setPdfViewTouched(true);
    };
    const onScroll = () => {
      if (node.scrollLeft > 0 || node.scrollTop > 0) {
        setPdfViewTouched(true);
      }
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      pdfPanDrag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: node.scrollLeft,
        top: node.scrollTop,
        moved: false,
      };
      setPdfPanning(true);
    };
    const onPointerMove = (event) => {
      const drag = pdfPanDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        drag.moved = true;
        setPdfViewTouched(true);
      }
      node.scrollLeft = drag.left - dx;
      node.scrollTop = drag.top - dy;
    };
    const endPan = (event) => {
      const drag = pdfPanDrag.current;
      if (!drag || (event && drag.pointerId !== event.pointerId)) return;
      pdfPanDrag.current = null;
      setPdfPanning(false);
      try {
        node.releasePointerCapture(drag.pointerId);
      } catch {
        // already released
      }
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('scroll', onScroll, { passive: true });
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endPan);
    node.addEventListener('pointercancel', endPan);
    return () => {
      observer?.disconnect();
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endPan);
      node.removeEventListener('pointercancel', endPan);
    };
  }, [showPdfPreview, pdfPages.length, pdfPageIndex]);

  function notePdfNatural(node) {
    if (!node) return;
    const w = node.naturalWidth || 0;
    const h = node.naturalHeight || 0;
    if (!w || !h) return;
    setPdfNatural((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }

  function takeCover(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setCoverAsk(false);
    readImageFile(file, (cover) => {
      onPatch({ cover, coverSkipped: false });
    });
    currentPromptUserId()
      .then((userId) => {
        if (!userId) return null;
        return uploadPromptCover(file, prompt.id, userId, prompt.coverPath);
      })
      .then((uploaded) => {
        if (!uploaded) return;
        onPatch({ cover: uploaded.url, coverPath: uploaded.path, coverSkipped: false });
      })
      .catch((error) => {
        console.warn('[prompt-desk] cover upload failed', error?.message || error);
        setLimitNote(error instanceof Error ? error.message : PROMPT_LIMIT_COPY.storage);
      });
  }

  function skipCover() {
    setCoverAsk(false);
    onPatch({ cover: '', coverPath: '', coverSkipped: true });
  }

  function removeCover(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    skipCover();
  }

  function askCover() {
    setCoverAsk(true);
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

  function removeVideo() {
    setVideoDraft('');
    setVideoError('');
    sideHold.current = false;
    setShowVideo(true);
    setShowPdf(false);
    onPatch({ video: null });
  }

  function takePdf(file) {
    if (!file) return;
    const kind = fileDocumentKind(file);
    if (!kind) {
      setPdfError('Choose a PDF, Markdown, or text file.');
      return;
    }
    const fileId = prompt.id;
    pdfFiles.set(fileId, file);
    setPdfError('');
    setPdfPasted(false);
    setPdfPlain('');
    setShowPdf(true);
    setShowVideo(false);
    // PDF only — hide the writing sheet / text panel on the right until Extract.
    setSheetOpen(false);
    onPatch({ pdf: { name: file.name, path: '', url: '', kind } });
  }

  async function pdfBytes() {
    const local = pdfFiles.get(prompt.id);
    if (local) return local.arrayBuffer();
    if (prompt.pdf?.url) return fetchPdfBytesFromUrl(prompt.pdf.url);
    return null;
  }

  async function ensurePdfImages() {
    let images = pdfPagesRef.current;
    if (images.length) return images;
    const data = await pdfBytes();
    if (!data) return null;
    const rendered = await renderPdfPageImages(data);
    images = rendered.images;
    pdfPagesRef.current = images;
    setPdfPages(images);
    setPdfPageCount(rendered.pageCount);
    return images;
  }

  function mergeExtractIntoPrompt(existing, incoming) {
    const prev = String(existing || '').trim();
    const next = String(incoming || '').trim();
    if (!next) return prev;
    if (!prev) return next;
    return `${prev}\n\n${next}`;
  }

  function deliverExtract(text) {
    const cleaned = organizePlainLists(String(text || '').trim());
    if (!cleaned) return;
    setPdfScan(cleaned);
    setPdfFolded(false);
    setShowPdf(true);
    setShowVideo(false);
    setSheetOpen(true);
    setOrganizeAsk(null);
    setOrganizePreview(null);
    setOrganizeError('');

    const nextPrompt = mergeExtractIntoPrompt(step.prompt, cleaned);
    patchStep({ prompt: nextPrompt, promptSaved: false });
  }

  function dismissOrganize() {
    setOrganizeAsk(null);
    setOrganizePreview(null);
    setOrganizeError('');
    setOrganizeLater(true);
  }

  const toolsLocked = Number.isFinite(clicksLeft) && clicksLeft <= 0;

  async function takeClick() {
    if (toolsLocked) return false;
    if (!onSpendClick) return true;
    return onSpendClick();
  }

  async function beginOrganize() {
    const node = pdfSheetRef.current?.querySelector('.prompt-pdf-sheet__page');
    const live = node ? readMarked(node) : '';
    const text = String(live || keptTranscript || pdfScan || '').trim();
    if (!text) {
      setOrganizeError('Extract the PDF and fix the text first.');
      setOrganizeAsk('error');
      return;
    }
    const allowed = await freeToolAllowed();
    if (!allowed.ok) {
      setOrganizeError(allowed.message);
      setOrganizeAsk('error');
      return;
    }
    if (!(await takeClick())) return;
    setOrganizeError('');
    setOrganizePreview(null);
    setOrganizeAsk('busy');
    const { numbered, map, ids } = numberTranscriptParagraphs(text);
    if (!ids.length) {
      setOrganizeError('No encontré párrafos para organizar.');
      setOrganizeAsk('error');
      return;
    }
    try {
      const account = useAuthStore.getState().user;
      let result;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await promptApi({
            pass: 'structure',
            text: numbered,
            ids,
            allowedModels: STRUCTURE_MODEL_IDS,
            userId: account?.id,
            userEmail: account?.email,
          });
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('429') || attempt >= 3) throw error;
          setOrganizeError('Groq is busy. Waiting to organize…');
          await new Promise((resolve) => setTimeout(resolve, retryWaitMs(error, attempt)));
        }
      }
      if (!result?.ok || !Array.isArray(result.sheets) || !result.sheets.length) {
        setOrganizeError('No pude organizarlo automáticamente');
        setOrganizeAsk('error');
        return;
      }
      organizeMap.current = map;
      organizeSheets.current = result.sheets;
      organizeMode.current = steps.some(stepHasDraft) ? 'append' : 'replace';
      setOrganizePreview(result.sheets.map((sheet, index) => ({
        model: sheet.model,
        label: sheet.prompt_title || `Prompt ${index + 1}`,
        snippet: previewParagraphs(
          sheet.prompt?.length ? sheet.prompt : sheet.instruction,
          map,
        ),
      })));
      setOrganizeAsk('preview');
    } catch (error) {
      console.warn('[prompt-desk] auto organize failed', error?.message || error);
      setOrganizeError(pdfReadError(error));
      setOrganizeAsk('error');
    }
  }

  function prepareHomeFile() {
    const node = pdfSheetRef.current?.querySelector('.prompt-pdf-sheet__page');
    const live = node ? readMarked(node) : '';
    const next = prepareFileHomeText(live || keptTranscript || pdfScan);
    textPanelKept.current = Boolean(String(next || '').trim());
    setPdfScan(next);
    setKeptTranscript(next);
  }

  const canTranslateText = Boolean(rightText);
  const canTranslatePrompt = Boolean(
    String(step.description || '').trim() || String(step.prompt || '').trim(),
  );
  const showTextTranslate = !sheetOpen && canTranslateText;
  const showPromptTranslate = sheetOpen && (canTranslatePrompt || textBesidePrompt);

  async function runTranslate(target = translateTarget) {
    const nextTarget = target === 'en' ? 'en' : 'es';
    setTranslateTarget(nextTarget);
    if (translateBusy) return;
    const includeText = (!sheetOpen && canTranslateText) || (sheetOpen && textBesidePrompt);
    const includePrompt = sheetOpen && canTranslatePrompt;
    if (!includeText && !includePrompt) return;
    setTranslateBusy(true);
    setTranslateNote('');
    try {
      if (includeText) {
        const node = pdfSheetRef.current?.querySelector('.prompt-pdf-sheet__page');
        const live = node ? readMarked(node) : '';
        const next = await translateDeskText(live || keptTranscript || pdfScan, nextTarget);
        textPanelKept.current = Boolean(String(next || '').trim());
        setPdfScan(next);
        setKeptTranscript(next);
      }
      if (includePrompt) {
        const description = await translateDeskText(step.description || '', nextTarget);
        const promptText = await translateDeskText(step.prompt || '', nextTarget);
        patchStep({ description, prompt: promptText, promptSaved: false });
      }
    } catch (error) {
      setTranslateNote(
        error?.code === 'passthrough' || error?.message === 'passthrough'
          ? 'Could not translate. The translation key did not respond.'
          : 'Could not translate right now.',
      );
    } finally {
      setTranslateBusy(false);
    }
  }

  function rightPanelText() {
    const fromState = String(keptTranscript || pdfScan || '').trim();
    if (fromState) return fromState;
    const node = pdfSheetRef.current?.querySelector('.prompt-pdf-sheet__page');
    return String(node?.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function renderPdfTextSheet(beside) {
    return (
      <div
        className={beside ? 'prompt-pdf-sheet prompt-pdf-sheet--beside' : 'prompt-pdf-sheet'}
        ref={pdfSheetRef}
      >
        <DescriptionField
          className="prompt-pdf-sheet__page scroll-match-bg"
          value={keptTranscript || pdfScan}
          label="Documento"
          placeholder={pdfScanReading ? 'Reading the PDF…' : ''}
          onChange={(next) => {
            setPdfScan(next);
            setKeptTranscript(next);
            textPanelKept.current = Boolean(String(next || '').trim());
          }}
        />
        <div className="prompt-pdf__chrome">
          <button
            type="button"
            className="prompt-panel__remove"
            onClick={showPdfPreview ? foldPdfPreview : deletePdf}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  function foldPdfPreview() {
    // Manual remove only — do not fold PDF into a plain-text home panel.
    deletePdf();
  }

  function placeReviewedMarkers() {
    const sheets = readAssistanceMarkers(pdfScan);
    if (!sheets.length) {
      setOrganizeError('No encontré marcadores para colocar.');
      setOrganizeAsk('error');
      setOrganizeLater(true);
      return;
    }
    const mode = steps.some(stepHasDraft) ? 'append' : 'replace';
    const combined = mode === 'append'
      ? appendOrganizedSheets(steps, sheets)
      : stepsFromOrganizedSheets(sheets);
    const maxPages = promptLimits(plan).maxPagesPerFile;
    const stepsNext = combined.slice(0, maxPages);
    if (stepsNext.length === steps.length && mode === 'append' && combined.length > steps.length) {
      setOrganizeError(PROMPT_LIMIT_COPY.page);
      setOrganizeAsk('error');
      return;
    }
    if (combined.length > stepsNext.length) setLimitNote(PROMPT_LIMIT_COPY.page);
    onPatch({
      steps: stepsNext,
      stepIndex: 0,
    });
    setOrganizeAsk(null);
    setOrganizePreview(null);
    setOrganizeError('');
    setOrganizeLater(true);
    setSheetOpen(true);
  }

  function acceptOrganize() {
    const map = organizeMap.current;
    const sheets = organizeSheets.current;
    if (!sheets.length) {
      dismissOrganize();
      return;
    }
    let variables = ownedVariables.map((item) => ({ ...item }));
    const preparedSheets = sheets.map((sheet) => {
      const prepared = prepareSheetFields(
        joinParagraphs(sheet.instruction, map),
        joinParagraphs(sheet.prompt, map),
        variables,
      );
      variables = prepared.variables;
      return {
        instruction: prepared.instruction,
        prompt: prepared.prompt,
        model: sheet.model,
        prompt_title: sheet.prompt_title,
        step_title: sheet.step_title,
      };
    });
    const mode = organizeMode.current;
    const combined = mode === 'append'
      ? appendOrganizedSheets(steps, preparedSheets)
      : stepsFromOrganizedSheets(preparedSheets);
    const maxPages = promptLimits(plan).maxPagesPerFile;
    const stepsNext = combined.slice(0, maxPages);
    if (stepsNext.length === steps.length && mode === 'append' && combined.length > steps.length) {
      setOrganizeError(PROMPT_LIMIT_COPY.page);
      return;
    }
    if (combined.length > stepsNext.length) setLimitNote(PROMPT_LIMIT_COPY.page);
    onPatch({
      variables: stampVariables(variables, prompt.id),
      steps: stepsNext,
      stepIndex: 0,
    });
    setOrganizeAsk(null);
    setOrganizePreview(null);
    setOrganizeError('');
    setOrganizeLater(true);
    setSheetOpen(true);
  }

  async function extractPdf() {
    if (!prompt.pdf?.name || pdfImproving) return;
    setPdfReading(true);
    setPdfScanReading(true);
    setPdfError('');
    setOrganizeAsk(null);
    try {
      const data = await pdfBytes();
      if (!data) {
        setPdfError('Choose the file again to read it.');
        return;
      }
      const kind = prompt.pdf?.kind || promptDocumentKind(prompt.pdf?.name);
      if (kind !== 'pdf') {
        const text = normalizePdfExtractedText(pdfPlain || bytesToText(data));
        if (!text) {
          setPdfError('Couldn’t find text in this file.');
          return;
        }
        deliverExtract(text);
        return;
      }
      const images = await ensurePdfImages();
      if (!images?.length) {
        setPdfError('Couldn’t display the PDF.');
        return;
      }
      const page = Math.min(Math.max(0, pdfPageIndex), images.length - 1);
      const extracted = await extractPdfPageTexts(data, { maxPages: images.length });
      let text = normalizePdfExtractedText(extracted.pages[page] || '');
      if (!text) {
        const recognized = await ocrPdfPageImages([images[page]]);
        text = normalizePdfExtractedText(recognized[0] || '');
      }
      if (!text) {
        setPdfError('Couldn’t find text on this page.');
        return;
      }
      deliverExtract(text);
    } catch (error) {
      console.warn('[prompt-desk] pdf text failed', error?.message || error);
      setPdfError(pdfReadError(error));
    } finally {
      setPdfReading(false);
      setPdfScanReading(false);
    }
  }

  async function improvePdf() {
    if (!pdfPasted || pdfReading) return;
    const pastedDescription = String(step.description || '').trim();
    const pastedPrompt = String(step.prompt || '').trim();
    if (!pastedDescription && !pastedPrompt) {
      setPdfError('Paste the text before improving it.');
      return;
    }
    setPdfImproving(true);
    setPdfError('');
    const allowed = await freeToolAllowed();
    if (!allowed.ok) {
      setPdfError(allowed.message);
      setPdfImproving(false);
      return;
    }
    try {
      const account = useAuthStore.getState().user;
      let result;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await promptApi({
            pass: 'improve',
            description: pastedDescription,
            prompt: pastedPrompt,
            userId: account?.id,
            userEmail: account?.email,
          });
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('429') || attempt >= 3) throw error;
          setPdfError('Groq is busy. Waiting to improve the text…');
          await new Promise((resolve) => setTimeout(resolve, retryWaitMs(error, attempt)));
        }
      }
      const nextDescription = String(result?.description || '').trim();
      const nextPrompt = String(result?.prompt || '').trim();
      if (!nextDescription && !nextPrompt) {
        setPdfError('Groq didn’t find text to improve.');
        return;
      }
      const lifted = liftPromptPlaceholders(nextPrompt, ownedVariables);
      const title = String(result?.title || '').trim();
      onPatch({
        variables: stampVariables(lifted.variables, prompt.id),
        stepPatch: {
          id: step.id,
          prompt: lifted.prompt || nextPrompt || step.prompt,
          ...(nextDescription ? { description: nextDescription } : {}),
          ...(title && !String(step.title || '').trim() ? { title } : {}),
          promptSaved: false,
        },
      });
    } catch (error) {
      console.warn('[prompt-desk] pdf improve failed', error?.message || error);
      setPdfError(pdfReadError(error));
    } finally {
      setPdfImproving(false);
    }
  }

  function hideSide() {
    sideHold.current = true;
    setShowPdf(false);
    setShowVideo(false);
  }

  function deletePdf() {
    pdfFiles.delete(prompt.id);
    textPanelKept.current = false;
    setKeptTranscript('');
    setPdfError('');
    setPdfPasted(false);
    setPdfPages([]);
    setPdfPageCount(0);
    setPdfPageIndex(0);
    setPdfStatus('idle');
    setPdfScan('');
    setPdfScanReading(false);
    setPdfFolded(false);
    setPdfPlain('');
    pdfPagesRef.current = [];
    pdfLoadedName.current = '';
    setShowPdf(false);
    onPatch({
      pdf: null,
      steps: steps.map((item) => ({ ...item, pdfPage: null })),
    });
  }

  function resetPdfView() {
    setPdfZoom(1);
    setPdfViewTouched(false);
    const node = pdfViewportRef.current;
    if (node) {
      node.scrollLeft = 0;
      node.scrollTop = 0;
    }
  }

  function bumpPdfZoom(factor) {
    setPdfZoom((current) => clampPdfZoom(current * factor));
    setPdfViewTouched(true);
  }

  function openBuiltPrompt() {
    imageHold.current = false;
    setSheetOpen(true);
    if (prompt.pdf?.name || prompt.video?.embedSrc) {
      showIndexMedia();
    }
  }

  function showIndexMedia() {
    imageHold.current = false;
    if (sideHold.current) {
      setShowPdf(false);
      setShowVideo(false);
      return;
    }
    if (prompt.pdf?.name) {
      setShowPdf(true);
      setShowVideo(false);
    } else if (prompt.video?.embedSrc) {
      setShowVideo(true);
      setShowPdf(false);
    }
  }

  function saveAllPrompts() {
    setFormatOpen(false);
    setModelOpen(false);
    setRecommendedOpen(false);
    onPatch({ steps: stepsAfterSave(prompt) });
  }

  function editStep() {
    setFormatOpen(false);
    setModelOpen(false);
    setRecommendedOpen(false);
    setVarsOpen(false);
    patchStep({ promptSaved: false });
  }

  function finishHome() {
    setHomeSaveAsk(false);
    setSheetOpen(false);
    setModelOpen(false);
    setRecommendedOpen(false);
    setFormatOpen(false);
    showIndexMedia();
  }

  function textIsDirty() {
    for (const item of steps) {
      const prev = savedStepsRef.current[item.id];
      const promptText = item.prompt || '';
      const description = item.description || '';
      if (!openedStepIds.current.has(item.id) && !item.promptSaved) return true;
      if (!prev) {
        if (promptHasText(promptText) || promptHasText(description)) return true;
        continue;
      }
      if (promptText !== prev.prompt || description !== prev.description || (item.title || '') !== (prev.title || '')) return true;
    }
    const file = savedPromptRef.current;
    if (file && (prompt.name || '') !== file.name) return true;
    return false;
  }

  function requestClose() {
    if (textIsDirty()) {
      setHomeSaveAsk('close');
      return;
    }
    onClose();
  }

  function discardCreated() {
    const leaving = homeSaveAsk === 'close';
    const saved = savedStepsRef.current;
    const restored = steps.map((item) => {
      if (item.promptSaved) return item;
      const previous = saved[item.id];
      if (previous) {
        return {
          ...item,
          prompt: previous.prompt,
          description: previous.description,
          title: previous.title || '',
          promptSaved: true,
        };
      }
      return { ...item, prompt: '', description: '', title: '', promptSaved: false };
    }).filter((item, _, list) => {
      if (list.length === 1) return true;
      if (item.promptSaved) return true;
      return stepHasWork(item);
    });
    const nextSteps = restored.length
      ? restored
      : [blankPromptStep()];
    const file = savedPromptRef.current;
    onPatch({
      ...(file ? {
        name: file.name,
        variables: stampVariables(file.variables, prompt.id),
        references: normalizeReferences(file),
        ...legacyFieldsFromReferences(normalizeReferences(file)),
      } : {}),
      steps: nextSteps,
      stepIndex: Math.min(index, nextSteps.length - 1),
    }, 'now');
    if (leaving) {
      setHomeSaveAsk(false);
      onClose();
      return;
    }
    finishHome();
  }

  function goHome() {
    if (textIsDirty()) {
      setHomeSaveAsk('home');
      return;
    }
    finishHome();
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
    if (!stepHasDraft(step)) return;
    if (!canAddPromptPage(steps.length, plan)) {
      return;
    }
    onPatch({
      steps: [...steps, blankPromptStep()],
      stepIndex: steps.length,
    });
  }

  /** Split-layout rail: always append a new prompt under the free/pro page cap. */
  function addPromptStep() {
    imageHold.current = false;
    if (!canAddPromptPage(steps.length, plan)) {
      return;
    }
    onPatch({
      steps: [...steps, blankPromptStep()],
      stepIndex: steps.length,
    });
  }

  function deleteStepAt(itemIndex) {
    imageHold.current = false;
    if (steps.length <= 1) {
      onPatch({
        steps: [blankPromptStep(steps[0]?.id)],
        stepIndex: 0,
      });
      return;
    }
    const nextSteps = steps.filter((_, i) => i !== itemIndex);
    const nextIndex = itemIndex < index
      ? index - 1
      : itemIndex === index
        ? Math.min(index, nextSteps.length - 1)
        : index;
    onPatch({
      steps: nextSteps,
      stepIndex: Math.max(0, Math.min(nextIndex, nextSteps.length - 1)),
    });
  }

  function deleteIndex() {
    deleteStepAt(index);
  }

  function fixOpenPrompt() {
    if (!stepHasDraft(step)) return;
    onPatch({
      stepPatch: {
        id: step.id,
        description: fixPromptText(step.description),
        prompt: fixPromptText(step.prompt),
        promptSaved: false,
      },
    });
  }

  function addAutoVariables() {
    const hasAny = (steps || []).some((item) => (
      promptHasText(item?.prompt) || promptHasText(item?.description)
    ));
    if (!hasAny) return;
    const lifted = liftDocumentPlaceholders(steps, ownedVariables);
    const nextSteps = lifted.steps.map((item, itemIndex) => {
      const prev = steps[itemIndex];
      const changed = prev?.prompt !== item.prompt || prev?.description !== item.description;
      return changed ? { ...item, promptSaved: false } : item;
    });
    onPatch({
      variables: stampVariables(lifted.variables, prompt.id),
      steps: nextSteps,
    });
  }

  function resetAutoVariables() {
    if (!ownedVariables.length) return;
    const reset = resetDocumentPlaceholders(steps, ownedVariables);
    const nextSteps = reset.steps.map((item, itemIndex) => {
      const prev = steps[itemIndex];
      const changed = prev?.prompt !== item.prompt || prev?.description !== item.description;
      return changed ? { ...item, promptSaved: false } : item;
    });
    onPatch({
      variables: [],
      steps: nextSteps,
    });
  }

  function exportDocumentMarkdown() {
    exportPromptDocumentMarkdown(prompt, ownedVariables);
  }

  function commitBody({ prompt: nextPrompt, variables, keepSaved }) {
    if (keepSaved) {
      patchStep({ prompt: nextPrompt });
      return;
    }
    if (variables && nextPrompt != null) {
      onPatch({
        variables: stampVariables(variables, prompt.id),
        stepPatch: {
          id: step.id,
          prompt: nextPrompt,
          promptSaved: false,
        },
      });
      return;
    }
    if (variables) {
      onPatch(markStepUnsaved(step.id, { variables: stampVariables(variables, prompt.id) }));
      return;
    }
    patchStep({
      prompt: nextPrompt,
      promptSaved: false,
    });
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
      if (node.tagName === 'MARK' || hasHighlightBackground(style)) highlight = true;
      node = node.parentElement;
    }
    try {
      setFormatOn({
        bold: doc.queryCommandState('bold'),
        italic: doc.queryCommandState('italic'),
        underline: doc.queryCommandState('underline'),
        strikeThrough: doc.queryCommandState('strikeThrough'),
        highlight,
        bullet: caretInBullet(root),
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
    if (command === 'bullet') applyBulletPoint(root);
    else toggleTextFormat(root, command);
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

  function commitReferences(list) {
    const references = normalizeReferences({ references: list });
    onPatch({
      references,
      ...legacyFieldsFromReferences(references),
    });
    return references;
  }

  function addReference(name, href) {
    const nextUrl = String(href || '').trim();
    if (!nextUrl) return false;
    const next = [
      ...normalizeReferences(prompt),
      blankReference({ name: String(name || '').trim(), url: nextUrl }),
    ];
    commitReferences(next);
    setUrlName('');
    setUrlDraft('');
    setUrlEditing(false);
    setEditingRefId('');
    setUrlDrafting(false);
    return true;
  }

  function startUrlDraft() {
    setUrlName('');
    setUrlDraft('');
    setUrlDrafting(true);
    window.setTimeout(() => urlFieldRef.current?.focus(), 0);
  }

  function saveReferenceEdit(refId, name, href) {
    const nextUrl = String(href || '').trim();
    if (!nextUrl) return false;
    const next = normalizeReferences(prompt).map((item) => (
      item.id === refId
        ? { ...item, name: String(name || '').trim(), url: nextUrl }
        : item
    ));
    commitReferences(next);
    setUrlEditing(false);
    setEditingRefId('');
    return true;
  }

  function removeReference(refId) {
    commitReferences(normalizeReferences(prompt).filter((item) => item.id !== refId));
    if (editingRefId === refId) {
      setUrlEditing(false);
      setEditingRefId('');
    }
    setUrlCopied(false);
  }

  async function copyPrompt() {
    if (!canCopy) return;
    const ok = await copyRichText(copiedText, richCopy(step.prompt, ownedVariables));
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
            <span className="prompt-chip__label">{promptDisplayName(prompt)}</span>
          </span>
          <span className="prompt-chip__snippet">{snippet}</span>
        </span>
      </button>
    );
  }

  const pageCap = promptLimits(plan).maxPagesPerFile;

  return (
    <>
    {sheetOpen && !parked ? <div className="prompt-focus-scrim" aria-hidden="true" /> : null}
    <section
      hidden={parked}
      className={[
        'prompt-panel',
        showSide || pdfTranscriptWide ? 'prompt-panel--wide' : '',
      ].filter(Boolean).join(' ')}
      aria-label="Prompt"
    >
      <button type="button" className="prompt-panel__close" onClick={requestClose} aria-label="Cerrar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className={
        showSide
          ? 'prompt-panel__split prompt-panel__split--side'
          : pdfTranscriptWide
            ? 'prompt-panel__split prompt-panel__split--transcript'
            : [
                'prompt-panel__split prompt-panel__split--prompt',
                sheetOpen && PROMPT_SPLIT_LAYOUT ? 'prompt-panel__split--steps' : '',
              ].filter(Boolean).join(' ')
      }>
        <div className={sheetOpen ? 'prompt-panel__editor-tools prompt-panel__editor-tools--sheet' : 'prompt-panel__editor-tools'}>
          {sheetOpen ? (
            <button
              type="button"
              className="prompt-panel__home"
              onClick={goHome}
              aria-label={`Home · ${promptDisplayName(prompt)}`}
              title="Home"
            >
              <img
                className="prompt-panel__home-glyph"
                src="/uploads/Home%20Info.svg"
                alt=""
                aria-hidden="true"
              />
              <span
                className={
                  String(prompt.name || '').trim()
                    ? 'prompt-panel__home-name'
                    : 'prompt-panel__home-name is-placeholder'
                }
              >
                {promptDisplayName(prompt)}
              </span>
            </button>
          ) : (
            <textarea
              className="prompt-panel__name"
              value={prompt.name}
              placeholder={DEFAULT_PROMPT_NAME}
              aria-label="Nombre"
              rows={1}
              onChange={(event) => onPatch({ name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
          )}
          {urlOffer ? (
            <div className="prompt-url-offer" role="status">
              <p>Guardar este link en Url?</p>
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...normalizeReferences(prompt),
                    blankReference({ url: urlOffer }),
                  ];
                  onPatch({
                    references: next,
                    ...legacyFieldsFromReferences(next),
                  });
                  setUrlOffer('');
                }}
              >
                Guardar
              </button>
              <button type="button" onClick={() => setUrlOffer('')}>No</button>
            </div>
          ) : null}
          <div className={sheetOpen ? 'prompt-models prompt-models--sheet' : 'prompt-models'}>
            {sheetOpen ? (
              <div
                className={step.promptSaved ? 'prompt-models__row is-locked' : 'prompt-models__row'}
                role="toolbar"
                aria-label="Prompt tools"
                aria-disabled={step.promptSaved}
              >
                <button
                  type="button"
                  className={formatOpen ? 'prompt-format__btn is-selected' : 'prompt-format__btn'}
                  aria-expanded={formatOpen}
                  aria-label="Language"
                  title={PROMPT_FORMATS.find((entry) => entry.id === (step.format || 'text'))?.label || 'Text'}
                  disabled={step.promptSaved}
                  onClick={() => {
                    setFormatOpen((open) => !open);
                    setModelOpen(false);
                    setRecommendedOpen(false);
                  }}
                >
                  Language
                </button>
                <button
                  type="button"
                  className="prompt-models__item"
                  onClick={() => setVarsOpen(true)}
                >
                  <span className="prompt-models__glyph" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M7 7h4M7 12h10M7 17h7" />
                    </svg>
                  </span>
                  <span>Variables</span>
                </button>
                {(steps || []).some((item) => promptHasText(item?.prompt) || promptHasText(item?.description) || String(item?.title || '').trim()) ? (
                  <button
                    type="button"
                    className="prompt-models__item"
                    onClick={() => { exportDocumentMarkdown(); }}
                    title="Export all prompts as Markdown"
                  >
                    <span className="prompt-models__glyph" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 3v12" />
                        <path d="m8 11 4 4 4-4" />
                        <path d="M5 19h14" />
                      </svg>
                    </span>
                    <span>Export .md</span>
                  </button>
                ) : null}
                {stepHasDraft(step) ? (
                  <button
                    type="button"
                    className="prompt-models__item"
                    disabled={step.promptSaved}
                    onClick={() => { fixOpenPrompt(); }}
                  >
                    <span className="prompt-models__glyph" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 7h16M4 12h10M4 17h13" />
                      </svg>
                    </span>
                    <span>Fix Text</span>
                  </button>
                ) : null}
                {(steps || []).some((item) => promptHasText(item?.prompt) || promptHasText(item?.description)) ? (
                  <button
                    type="button"
                    className="prompt-models__item"
                    disabled={step.promptSaved}
                    onClick={() => { addAutoVariables(); }}
                  >
                    <span className="prompt-models__glyph" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M8 7h.01M16 7h.01M9 12h6M8 17h.01M16 17h.01" />
                        <path d="M7 5v14M17 5v14" />
                      </svg>
                    </span>
                    <span>Auto Variable</span>
                  </button>
                ) : null}
                <FormatBar active={formatOn} disabled={step.promptSaved} onApply={applyTextFormat} />
              </div>
            ) : (
              <>
                {onOpenStorage ? (
                  <button type="button" className="prompt-models__item" onClick={onOpenStorage}>
                    <span className="prompt-models__glyph" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.2l1.6 1.6M17.6 16.2l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.8l1.6-1.6M17.6 7.8l1.6-1.6" />
                      </svg>
                    </span>
                    <span>Settings</span>
                  </button>
                ) : null}
                {(showPdf && prompt.pdf?.name) || (showVideo && prompt.video?.embedSrc) ? (
                  <button type="button" className="prompt-models__item" onClick={hideSide}>
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
                {showVideo ? null : (
                  <button
                    type="button"
                    className="prompt-models__item"
                    onClick={() => {
                      sideHold.current = false;
                      setShowVideo(true);
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
                <button
                  type="button"
                  className={promptCount ? 'prompt-models__item is-counted' : 'prompt-models__item is-counted is-empty'}
                  onClick={openBuiltPrompt}
                >
                  <span className="prompt-models__glyph" aria-hidden="true">{promptCount}</span>
                  <span>{promptCount ? 'List of Prompts' : 'Create Prompt'}</span>
                </button>
                <button
                  type="button"
                  className={promptHasReferences(prompt) ? 'prompt-models__item is-counted' : 'prompt-models__item'}
                  onClick={() => {
                    setUrlCopied(false);
                    setUrlOpen(true);
                  }}
                >
                  <span className="prompt-models__glyph" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M10 13a5 5 0 0 0 7.1.7l2.1-2.1a5 5 0 0 0-7.1-7.1L10.8 5.8" />
                      <path d="M14 11a5 5 0 0 0-7.1-.7l-2.1 2.1a5 5 0 0 0 7.1 7.1l1.3-1.3" />
                    </svg>
                  </span>
                  <span>URL</span>
                </button>
              </>
            )}
          </div>
          {homeSaveAsk ? createPortal(
            <div className="prompt-home-save-layer">
              <div className="prompt-home-save" role="dialog" aria-label="Save prompt">
                <p>Do you want to save this prompt?</p>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      saveAllPrompts();
                      if (homeSaveAsk === 'close') {
                        setHomeSaveAsk(false);
                        onClose();
                        return;
                      }
                      finishHome();
                    }}
                  >
                    Save
                  </button>
                  <button type="button" onClick={discardCreated}>No</button>
                </div>
              </div>
            </div>,
            document.body,
          ) : null}
          {formatOpen && !step.promptSaved ? (
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
                    onClick={() => {
                      patchStep({ format: entry.id, promptSaved: false });
                      setFormatOpen(false);
                    }}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {showVideo ? (
          <div className="prompt-panel__video">
            {prompt.video?.embedSrc ? (
              <iframe
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
                <button type="button" className="prompt-panel__remove" onClick={hideSide}>
                  Hide
                </button>
                {videoError ? <p role="alert">{videoError}</p> : null}
              </form>
            )}
          </div>
        ) : null}
        {showPdfPreview ? (
          <div className={`prompt-panel__pdf${pdfPages.length || pdfPlain ? ' prompt-panel__pdf--pages' : ''}`}>
            {pdfPages.length ? (
              <div className="prompt-panel__pdf-pages">
                {(() => {
                  const pageSrc = pdfPages[Math.min(pdfPageIndex, pdfPages.length - 1)];
                  const pageKey = `pdf-page-${pdfPageIndex}`;
                  const zoomPct = `${Math.round(clampPdfZoom(pdfZoom) * 100)}%`;
                  return (
                    <div
                      ref={pdfViewportRef}
                      className={pdfPanning ? 'prompt-pdf__viewport is-panning' : 'prompt-pdf__viewport'}
                      title="Scroll para leer · arrastrar para mover · + / − para zoom"
                      onDoubleClick={resetPdfView}
                    >
                      <div
                        className="prompt-pdf__stage"
                        style={{ width: zoomPct }}
                      >
                        <img
                          key={pageKey}
                          src={pageSrc}
                          alt=""
                          draggable={false}
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                          onLoad={(event) => notePdfNatural(event.currentTarget)}
                          ref={(node) => {
                            if (node?.complete) notePdfNatural(node);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : pdfPlain ? (
              <div className="prompt-pdf__sheet prompt-pdf__sheet--text">
                <pre className="prompt-panel__pdf-text scroll-match-bg">{pdfPlain}</pre>
                <div className="prompt-pdf__chrome">
                  <button type="button" className="prompt-panel__remove" onClick={foldPdfPreview}>
                    Remove
                  </button>
                </div>
              </div>
            ) : pdfStatus === 'loading' ? (
              <p>Opening the file…</p>
            ) : (
              <div className="prompt-panel__pdf-empty">
                <label className="prompt-panel__pdf-pick">
                  <img className="prompt-panel__pdf-art" src="/Pdf%20File.svg" alt="" />
                  <span className="prompt-panel__pdf-link">{prompt.pdf?.name || 'Choose a file'}</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf,.md,.markdown,text/plain,.txt"
                    onChange={(event) => takePdf(event.target.files?.[0])}
                  />
                </label>
                <button type="button" className="prompt-panel__remove" onClick={hideSide}>
                  Hide
                </button>
              </div>
            )}
            {pdfPages.length || pdfPlain ? (
              <div className="prompt-pdf__corner">
                <button
                  type="button"
                  className="prompt-pdf__extract"
                  disabled={pdfReading || pdfImproving}
                  onClick={() => { void extractPdf(); }}
                >
                  {pdfReading ? 'Reading…' : 'Extract page'}
                </button>
              </div>
            ) : null}
            {pdfPages.length ? (
              <div className="prompt-pdf__foot">
                <label className="prompt-pdf__mark">
                  <input
                    type="checkbox"
                    aria-label="Include this page"
                    checked={pdfPick[Math.min(pdfPageIndex, pdfPages.length - 1)] === true}
                    onChange={(event) => {
                      const index = Math.min(pdfPageIndex, pdfPages.length - 1);
                      const on = event.target.checked;
                      setPdfPick((current) => pdfPages.map((_, item) => (
                        item === index ? on : current[item] === true
                      )));
                    }}
                  />
                </label>
                <div className="prompt-pdf__chrome">
                  <div className="prompt-pdf__zoom" role="group" aria-label="Zoom">
                    <button
                      type="button"
                      className="prompt-pdf__zoom-btn"
                      aria-label="Zoom out"
                      disabled={pdfZoom <= PDF_VIEW_MIN_ZOOM}
                      onClick={() => bumpPdfZoom(1 / 1.2)}
                    >
                      −
                    </button>
                    <span className="prompt-pdf__zoom-label">{`${Math.round(pdfZoom * 100)}%`}</span>
                    <button
                      type="button"
                      className="prompt-pdf__zoom-btn"
                      aria-label="Zoom in"
                      disabled={pdfZoom >= PDF_VIEW_MAX_ZOOM}
                      onClick={() => bumpPdfZoom(1.2)}
                    >
                      +
                    </button>
                  </div>
                  <PdfPager
                    index={pdfPageIndex}
                    count={pdfPages.length}
                    onPrev={() => setPdfPageIndex((current) => Math.max(0, current - 1))}
                    onNext={() => setPdfPageIndex((current) => Math.min(pdfPages.length - 1, current + 1))}
                  />
                  <button
                    type="button"
                    className={prompt.pdf?.path && !pdfScan.trim() ? 'prompt-panel__remove is-danger' : 'prompt-panel__remove'}
                    onClick={foldPdfPreview}
                  >
                    Remove
                  </button>
                </div>
                {sheetOpen ? (
                  <div className="prompt-pdf__chrome-actions">
                    {pdfPasted ? (
                      <button
                        type="button"
                        className="prompt-video__extract"
                        disabled={pdfReading || pdfImproving}
                        onClick={() => { void improvePdf(); }}
                      >
                        {pdfImproving ? 'Mejorando…' : 'Mejorar con IA'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {pdfError ? <p className="prompt-pdf__inline-error" role="alert">{pdfError}</p> : null}
          </div>
        ) : null}
        {showVideo && prompt.video?.embedSrc ? (
          <div className="prompt-panel__media-foot">
            <button type="button" className="prompt-panel__remove" onClick={removeVideo}>
              Remove
            </button>
          </div>
        ) : null}
          {textBesidePrompt ? renderPdfTextSheet(true) : null}
          {sheetOpen && PROMPT_SPLIT_LAYOUT ? (
            <aside className="prompt-step-rail" aria-label="Prompt list">
              <p className="prompt-step-rail__label">
                <span>Prompts</span>
                {Number.isFinite(pageCap) ? (
                  <span
                    className="prompt-step-rail__quota"
                    aria-label={`${steps.length} of ${pageCap} prompts`}
                  >
                    {steps.length}/{pageCap}
                  </span>
                ) : null}
              </p>
              <ul className="prompt-step-rail__list">
                {steps.map((item, itemIndex) => {
                  const named = String(item.title || '').trim();
                  const label = named || 'Prompt title';
                  const activeRow = itemIndex === index;
                  const rowClass = [
                    'prompt-step-rail__row',
                    activeRow ? 'is-active' : '',
                    named ? '' : 'is-placeholder',
                  ].filter(Boolean).join(' ');
                  const itemClass = [
                    'prompt-step-rail__item',
                    activeRow ? 'is-active' : '',
                    named ? '' : 'is-placeholder',
                  ].filter(Boolean).join(' ');
                  return (
                    <li key={item.id} className={rowClass}>
                      <button
                        type="button"
                        className={itemClass}
                        aria-current={activeRow ? 'true' : undefined}
                        onClick={() => {
                          if (itemIndex === index) return;
                          imageHold.current = false;
                          onPatch({ stepIndex: itemIndex });
                        }}
                      >
                        <span className="prompt-step-rail__dot" aria-hidden="true" />
                        <span className="prompt-step-rail__title">{label}</span>
                      </button>
                      <button
                        type="button"
                        className="prompt-step-rail__delete"
                        aria-label={`Eliminar ${label}`}
                        title="Eliminar"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          deleteStepAt(itemIndex);
                        }}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="prompt-step-rail__add"
                disabled={!canAddPromptPage(steps.length, plan)}
                onClick={addPromptStep}
              >
                + New prompt
              </button>
            </aside>
          ) : null}
          {sheetOpen ? (
          <div className={step.promptSaved ? 'prompt-sheet prompt-sheet--saved' : 'prompt-sheet'}>
            {step.promptSaved ? (
              <div className="prompt-drawer">
                <div className="prompt-sheet__saved-head">
                  <div className="prompt-sheet__head-copy">
                    <PromptTitleField
                      className="prompt-sheet__title"
                      value={step.title || ''}
                      placeholder="Prompt title"
                      readOnly
                      onChange={() => {}}
                    />
                    {(sheetPlatformLabel || sheetRecommended) ? (
                      <p className="prompt-sheet__target">
                        {sheetPlatformLabel ? (
                          <span className="prompt-sheet__target-platform">{sheetPlatformLabel}</span>
                        ) : null}
                        {sheetPlatformLabel && sheetRecommended ? (
                          <span className="prompt-sheet__target-sep" aria-hidden="true">·</span>
                        ) : null}
                        {sheetRecommended ? (
                          <span className="prompt-sheet__target-model">{sheetRecommended}</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </div>
                <PromptBody
                  key={`${prompt.id}:${step.id}:saved`}
                  prompt={step.prompt}
                  documentId={prompt.id}
                  variables={ownedVariables}
                  placeholder=""
                  readOnly
                  onCommit={commitBody}
                  onUrlPaste={setUrlOffer}
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
            ) : (
              <>
                <div className="prompt-sheet__head">
                  <PromptTitleField
                    className="prompt-sheet__title"
                    value={step.title || ''}
                    placeholder="Prompt title"
                    onChange={(title) => patchStep({ title })}
                  />
                </div>
                <div className="prompt-drawer">
                  <div className="prompt-target-float" aria-label="Destino del prompt">
                    <div className="prompt-target-float__chip">
                      <ModelPicker
                        modelIds={step.modelIds}
                        open={modelOpen}
                        readOnly={false}
                        onToggle={() => {
                          setModelOpen((open) => !open);
                          setRecommendedOpen(false);
                          setFormatOpen(false);
                        }}
                        onChange={(modelIds) => {
                          patchStep({ modelIds: modelIds.slice(0, 1), promptSaved: false });
                          setCustomModel('');
                          setModelOpen(false);
                        }}
                      />
                      {modelOpen ? (
                        <div className="prompt-target-float__menu">
                          <ModelMenu
                            customDraft={customModel}
                            onCustomDraft={setCustomModel}
                            onChange={(modelIds) => {
                              patchStep({ modelIds: modelIds.slice(0, 1), promptSaved: false });
                              setCustomModel('');
                              setModelOpen(false);
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="prompt-target-float__chip">
                      <button
                        type="button"
                        className={
                          recommendedOpen || sheetRecommended
                            ? 'prompt-models__item is-selected'
                            : 'prompt-models__item prompt-models__item--tip'
                        }
                        aria-expanded={recommendedOpen}
                        aria-label="Modelo recomendado"
                        onClick={() => {
                          setRecommendedOpen((open) => !open);
                          setModelOpen(false);
                          setFormatOpen(false);
                        }}
                      >
                        <span className="prompt-models__glyph" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M4 7h16M4 12h10M4 17h7" />
                          </svg>
                        </span>
                        <span>{sheetRecommended || 'Modelo recomendado'}</span>
                      </button>
                      {recommendedOpen ? (
                        <div className="prompt-target-float__pop" role="dialog" aria-label="Modelo recomendado">
                          <input
                            className="prompt-target-float__input"
                            type="text"
                            value={step.recommendedModel || ''}
                            placeholder="ej. Claude Sonnet 4"
                            autoFocus
                            onChange={(event) => {
                              patchStep({ recommendedModel: event.target.value, promptSaved: false });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === 'Escape') {
                                event.preventDefault();
                                setRecommendedOpen(false);
                              }
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <PromptBody
                    key={`${prompt.id}:${step.id}`}
                    prompt={step.prompt}
                    documentId={prompt.id}
                    variables={ownedVariables}
                    placeholder="Prompt Description"
                    readOnly={false}
                    onCommit={commitBody}
                    onUrlPaste={setUrlOffer}
                    className={
                      step.format && step.format !== 'text'
                        ? 'prompt-panel__body prompt-panel__body--code'
                        : 'prompt-panel__body'
                    }
                    spellCheck={!step.format || step.format === 'text'}
                    onEditFocus={trackEdit}
                  />
                </div>
              </>
            )}
          </div>
          ) : (
          <div className="prompt-home">
          <div className="prompt-index">
            <div className="prompt-index__fan">
              {[steps[index - 1] || null, step, steps[index + 1] || null].map((page, place) => {
                const text = page ? plainCopy(page.prompt, ownedVariables) : '';
                const isFront = place === 1;
                const picture = isFront
                  ? (cover || HOME_FRAMES[place])
                  : (page?.image || HOME_FRAMES[place]);
                const coverClass = isFront && cover
                  ? 'prompt-index__cover'
                  : ((isFront ? cover : page?.image) ? undefined : 'prompt-index__default');
                const inner = picture ? (
                  <img
                    className={coverClass}
                    src={picture}
                    alt=""
                  />
                ) : (
                  <span className="prompt-index__text">{text}</span>
                );
                if (isFront) {
                  if (needCoverChoice) {
                    return (
                      <button
                        key={page?.id || `empty-${place}`}
                        type="button"
                        className="prompt-index__card prompt-index__card--front"
                        aria-label="Add or skip cover"
                        onClick={askCover}
                      >
                        {inner}
                      </button>
                    );
                  }
                  return (
                    <div
                      key={page?.id || `empty-${place}`}
                      className="prompt-index__card prompt-index__card--front"
                    >
                      <label className="prompt-index__cover-hit">
                        {inner}
                        <input
                          ref={coverPickRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/*"
                          aria-label="Upload cover"
                          onChange={(event) => {
                            takeCover(event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      {cover ? (
                        <button
                          type="button"
                          className="prompt-index__cover-remove"
                          aria-label="Remove cover"
                          onClick={removeCover}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  );
                }
                if (needCoverChoice) {
                  return (
                    <button
                      key={page?.id || `empty-${place}`}
                      type="button"
                      className="prompt-index__card"
                      aria-label="Add or skip cover"
                      onClick={askCover}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <span
                    key={page?.id || `empty-${place}`}
                    className="prompt-index__card"
                  >
                    {inner}
                  </span>
                );
              })}
              {coverAsk ? (
                <div className="prompt-cover-ask" role="dialog" aria-label="Cover image">
                  <p>Add a cover image for this file?</p>
                  <div className="prompt-cover-ask__actions">
                    <button
                      type="button"
                      onClick={() => coverPickRef.current?.click()}
                    >
                      Add cover
                    </button>
                    <button type="button" onClick={skipCover}>
                      Omit cover
                    </button>
                  </div>
                  <input
                    ref={coverPickRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    aria-label="Upload cover"
                    onChange={(event) => {
                      takeCover(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </div>
              ) : null}
            </div>
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
                <button
                  type="button"
                  className="prompt-panel__step-btn"
                  aria-label="Editar"
                  title="Editar"
                  onClick={editStep}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                    <path d="M13 7l4 4" />
                  </svg>
                  <span>Editar</span>
                </button>
              ) : promptNeedsSave(prompt, step) ? (
                <button
                  type="button"
                  className="prompt-panel__step-btn prompt-panel__step-btn--save"
                  aria-label="Guardar"
                  title="Guardar"
                  onClick={saveAllPrompts}
                >
                  Guardar
                </button>
              ) : null}
              <button
                type="button"
                className="prompt-panel__step-btn"
                aria-label="Eliminar"
                title="Eliminar"
                onClick={deleteIndex}
              >
                Eliminar
              </button>
            </div>
          <div className="prompt-steps">
            {PROMPT_SPLIT_LAYOUT ? null : (
              <>
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
                <span className="prompt-steps__count">{filePageCaption(prompt, index, steps.length)}</span>
              </>
            )}
            {limitNote ? <p className="prompt-desk__limit" role="status">{limitNote}</p> : null}
            {PROMPT_SPLIT_LAYOUT ? null : (
              <button
                type="button"
                className="prompt-steps__arrow"
                aria-label="Next prompt"
                disabled={index >= steps.length - 1 && (!stepHasDraft(step) || !canAddPromptPage(steps.length, plan))}
                onClick={goForward}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.5 6.5 15 12l-5.5 5.5" />
                </svg>
              </button>
            )}
          </div>
          </div>
          ) : null}
      </div>
      <VariableDeck
        open={varsOpen}
        title={prompt.name}
        variables={ownedVariables}
        documentId={prompt.id}
        onChange={(next) => onPatch(markStepUnsaved(step.id, { variables: stampVariables(next, prompt.id) }))}
        onResetPlaceholders={resetAutoVariables}
        onClose={() => setVarsOpen(false)}
      />
      {urlOpen ? (
        <div
          className="prompt-library"
          role="dialog"
          aria-modal="true"
          aria-label="URL"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            setUrlOpen(false);
          }}
        >
          <div className="prompt-library__page">
            <header className="prompt-library__head">
              <div>
                <p>URL</p>
                <h2>{prompt.name || 'This file'}</h2>
              </div>
              <button type="button" className="prompt-library__close" onClick={() => setUrlOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <div className="prompt-library__fields">
              {fileReferences.map((ref) => {
                const editing = urlEditing && editingRefId === ref.id;
                const copied = urlCopied && copiedRefId === ref.id;
                const showName = editing || Boolean(String(ref.name || '').trim());
                return (
                  <div key={ref.id} className="prompt-library__field">
                    <div className="prompt-library__label-row">
                      {showName ? (
                        <input
                          className="prompt-library__name-input"
                          value={editing ? editName : (ref.name || '')}
                          readOnly={!editing}
                          size={Math.max(((editing ? editName : ref.name) || 'Descripción').length, 1)}
                          placeholder="Descripción"
                          aria-label="Descripción del producto"
                          spellCheck={false}
                          onChange={(event) => setEditName(event.target.value)}
                          onKeyDown={(event) => {
                            if (!editing) return;
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              saveReferenceEdit(ref.id, editName, editUrl);
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setUrlEditing(false);
                              setEditingRefId('');
                            }
                          }}
                        />
                      ) : (
                        <span className="prompt-library__name-input prompt-library__name-input--spacer" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        className={editing ? 'prompt-library__queue' : 'prompt-library__rename'}
                        aria-label={editing ? 'Guardar' : 'Editar URL'}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (!editing) {
                            setEditName(ref.name || '');
                            setEditUrl(ref.url || '');
                            setEditingRefId(ref.id);
                            setUrlEditing(true);
                            return;
                          }
                          saveReferenceEdit(ref.id, editName, editUrl);
                        }}
                      >
                        {editing ? 'Guardar' : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                            <path d="M13 7l4 4" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="prompt-library__remove"
                        aria-label="Borrar URL"
                        onClick={() => removeReference(ref.id)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 7h16" />
                          <path d="M9 7V5h6v2" />
                          <path d="M7 7l1 13h8l1-13" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                    <div className={editing ? 'prompt-library__url-box' : 'prompt-library__url-box prompt-library__url-box--copy'}>
                      <textarea
                        rows={2}
                        readOnly={!editing}
                        value={editing ? editUrl : ref.url}
                        placeholder="https://"
                        aria-label="URL de referencia"
                        spellCheck={false}
                        onChange={(event) => setEditUrl(event.target.value)}
                      />
                      {editing ? null : (
                        <button
                          type="button"
                          className="prompt-library__url-copy"
                          aria-label={copied ? 'Copiado' : 'Copiar'}
                          title={copied ? 'Copiado' : 'Copiar'}
                          onClick={() => { void copyHref(ref.url, ref.id); }}
                        >
                          {copied ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M5 12.5 9.5 17 19 7" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15V5a2 2 0 0 1 2-2h8" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {urlDrafting ? (
                <div className="prompt-library__field">
                  <div className="prompt-library__label-row">
                    <input
                      ref={urlFieldRef}
                      className="prompt-library__name-input"
                      value={urlName}
                      size={Math.max((urlName || 'Descripción').length, 1)}
                      placeholder="Descripción"
                      aria-label="Descripción del producto"
                      spellCheck={false}
                      onChange={(event) => setUrlName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          if (!addReference(urlName, urlDraft)) urlFieldRef.current?.focus();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          if (fileReferences.length) setUrlDrafting(false);
                          else setUrlOpen(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="prompt-library__queue"
                      onClick={() => {
                        if (!addReference(urlName, urlDraft)) urlFieldRef.current?.focus();
                      }}
                    >
                      Add URL
                    </button>
                    <button
                      type="button"
                      className="prompt-library__remove"
                      aria-label="Quitar cajón"
                      onClick={() => {
                        setUrlName('');
                        setUrlDraft('');
                        setUrlDrafting(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h16" />
                        <path d="M9 7V5h6v2" />
                        <path d="M7 7l1 13h8l1-13" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={urlDraft}
                    placeholder="https://"
                    aria-label="URL de referencia"
                    spellCheck={false}
                    onChange={(event) => setUrlDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (!addReference(urlName, urlDraft)) urlFieldRef.current?.focus();
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
            <footer className="prompt-library__footer">
              {urlDrafting ? null : (
                <button type="button" className="prompt-library__create" onClick={startUrlDraft}>
                  Add URL
                </button>
              )}
            </footer>
          </div>
        </div>
      ) : null}
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

function FloatCard({ prompt, view, hostWindow = null, onPatch }) {
  const { steps, index, step } = stepAt(prompt);
  const ownedVariables = useMemo(() => documentVariables(prompt), [prompt]);
  const plain = plainCopy(step.prompt, ownedVariables);
  const canCopy = Boolean(plain);
  const [copied, setCopied] = useState(false);
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  const floatModelName = (step.modelIds || [])[0] || '';
  const floatModel = PROMPT_MODELS.find((model) => model.id === floatModelName) || null;
  const floatPlatformLabel = floatModel?.label || floatModelName || '';
  const floatRecommended = String(step.recommendedModel || '').trim();
  const titleRef = useRef(null);
  const floatRootRef = useRef(null);
  const floatHost = hostWindow || view || null;
  const floatClassName = bodyCollapsed ? 'prompt-float is-collapsed' : 'prompt-float';

  useLayoutEffect(() => {
    const doc = floatHost?.document;
    if (!doc?.head) return;
    let style = doc.getElementById('prompt-float-css');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'prompt-float-css';
      doc.head.appendChild(style);
    }
    if (style.textContent !== FLOAT_CSS) {
      style.textContent = FLOAT_CSS;
    }
  });

  useLayoutEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, 24)}px`;
  }, [step.title, prompt.name, bodyCollapsed]);

  useEffect(() => {
    setBodyCollapsed(false);
  }, [step.id]);

  useLayoutEffect(() => {
    const doc = floatHost?.document;
    if (doc?.body) {
      doc.body.classList.toggle('is-float-collapsed', bodyCollapsed);
    }
    if (doc?.documentElement) {
      doc.documentElement.classList.toggle('is-float-collapsed', bodyCollapsed);
    }
    if (!bodyCollapsed) {
      resizeFloatHost(floatHost, FLOAT_OPEN_SIZE.width, FLOAT_OPEN_SIZE.height);
      return;
    }
    const root = floatRootRef.current;
    const fitCollapsed = () => {
      const measured = root ? root.getBoundingClientRect().height : 96;
      resizeFloatHost(floatHost, FLOAT_COLLAPSED_WIDTH, measured + 8);
    };
    fitCollapsed();
    const frame = floatHost?.requestAnimationFrame?.(fitCollapsed);
    return () => {
      if (frame != null) floatHost?.cancelAnimationFrame?.(frame);
    };
  }, [bodyCollapsed, floatHost, step.title, floatPlatformLabel, floatRecommended]);

  function goBack() {
    if (index <= 0) return;
    onPatch({ stepIndex: index - 1 });
  }

  function goForward() {
    if (index >= steps.length - 1) return;
    onPatch({ stepIndex: index + 1 });
  }

  async function copyPrompt() {
    if (!canCopy) return;
    const ok = await copyInView(plain, richCopy(step.prompt, ownedVariables), view);
    if (!ok) return;
    setCopied(true);
    view.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section
      ref={floatRootRef}
      className={floatClassName}
      aria-label="Prompt flotante"
    >
      <div className="prompt-float__sheet">
        <div className="prompt-float__head">
          <div className="prompt-float__brand">
            <span
              className="prompt-float__model"
              title={floatPlatformLabel || 'Plataforma objetivo'}
            >
              {floatModel ? <img src={floatModel.src} alt="" /> : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="7" />
                  <path d="M12 9v3l2 2" />
                </svg>
              )}
            </span>
          </div>
          <div className="prompt-float__head-copy">
            <PromptTitleField
              titleRef={titleRef}
              className="prompt-float__step"
              value={step.title || ''}
              placeholder={prompt.name || 'Title'}
              readOnly
              onChange={() => {}}
            />
            {(floatPlatformLabel || floatRecommended) ? (
              <p className="prompt-float__target">
                {floatPlatformLabel ? (
                  <span className="prompt-float__target-platform">{floatPlatformLabel}</span>
                ) : null}
                {floatPlatformLabel && floatRecommended ? (
                  <span className="prompt-float__target-sep" aria-hidden="true">|</span>
                ) : null}
                {floatRecommended ? (
                  <span className="prompt-float__target-model">{floatRecommended}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="prompt-float__head-actions">
            <button
              type="button"
              className="prompt-float__collapse"
              aria-expanded={!bodyCollapsed}
              aria-label={bodyCollapsed ? 'Expandir prompt' : 'Colapsar prompt'}
              title={bodyCollapsed ? 'Expandir' : 'Colapsar'}
              onClick={() => setBodyCollapsed((value) => !value)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {bodyCollapsed ? (
                  <path d="M7.5 14.25 12 9.75l4.5 4.5" />
                ) : (
                  <path d="M7.5 9.75 12 14.25l4.5-4.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {!bodyCollapsed ? (
          <div className="prompt-drawer">
            <PromptBody
              key={`${prompt.id}:${step.id}`}
              prompt={step.prompt}
              documentId={prompt.id}
              variables={ownedVariables}
              placeholder="Prompt"
              readOnly
              onCommit={() => {}}
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
        ) : null}
      </div>
      {!bodyCollapsed ? (
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
          <span className="prompt-steps__count">{filePageCaption(prompt, index, steps.length)}</span>
          <button
            type="button"
            className="prompt-steps__arrow"
            aria-label="Next prompt"
            disabled={index >= steps.length - 1}
            onClick={goForward}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.5 6.5 15 12l-5.5 5.5" />
            </svg>
          </button>
        </div>
      ) : null}
    </section>
  );
}

const FLOAT_CSS = `
  html, body, #prompt-float-root {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }
  html.is-float-collapsed,
  html.is-float-collapsed body,
  html.is-float-collapsed #prompt-float-root {
    height: fit-content;
    min-height: 0;
    max-height: none;
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
  .prompt-float.is-collapsed {
    height: fit-content;
    min-height: 0;
    gap: 0;
    padding: 6px 8px;
    overflow: hidden;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .prompt-float__sheet {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 0;
    border-radius: 14px;
    background: transparent;
    overflow: hidden;
  }
  .prompt-float.is-collapsed .prompt-float__sheet {
    flex: 0 0 auto;
    height: fit-content;
    min-height: 0;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .prompt-float__head {
    position: relative;
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
    padding: 10px 4px 10px;
    border-bottom: 0;
  }
  .prompt-float.is-collapsed .prompt-float__head {
    border-bottom: 0;
    padding: 4px 2px;
    align-items: center;
  }
  .prompt-float__head-actions {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    flex-shrink: 0;
  }
  .prompt-float.is-collapsed .prompt-float__head-actions {
    align-items: center;
  }
  .prompt-float__brand {
    flex: none;
    width: 22px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 2px;
  }
  .prompt-float__head-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 1px;
  }
  .prompt-float__target {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
    color: rgba(26, 26, 26, 0.55);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.25;
  }
  .prompt-float__target-platform,
  .prompt-float__target-model {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .prompt-float__target-sep {
    opacity: 0.55;
  }
  .prompt-float__model {
    position: static;
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
  .prompt-float__collapse {
    box-sizing: border-box;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(20, 20, 22, 0.14);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.95);
    color: #1a1a1a;
    display: grid;
    place-items: center;
    overflow: visible;
    flex-shrink: 0;
    cursor: pointer;
  }
  .prompt-float__collapse:hover {
    border-color: rgba(20, 20, 22, 0.28);
  }
  .prompt-float__collapse svg {
    width: 16px;
    height: 16px;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .prompt-float.is-collapsed .prompt-float__collapse {
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 2px 8px rgba(20, 20, 22, 0.1);
  }
  .prompt-float.is-collapsed .prompt-float__step {
    font-size: 15px;
  }
  .prompt-float__step {
    flex: none;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin: 0;
    border: 0;
    background: transparent;
    color: #1a1a1a;
    font: inherit;
    font-size: 18px;
    font-weight: 560;
    letter-spacing: -0.02em;
    line-height: 1.35;
    padding: 0;
    resize: none;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    field-sizing: content;
    outline: none;
  }
  .prompt-float__instructions-body { white-space: pre-wrap; }
  .prompt-stepper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    overflow: auto;
  }
  .prompt-stepper__nav { display: flex; flex-direction: column; width: 100%; }
  .prompt-stepper__item { position: relative; display: flex; flex-direction: column; }
  .prompt-stepper__trigger {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 0 0 10px;
    border: 0;
    background: transparent;
    color: #1a1a1a;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .prompt-stepper__indicator {
    flex: none;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #eceae4;
    color: #6b6864;
    font-size: 11px;
    font-weight: 650;
  }
  .prompt-stepper__indicator[data-state='active'] { background: #1a1a1a; color: #fff; }
  .prompt-stepper__indicator[data-state='completed'] { background: #57bc6c; color: #fff; }
  .prompt-stepper__title { font-size: 13px; font-weight: 600; }
  .prompt-stepper__separator {
    position: absolute;
    top: 26px;
    left: 10px;
    width: 2px;
    height: calc(100% - 18px);
    border-radius: 999px;
    background: #e4e1d8;
  }
  .prompt-stepper__panel { padding: 0 0 12px 32px; }
  .prompt-stepper__panel[hidden] { display: none; }
  .prompt-url-offer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 12px 8px;
    color: #1a1a1a;
    font-size: 12px;
  }
  .prompt-url-offer p { margin: 0; }
  .prompt-url-offer button {
    border: 1px solid rgba(20, 20, 22, 0.22);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    line-height: 1;
    padding: 6px 10px;
    cursor: pointer;
  }
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
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .prompt-float .prompt-drawer {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    border: 0;
    border-radius: 14px;
    background: #F1F1F1;
  }
  .prompt-float .prompt-body,
  .prompt-float .prompt-body__frame {
    min-height: 0;
    background: transparent;
  }
  .prompt-float .prompt-body__editor {
    overflow: auto;
    background: transparent;
    color: #111;
  }
  .prompt-float__text h1,
  .prompt-body__editor h1 {
    display: block;
    margin: 0.35em 0 0.15em;
    font-size: 22px;
    font-weight: 650;
    line-height: 1.25;
    letter-spacing: -0.02em;
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
    width: 100%;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: normal;
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
    background: #D2C6D5;
    color: #410066;
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
    border-radius: 14px;
    padding: 16px 14px;
    background: #F1F1F1;
    color: #111;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.45;
    outline: none;
  }
  .prompt-float__text::placeholder { color: rgba(20, 20, 22, 0.38); }
  .prompt-float__text.prompt-float__instructions-body {
    background: #F1F1F1;
    color: #1a1a1a;
    white-space: pre-wrap;
  }
  .prompt-float__instructions-body[data-empty="true"]::before {
    content: attr(data-placeholder);
    color: rgba(26, 26, 26, 0.38);
  }
  .prompt-float__instructions-body strong,
  .prompt-body__editor strong { font-weight: 700; }
  .prompt-float__instructions-body em,
  .prompt-body__editor em { font-style: italic; }
  .prompt-float__instructions-body u,
  .prompt-body__editor u { text-decoration: underline; }
  .prompt-float__instructions-body s,
  .prompt-body__editor s { text-decoration: line-through; }
  .prompt-float__instructions-body mark,
  .prompt-body__editor mark { background: #f4e7a3; color: inherit; }
  .prompt-body__editor[data-empty="true"]::before,
  .prompt-body__editor[data-empty]::before {
    color: rgba(20, 20, 22, 0.38);
  }
  .prompt-float__text {
    scrollbar-width: thin;
    scrollbar-color: rgba(20, 20, 22, 0.28) #F1F1F1;
  }
  .prompt-float__text::-webkit-scrollbar { width: 8px; height: 8px; }
  .prompt-float__text::-webkit-scrollbar-track { background: #F1F1F1; }
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
    flex: 0 0 auto;
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
