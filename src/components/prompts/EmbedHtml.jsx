import { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../../lib/copyToClipboard.js';

const DEFAULTS = {
  background: '#ffffff',
  color: '#000000',
  button: '#f4f1eb',
};

const DESIGN_STORE = 'fn-embed-designs';
const MAX_DESIGNS = 24;

const FORMATS = [
  { id: 'bold', label: 'Bold', command: 'bold' },
  { id: 'italic', label: 'Italic', command: 'italic' },
  { id: 'underline', label: 'Underline', command: 'underline' },
  { id: 'strike', label: 'Strikethrough', command: 'strikeThrough' },
  { id: 'highlight', label: 'Highlight', command: 'highlight' },
];

const SCROLL_AT = 760;

const COPY_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="display:block;flex:none"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.16667 2.99935C5.16667 1.98683 5.98748 1.16602 7 1.16602H11.6667C12.6792 1.16602 13.5 1.98683 13.5 2.99935V10.3327C13.5 11.3452 12.6792 12.166 11.6667 12.166H7C5.98748 12.166 5.16667 11.3452 5.16667 10.3327V2.99935ZM7 2.16602C6.53976 2.16602 6.16667 2.53911 6.16667 2.99935V10.3327C6.16667 10.7929 6.53976 11.166 7 11.166H11.6667C12.1269 11.166 12.5 10.7929 12.5 10.3327V2.99935C12.5 2.53911 12.1269 2.16602 11.6667 2.16602H7ZM3 4.83268C3.27614 4.83268 3.5 5.05654 3.5 5.33268V12.9993C3.5 13.4596 3.8731 13.8327 4.33333 13.8327H9C9.27614 13.8327 9.5 14.0565 9.5 14.3327C9.5 14.6088 9.27614 14.8327 9 14.8327H4.33333C3.32081 14.8327 2.5 14.0119 2.5 12.9993V5.33268C2.5 5.05654 2.72386 4.83268 3 4.83268Z" fill="currentColor"></path></svg>';

function hexColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function readableOn(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const y = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return y > 150 ? '#151515' : '#ffffff';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trimMeta(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function embedJsonLd(title, description, keywords) {
  if (!title && !description && !keywords) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
  };
  if (title) data.name = title;
  if (description) data.description = description;
  if (keywords) data.keywords = keywords;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `\n  <script type="application/ld+json">${json}</script>`;
}

function embedMetaAttrs(title, description, keywords) {
  const parts = [];
  if (title) parts.push(`data-fn-title="${escapeHtml(title)}"`);
  if (description) parts.push(`data-fn-description="${escapeHtml(description)}"`);
  if (keywords) parts.push(`data-fn-keywords="${escapeHtml(keywords)}"`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

function promptCardStyles(background, color, button) {
  const box = hexColor(background, DEFAULTS.background);
  const ink = hexColor(color, DEFAULTS.color);
  const fill = hexColor(button, DEFAULTS.button);
  const buttonInk = readableOn(fill);
  return { box, ink, fill, buttonInk };
}

function sameColors(a, b) {
  return hexColor(a.background, DEFAULTS.background) === hexColor(b.background, DEFAULTS.background)
    && hexColor(a.color, DEFAULTS.color) === hexColor(b.color, DEFAULTS.color)
    && hexColor(a.button, DEFAULTS.button) === hexColor(b.button, DEFAULTS.button);
}

function designLabel(index) {
  return `Design ${String(index + 1).padStart(2, '0')}`;
}

function isDesign(item) {
  return Boolean(item)
    && typeof item.id === 'string'
    && item.id.length > 0
    && /^#[0-9a-fA-F]{6}$/.test(item.background || '')
    && /^#[0-9a-fA-F]{6}$/.test(item.color || '')
    && /^#[0-9a-fA-F]{6}$/.test(item.button || '');
}

function loadDesignStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DESIGN_STORE) || 'null');
    const designs = Array.isArray(parsed?.designs)
      ? parsed.designs.filter(isDesign).slice(0, MAX_DESIGNS).map((item) => ({
        id: item.id,
        background: item.background.toLowerCase(),
        color: item.color.toLowerCase(),
        button: item.button.toLowerCase(),
      }))
      : [];
    const activeId = designs.some((item) => item.id === parsed?.activeId) ? parsed.activeId : null;
    return { designs, activeId };
  } catch {
    return { designs: [], activeId: null };
  }
}

function plainFrom(root) {
  const parts = [];
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'BR') {
      parts.push('\n');
      return;
    }
    const block = node.tagName === 'DIV' || node.tagName === 'P';
    if (block && parts.length && !String(parts[parts.length - 1]).endsWith('\n')) parts.push('\n');
    node.childNodes.forEach(walk);
  }
  root.childNodes.forEach(walk);
  return parts.join('').replace(/\u200b/g, '').replace(/\n$/, '');
}

function serializeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml((node.nodeValue || '').replace(/\u200b/g, ''));
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName;
  if (tag === 'BR') return '<br>';
  const inner = [...node.childNodes].map(serializeNode).join('');
  const style = node.getAttribute('style') || '';
  const bold = tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/i.test(style);
  const italic = tag === 'I' || tag === 'EM' || /font-style:\s*italic/i.test(style);
  const underline = tag === 'U' || /text-decoration[^;]*underline/i.test(style);
  const strike = tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/i.test(style);
  const highlight = tag === 'MARK' || hasHighlight(style);
  if (tag === 'DIV' || tag === 'P') return `${inner || '<br>'}<br>`;
  let out = inner;
  if (highlight) out = `<mark style="background:#f4e7a3;color:inherit">${out}</mark>`;
  if (strike) out = `<s>${out}</s>`;
  if (underline) out = `<u>${out}</u>`;
  if (italic) out = `<em>${out}</em>`;
  if (bold) out = `<strong>${out}</strong>`;
  return out;
}

function serializeEditor(root) {
  return [...root.childNodes].map(serializeNode).join('').replace(/(?:<br>)+$/, '');
}

function hasHighlight(style) {
  return /background(?:-color)?:\s*(?!transparent\b|inherit\b|none\b|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))/i.test(style);
}

function matchesKind(node, kind) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = node.tagName;
  const style = node.getAttribute('style') || '';
  if (kind === 'bold') return tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/i.test(style);
  if (kind === 'italic') return tag === 'I' || tag === 'EM' || /font-style:\s*italic/i.test(style);
  if (kind === 'underline') return tag === 'U' || /text-decoration[^;]*underline/i.test(style);
  if (kind === 'strike') return tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/i.test(style);
  if (kind === 'highlight') return tag === 'MARK' || hasHighlight(style);
  return false;
}

function kindOf(command) {
  if (command === 'strikeThrough') return 'strike';
  return command;
}

function exitFormat(root, kind) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return false;
  let node = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  let target = null;
  while (node && node !== root) {
    if (matchesKind(node, kind)) target = node;
    node = node.parentElement;
  }
  if (!target?.parentNode) return false;
  if (range.startContainer.nodeType === Node.TEXT_NODE && target.contains(range.startContainer)) {
    const offset = range.startOffset;
    if (offset > 0 && offset < range.startContainer.length) range.startContainer.splitText(offset);
  }
  const after = document.createRange();
  after.selectNodeContents(target);
  after.setStart(range.startContainer, range.startOffset);
  const fragment = after.extractContents();
  const parent = target.parentNode;
  const marker = document.createTextNode('');
  let caretNode = marker;
  let caretOffset = 0;
  if (kind === 'highlight') {
    const barrier = document.createElement('span');
    barrier.setAttribute('data-fn-break', '');
    barrier.appendChild(document.createTextNode('\u200b'));
    caretNode = barrier.firstChild;
    caretOffset = 1;
    parent.insertBefore(barrier, target.nextSibling);
  } else {
    parent.insertBefore(marker, target.nextSibling);
  }
  if (fragment.childNodes.length) parent.insertBefore(fragment, (kind === 'highlight' ? caretNode.parentNode : marker).nextSibling);
  if (!target.textContent) target.remove();
  const next = document.createRange();
  next.setStart(caretNode, caretOffset);
  next.collapse(true);
  selection.removeAllRanges();
  selection.addRange(next);
  return true;
}

function marksAtSelection(root) {
  const found = { bold: false, italic: false, underline: false, strike: false, highlight: false };
  const selection = window.getSelection();
  if (!selection || !root || !selection.anchorNode || !root.contains(selection.anchorNode)) return found;
  let node = selection.anchorNode.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode.parentElement;
  while (node && node !== root) {
    const tag = node.tagName;
    const style = node.getAttribute?.('style') || '';
    if (tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/i.test(style)) found.bold = true;
    if (tag === 'I' || tag === 'EM' || /font-style:\s*italic/i.test(style)) found.italic = true;
    if (tag === 'U' || /underline/i.test(style)) found.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || /line-through/i.test(style)) found.strike = true;
    if (tag === 'MARK' || hasHighlight(style)) found.highlight = true;
    node = node.parentElement;
  }
  try {
    if (document.queryCommandState('bold')) found.bold = true;
    if (document.queryCommandState('italic')) found.italic = true;
    if (document.queryCommandState('underline')) found.underline = true;
    if (document.queryCommandState('strikeThrough')) found.strike = true;
  } catch {
    /* The caret is outside the prompt. */
  }
  return found;
}

function ToolIcon({ name }) {
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

export function buildPromptEmbed({
  text,
  markup = '',
  background,
  color,
  button,
  metaTitle = '',
  metaDescription = '',
  metaKeywords = '',
}) {
  const { box, ink, fill, buttonInk } = promptCardStyles(background, color, button);
  const safe = escapeHtml(text);
  const body = markup.trim() ? markup : safe;
  const overflow = String(text).length > SCROLL_AT;
  const title = trimMeta(metaTitle);
  const description = trimMeta(metaDescription);
  const keywords = trimMeta(metaKeywords);
  const textStyle = [
    'white-space:pre-wrap',
    'overflow-wrap:anywhere',
    'font:16px/1.5 ui-sans-serif,system-ui,sans-serif',
    overflow ? 'max-height:96px' : 'max-height:none',
    overflow ? 'overflow-y:auto' : 'overflow:visible',
  ].join(';');
  const fade = overflow
    ? `<div style="pointer-events:none;position:absolute;left:0;right:0;bottom:0;height:32px;background:linear-gradient(to top, ${box}, transparent)"></div>`
    : '';
  return `<!-- REFERENCE: CUT THIS WHOLE BLOCK -->
<div data-fn-embed${embedMetaAttrs(title, description, keywords)} style="width:100%;max-width:960px">${embedJsonLd(title, description, keywords)}
  <div style="box-sizing:border-box;position:relative;width:100%;padding:20px;border-radius:12px;background:${box};color:${ink}">
    <div style="position:relative">
      <div style="${textStyle}">${body}</div>
      ${fade}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px">
      <button type="button" data-fn-prompt="${safe}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 12px;border:1px solid ${buttonInk}33;border-radius:6px;background:${fill};color:${buttonInk};font:500 13px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;white-space:nowrap">${COPY_ICON}<span>Copy</span></button>
    </div>
  </div>
</div>
<script>
(function () {
  var script = document.currentScript;
  var root = script && script.previousElementSibling;
  if (!root || !root.hasAttribute || !root.hasAttribute("data-fn-embed")) {
    var nodes = document.querySelectorAll("[data-fn-embed]");
    root = null;
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].getAttribute("data-fn-ready")) root = nodes[i];
    }
  }
  if (!root || root.getAttribute("data-fn-ready")) return;
  root.setAttribute("data-fn-ready", "1");
  var button = root.querySelector("button");
  if (button) {
    var copyLabel = button.querySelector("span");
    button.addEventListener("click", function () {
      var text = button.getAttribute("data-fn-prompt") || "";
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(text).then(function () {
        if (!copyLabel) return;
        var previous = copyLabel.textContent;
        copyLabel.textContent = "Copied";
        setTimeout(function () { copyLabel.textContent = previous; }, 1200);
      });
    });
  }
  var editor = false;
  try {
    editor = !!(window.Shopify && window.Shopify.designMode) || !!(window.wp && window.wp.customize);
  } catch (error) {}
  if (!editor || root.querySelector("[data-fn-setup]")) return;
  root.style.boxSizing = "border-box";
  root.style.background = "#f4e7a3";
  root.style.padding = "12px";
  var note = document.createElement("p");
  note.setAttribute("data-fn-setup", "");
  note.textContent = "Cut this whole block to remove it.";
  note.style.cssText = "margin:0 0 10px;text-align:center;font:600 13px/1.4 ui-sans-serif,system-ui,sans-serif;color:#151515";
  root.insertBefore(note, root.firstChild);
})();
</script>
<!-- REFERENCE: END OF THE BLOCK -->`;
}

const HOW_PAGES = [
  {
    title: 'What Do Metadata Mean for Your Embed Text Box?',
    cards: [
      (
        <p>
          <strong>Metadata</strong> is the digital ID card of your content. They are invisible data tags to regular visitors, but essential for search engines like Google and web platforms to understand exactly what your text is about.
        </p>
      ),
      (
        <p>
          When you use <strong>Embed Text Box</strong>, these tags are set up to boost your visibility every time you embed your widget into a website or online store.
        </p>
      ),
    ],
  },
  {
    title: 'Why Are They Vital for Your Content?',
    cards: [
      (
        <p>
          <strong>Direct SEO and Indexing.</strong> Your Embed Text Box communicates your publication&apos;s exact topic, main keywords, and website purpose directly to Google, helping you rank for the right searches.
        </p>
      ),
      (
        <p>
          <strong>Accurate Topic Recognition.</strong> By properly structuring the <strong>Meta Title</strong> and <strong>Meta Description</strong> within the metadata, search algorithms can better categorize your content and show it to users interested in your niche.
        </p>
      ),
      (
        <p>
          <strong>Clean Previews When Shared.</strong> When your page link or embedded content is shared across social media or messaging apps (like <strong>WhatsApp</strong>, <strong>Facebook</strong>, or <strong>LinkedIn</strong>), metadata ensures a clear title and an engaging summary are displayed.
        </p>
      ),
      (
        <>
          <p>
            <strong>Practical Example: A Recipe Blog in Your Embed Text Box.</strong> If you are embedding or sharing cooking content:
          </p>
          <p><strong>Meta Title:</strong> Easy Home Cooking Recipes | My Blog</p>
          <p><strong>Meta Description:</strong> Learn step-by-step how to prepare quick desserts and delicious dinners in under 30 minutes.</p>
          <p><strong>Meta Keywords:</strong> easy recipes, home cooking, quick desserts</p>
          <p>
            With <strong>Embed Text Box</strong>, you don&apos;t just ensure your text looks great on your site—you also give Google the exact information it needs to rank your content and drive more readers to you.
          </p>
        </>
      ),
    ],
  },
];

const TAG_COLORS = ['#E8C4B8', '#C5D4E8', '#D4E8C5', '#E8D9B8', '#D4C5E8', '#C5E8E0'];

function keywordList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function KeywordTags({ value, onChange }) {
  const [draft, setDraft] = useState('');
  const tags = keywordList(value);

  function commit(raw) {
    const next = String(raw || '').replace(/,+$/, '').trim();
    if (!next) {
      setDraft('');
      return;
    }
    if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...tags, next].join(', '));
    setDraft('');
  }

  return (
    <div className="prompt-embed__tags">
      {tags.map((tag, index) => (
        <button
          key={`${tag}-${index}`}
          type="button"
          className="prompt-embed__tag"
          style={{ background: TAG_COLORS[index % TAG_COLORS.length] }}
          aria-label={`Remove ${tag}`}
          onClick={() => onChange(tags.filter((_, item) => item !== index).join(', '))}
        >
          {tag}
        </button>
      ))}
      <input
        value={draft}
        aria-label="Meta Keywords"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit(draft);
          }
          if (event.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1).join(', '));
          }
        }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}

function HowGuide({ page, onPage, onClose }) {
  const current = HOW_PAGES[page] || HOW_PAGES[0];
  const last = page >= HOW_PAGES.length - 1;
  return (
    <div
      className="prompt-embed__overlay prompt-embed__overlay--drop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-embed-how-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="prompt-embed__sheet prompt-embed__sheet--how scroll-match-bg">
        <button type="button" className="prompt-embed__sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="prompt-embed__how-hero" aria-hidden="true" />
        <h2 id="prompt-embed-how-title">{current.title}</h2>
        <div className="prompt-embed__how-steps">
          {current.cards.map((card, index) => (
            <article key={index} className="prompt-embed__how-card">{card}</article>
          ))}
        </div>
        <div className="prompt-embed__how-nav">
          {page > 0 ? (
            <button type="button" className="prompt-embed__action" onClick={() => onPage(page - 1)}>
              Back
            </button>
          ) : <span />}
          <p className="prompt-embed__how-count" aria-live="polite">{page + 1} / {HOW_PAGES.length}</p>
          {last ? (
            <button type="button" className="prompt-embed__action" onClick={onClose}>
              Done
            </button>
          ) : (
            <button type="button" className="prompt-embed__action" onClick={() => onPage(page + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaEditor({
  title,
  description,
  keywords,
  onTitle,
  onDescription,
  onKeywords,
  onSave,
  onHow,
  onClose,
}) {
  return (
    <div
      className="prompt-embed__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-embed-meta-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="prompt-embed__sheet prompt-embed__sheet--meta"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <button type="button" className="prompt-embed__sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="prompt-embed-meta-title">Metadata</h2>
        <label className="prompt-embed__sheet-field">
          <span>Meta Title</span>
          <input
            type="text"
            value={title}
            maxLength={70}
            aria-label="Meta Title"
            onChange={(event) => onTitle(event.target.value)}
          />
        </label>
        <label className="prompt-embed__sheet-field">
          <span>Meta Description</span>
          <textarea
            value={description}
            maxLength={160}
            rows={4}
            aria-label="Meta Description"
            onChange={(event) => onDescription(event.target.value)}
          />
        </label>
        <label className="prompt-embed__sheet-field">
          <span>Meta Keywords</span>
          <KeywordTags value={keywords} onChange={onKeywords} />
        </label>
        <button type="submit" className="prompt-embed__sheet-save">
          Save
        </button>
        <button type="button" className="prompt-embed__learn" onClick={onHow}>
          Learn how it work
        </button>
      </form>
    </div>
  );
}

function EmbedAllowance({ plan }) {
  const pro = plan === 'pro';
  return (
    <div
      className={pro ? 'prompt-embed__allow is-pro' : 'prompt-embed__allow'}
      role="status"
      aria-label={pro ? 'Unlimited embeds' : '3 embeds al día, de por vida'}
    >
      {pro ? (
        <strong>Unlimited</strong>
      ) : (
        <>
          <span className="prompt-embed__allow-life" aria-hidden="true">∞</span>
          <strong>3</strong>
          <small>Se renueva cada día</small>
        </>
      )}
    </div>
  );
}

export default function EmbedHtml({ plan = 'free' }) {
  const storedDesigns = useMemo(() => loadDesignStore(), []);
  const activeDesign = storedDesigns.designs.find((item) => item.id === storedDesigns.activeId);
  const [text, setText] = useState('');
  const [background, setBackground] = useState(activeDesign?.background || DEFAULTS.background);
  const [color, setColor] = useState(activeDesign?.color || DEFAULTS.color);
  const [button, setButton] = useState(activeDesign?.button || DEFAULTS.button);
  const [markup, setMarkup] = useState('');
  const [designs, setDesigns] = useState(storedDesigns.designs);
  const [activeId, setActiveId] = useState(storedDesigns.activeId);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [designNote, setDesignNote] = useState('');
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, strike: false, highlight: false });
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [howPage, setHowPage] = useState(0);
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftKeywords, setDraftKeywords] = useState('');
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const designRef = useRef(null);
  const html = useMemo(
    () => buildPromptEmbed({
      text,
      markup,
      background,
      color,
      button,
      metaTitle,
      metaDescription,
      metaKeywords,
    }),
    [text, markup, background, color, button, metaTitle, metaDescription, metaKeywords],
  );
  const card = promptCardStyles(background, color, button);
  const overflow = text.length > SCROLL_AT;
  const activeIndex = designs.findIndex((item) => item.id === activeId);
  const applied = activeIndex >= 0 ? designs[activeIndex] : null;
  const dirty = !sameColors({ background, color, button }, applied || DEFAULTS);

  function sync() {
    const root = editorRef.current;
    if (!root) return;
    setText(plainFrom(root));
    setMarkup(serializeEditor(root));
    setActive(marksAtSelection(root));
  }

  function saveRange() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    savedRange.current = range.cloneRange();
  }

  function restoreRange() {
    const range = savedRange.current;
    const root = editorRef.current;
    if (!range || !root) return;
    root.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function applyFormat(command) {
    const root = editorRef.current;
    restoreRange();
    root?.focus();
    const selection = window.getSelection();
    const collapsed = !selection?.rangeCount || selection.getRangeAt(0).collapsed;
    const kind = kindOf(command);
    if (collapsed && root && marksAtSelection(root)[kind]) {
      if (!exitFormat(root, kind)) {
        document.execCommand('styleWithCSS', false, false);
        document.execCommand(command === 'highlight' ? 'removeFormat' : command, false, null);
      } else if (command !== 'highlight') {
        document.execCommand('styleWithCSS', false, false);
        try {
          if (document.queryCommandState(command)) document.execCommand(command, false, null);
        } catch {
          /* The caret is already outside the mark. */
        }
      }
    } else if (command === 'highlight') {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('hiliteColor', false, '#f4e7a3');
    } else {
      document.execCommand('styleWithCSS', false, false);
      document.execCommand(command, false, null);
    }
    sync();
    saveRange();
  }

  function placeCaretAtStart(event) {
    const root = editorRef.current;
    if (!root || plainFrom(root).length) return;
    event.preventDefault();
    root.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(root, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange.current = range.cloneRange();
  }

  useEffect(() => {
    function onSelection() {
      const root = editorRef.current;
      if (!root) return;
      const selection = window.getSelection();
      if (!selection?.anchorNode || !root.contains(selection.anchorNode)) return;
      saveRange();
      setActive(marksAtSelection(root));
    }
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  useEffect(() => {
    if (!codeOpen && !designsOpen && !howOpen && !metaOpen) return undefined;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      if (designsOpen) setDesignsOpen(false);
      if (codeOpen) setCodeOpen(false);
      if (howOpen) setHowOpen(false);
      if (metaOpen) setMetaOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [codeOpen, designsOpen, howOpen, metaOpen]);

  useEffect(() => {
    if (!designsOpen) return undefined;
    function onPointer(event) {
      if (!designRef.current?.contains(event.target)) setDesignsOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [designsOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_STORE, JSON.stringify({ designs, activeId }));
    } catch {
      /* The browser refused the design list. */
    }
  }, [designs, activeId]);

  useEffect(() => {
    try {
      localStorage.removeItem('fn-embed-logo');
    } catch {
      /* The stored icon is already gone. */
    }
  }, []);

  function applyDesign(design) {
    setBackground(design.background);
    setColor(design.color);
    setButton(design.button);
    setActiveId(design.id);
    setDesignsOpen(false);
    setDesignNote('');
  }

  function saveDesign() {
    if (!dirty) return;
    if (designs.length >= MAX_DESIGNS) {
      setDesignNote('24 designs max.');
      return;
    }
    const next = {
      id: crypto.randomUUID(),
      background: card.box,
      color: card.ink,
      button: card.fill,
    };
    setDesigns((list) => [...list, next]);
    setActiveId(next.id);
    setDesignNote('');
    setDesignsOpen(false);
  }

  function removeDesign(id) {
    const next = designs.filter((item) => item.id !== id);
    setDesigns(next);
    setDesignNote('');
    if (id !== activeId) return;
    const match = next.find((item) => sameColors(item, { background, color, button }));
    setActiveId(match ? match.id : null);
  }

  async function copyEmbed() {
    const ok = await copyToClipboard(html);
    if (!ok) return;
    setCopiedEmbed(true);
    window.setTimeout(() => setCopiedEmbed(false), 1200);
  }

  async function copyPrompt() {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1200);
  }

  function openMeta() {
    setDraftTitle(metaTitle);
    setDraftDescription(metaDescription);
    setDraftKeywords(metaKeywords);
    setCodeOpen(false);
    setHowOpen(false);
    setMetaOpen(true);
  }

  function saveMeta() {
    setMetaTitle(draftTitle);
    setMetaDescription(draftDescription);
    setMetaKeywords(draftKeywords);
    setMetaOpen(false);
  }

  function openHow() {
    setCodeOpen(false);
    setHowPage(0);
    setHowOpen(true);
  }

  return (
    <div className="prompt-desk__page prompt-embed">
      <header className="prompt-desk__bar">
        <h1 className="prompt-desk__mark">Embed Html</h1>
      </header>
      <div className="prompt-embed__body">
        <div className="prompt-embed__stage">
          <div className="prompt-embed__box" style={{ background: card.box, color: card.ink }}>
            <div className="prompt-embed__text-wrap">
              <div
                ref={editorRef}
                className={overflow ? 'prompt-embed__text is-scroll' : 'prompt-embed__text'}
                contentEditable
                role="textbox"
                aria-label="Prompt"
                aria-multiline="true"
                data-placeholder="Insert Prompt"
                data-empty={text.length ? undefined : ''}
                onMouseDown={placeCaretAtStart}
                onInput={sync}
                onKeyUp={sync}
                onMouseUp={() => { saveRange(); sync(); }}
              />
              {overflow ? <div className="prompt-embed__fade" style={{ background: `linear-gradient(to top, ${card.box}, transparent)` }} /> : null}
            </div>
            <div className="prompt-embed__actions">
              <button
                type="button"
                style={{ background: card.fill, color: card.buttonInk, borderColor: `${card.buttonInk}33` }}
                onClick={() => { void copyPrompt(); }}
              >
                <span dangerouslySetInnerHTML={{ __html: COPY_ICON }} />
                <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <div className="prompt-embed__bars">
          <EmbedAllowance plan={plan} />
          <div className="prompt-embed__toolbar" role="toolbar" aria-label="Embed tools">
            {FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={active[item.id] ? 'prompt-embed__icon is-active' : 'prompt-embed__icon'}
                aria-label={item.label}
                aria-pressed={active[item.id]}
                data-tip={item.label}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyFormat(item.command);
                }}
              >
                <ToolIcon name={item.id} />
              </button>
            ))}
            <button type="button" className="prompt-embed__action" onClick={() => { void copyEmbed(); }}>
              {copiedEmbed ? 'Copied' : 'Copy embed'}
            </button>
            <button
              type="button"
              className="prompt-embed__action"
              aria-expanded={codeOpen}
              onClick={() => {
                setHowOpen(false);
                setMetaOpen(false);
                setCodeOpen(true);
              }}
            >
              View embed
            </button>
            <button
              type="button"
              className="prompt-embed__action"
              aria-expanded={metaOpen}
              onClick={openMeta}
            >
              Add metadata
            </button>
          </div>
          <div className="prompt-embed__toolbar prompt-embed__colors" role="toolbar" aria-label="Colors">
            <label className="prompt-embed__tool">
              <span>Background</span>
              <input type="color" value={background} aria-label="Background" onChange={(event) => setBackground(event.target.value)} />
            </label>
            <label className="prompt-embed__tool">
              <span>Text</span>
              <input type="color" value={color} aria-label="Text" onChange={(event) => setColor(event.target.value)} />
            </label>
            <label className="prompt-embed__tool">
              <span>Button</span>
              <input type="color" value={button} aria-label="Button" onChange={(event) => setButton(event.target.value)} />
            </label>
            {designs.length ? (
              <div className="prompt-embed__designs" ref={designRef}>
                <button
                  type="button"
                  className="prompt-embed__action"
                  aria-haspopup="listbox"
                  aria-expanded={designsOpen}
                  onClick={() => setDesignsOpen((open) => !open)}
                >
                  Select design
                </button>
                {designsOpen ? (
                  <ul className="prompt-embed__design-menu scroll-match-bg" role="listbox" aria-label="Select design">
                    {designs.map((item, index) => (
                      <li key={item.id} className="prompt-embed__design-row">
                        <button
                          type="button"
                          role="option"
                          aria-selected={item.id === activeId}
                          className={item.id === activeId ? 'prompt-embed__design-pick is-active' : 'prompt-embed__design-pick'}
                          onClick={() => applyDesign(item)}
                        >
                          <span>{designLabel(index)}</span>
                          <span className="prompt-embed__swatch" style={{ background: item.background }} />
                        </button>
                        <button
                          type="button"
                          className="prompt-embed__design-remove"
                          aria-label={`Remove ${designLabel(index)}`}
                          onClick={() => removeDesign(item.id)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          {dirty ? (
            <div className="prompt-embed__toolbar prompt-embed__save">
              <button type="button" className="prompt-embed__action" onClick={saveDesign}>
                Save design
              </button>
            </div>
          ) : null}
          {designNote ? <p className="prompt-embed__note" role="status">{designNote}</p> : null}
          </div>
        </div>
      </div>
      {codeOpen ? (
        <div
          className="prompt-embed__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Embed code"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCodeOpen(false);
          }}
        >
          <div className="prompt-embed__overlay-card">
            <h2>Embed code</h2>
            <pre>{html}</pre>
            <button type="button" onClick={() => { void copyEmbed(); }}>
              {copiedEmbed ? 'Copied' : 'Copy embed'}
            </button>
          </div>
        </div>
      ) : null}
      {howOpen ? (
        <HowGuide
          page={howPage}
          onPage={setHowPage}
          onClose={() => setHowOpen(false)}
        />
      ) : null}
      {metaOpen ? (
        <MetaEditor
          title={draftTitle}
          description={draftDescription}
          keywords={draftKeywords}
          onTitle={setDraftTitle}
          onDescription={setDraftDescription}
          onKeywords={setDraftKeywords}
          onSave={saveMeta}
          onHow={openHow}
          onClose={() => setMetaOpen(false)}
        />
      ) : null}
    </div>
  );
}
