import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { markFromInlineStyle } from '../../lib/promptInlineMark.js';
import { documentVariables, dropUnknownTokens, parsePrompt, variableIsEmpty } from '../../lib/promptVariables.js';

function fieldText(variable) {
  if (!variable) return '[?]';
  return variableIsEmpty(variable) ? `[${variable.name || '?'}]` : variable.value;
}

function makeChip(doc, variable) {
  const span = doc.createElement('span');
  span.className = variableIsEmpty(variable) ? 'prompt-var' : 'prompt-var prompt-var--filled';
  span.contentEditable = 'false';
  span.dataset.varId = variable?.id || '';
  span.textContent = fieldText(variable);
  return span;
}

const MARKS = {
  STRONG: 'strong',
  B: 'strong',
  EM: 'em',
  I: 'em',
  U: 'u',
  S: 's',
  STRIKE: 's',
  MARK: 'mark',
  H1: 'h1',
  UL: 'ul',
  LI: 'li',
};

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function styleMark(node) {
  return markFromInlineStyle(node.getAttribute('style') || '');
}

function appendText(doc, parent, text) {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) parent.appendChild(doc.createElement('br'));
    if (line) parent.appendChild(doc.createTextNode(line));
  });
}

const PASTE_MARKS = {
  STRONG: 'strong',
  B: 'strong',
  EM: 'em',
  I: 'em',
  U: 'u',
  S: 's',
  STRIKE: 's',
  MARK: 'mark',
  H1: 'h1',
  UL: 'ul',
  LI: 'li',
};

function clipboardMark(node) {
  const tag = node.tagName;
  const style = node.getAttribute('style') || '';
  if ((tag === 'B' || tag === 'STRONG') && /font-weight:\s*(normal|400)/i.test(style)) {
    return markFromInlineStyle(style);
  }
  if ((tag === 'I' || tag === 'EM') && /font-style:\s*normal/i.test(style)) {
    return markFromInlineStyle(style);
  }
  if (PASTE_MARKS[tag]) return PASTE_MARKS[tag];
  if (tag === 'SPAN') return markFromInlineStyle(style);
  return '';
}

function appendClipboard(doc, parent, node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent) parent.appendChild(doc.createTextNode(node.textContent));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.tagName === 'BR') {
    parent.appendChild(doc.createElement('br'));
    return;
  }
  const mark = clipboardMark(node);
  if (mark) {
    const el = doc.createElement(mark);
    for (const child of node.childNodes) appendClipboard(doc, el, child);
    parent.appendChild(el);
    return;
  }
  if (node.tagName === 'DIV' || node.tagName === 'P' || node.tagName === 'LI') {
    if (parent.childNodes.length) parent.appendChild(doc.createElement('br'));
  }
  for (const child of node.childNodes) appendClipboard(doc, parent, child);
}

function readTemplate(root) {
  let out = '';
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escapeHtml(node.textContent.replace(/\u00a0/g, ' ').replace(/\u200B/g, ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.dataset?.varId) {
      out += `{{${node.dataset.varId}}}`;
      return;
    }
    if (node.tagName === 'BR') {
      out += '\n';
      return;
    }
    const mark = MARKS[node.tagName] || (node.tagName === 'SPAN' ? styleMark(node) : '');
    if (mark) {
      const open = mark === 'mark' && node.classList.contains('is-platform')
        ? '<mark class="is-platform">'
        : `<${mark}>`;
      out += open;
      for (const child of node.childNodes) walk(child);
      out += `</${mark}>`;
      return;
    }
    if (node.tagName === 'DIV' || node.tagName === 'P') {
      if (out && !out.endsWith('\n')) out += '\n';
      for (const child of node.childNodes) walk(child);
      return;
    }
    for (const child of node.childNodes) walk(child);
  };
  for (const child of root.childNodes) walk(child);
  return out;
}

export function readMarked(root) {
  return root ? readTemplate(root) : '';
}

function hasMarks(source) {
  return /<\/?(?:strong|em|u|s|mark|h1|ul|li)\b/i.test(source || '');
}

function currentListItem(root) {
  const selection = root?.ownerDocument?.getSelection();
  if (!root || !selection?.rangeCount || !root.contains(selection.anchorNode)) return null;
  let node = selection.anchorNode;
  if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
  const item = node?.closest?.('li');
  if (!item || !root.contains(item)) return null;
  return item;
}

function itemIsEmpty(item) {
  return !item?.textContent.replace(/\u00a0/g, ' ').replace(/\u200B/g, '').trim()
    && !item?.querySelector?.('[data-var-id]');
}

function focusItem(doc, item) {
  if (!item) return;
  if (itemIsEmpty(item)) item.replaceChildren(doc.createTextNode(''));
  const text = item.firstChild?.nodeType === Node.TEXT_NODE ? item.firstChild : item;
  placeCaret(doc, text, 0);
}

export function caretInBullet(root) {
  return Boolean(currentListItem(root));
}

export function applyBulletPoint(root) {
  if (!root) return false;
  const doc = root.ownerDocument;
  if (currentListItem(root)) return true;
  doc.execCommand('styleWithCSS', false, false);
  doc.execCommand('insertUnorderedList', false, null);
  let item = currentListItem(root);
  if (!item) {
    const list = doc.createElement('ul');
    item = doc.createElement('li');
    item.appendChild(doc.createTextNode(''));
    list.appendChild(item);
    root.appendChild(list);
  }
  focusItem(doc, item);
  return true;
}

export function continueBullet(root) {
  const item = currentListItem(root);
  const list = item?.parentElement;
  if (!item || list?.tagName !== 'UL' || !root.contains(list)) return false;
  if (itemIsEmpty(item)) return releaseBullet(root);
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  const range = selection.getRangeAt(0);
  const next = doc.createElement('li');
  if (item.contains(range.startContainer) || range.startContainer === item) {
    const tail = doc.createRange();
    tail.selectNodeContents(item);
    tail.setStart(range.startContainer, range.startOffset);
    const rest = tail.extractContents();
    if (rest.textContent.replace(/\u00a0/g, ' ').trim() || rest.querySelector?.('[data-var-id]')) {
      next.appendChild(rest);
    }
  }
  if (!next.firstChild) next.appendChild(doc.createTextNode(''));
  if (item.nextSibling) list.insertBefore(next, item.nextSibling);
  else list.appendChild(next);
  if (itemIsEmpty(item)) item.replaceChildren(doc.createTextNode(''));
  focusItem(doc, next);
  return true;
}

export function releaseBullet(root) {
  const item = currentListItem(root);
  const list = item?.parentElement;
  if (!item || list?.tagName !== 'UL' || !itemIsEmpty(item)) return false;
  const doc = root.ownerDocument;
  const text = doc.createTextNode('');
  item.remove();
  if (!list.querySelector('li')) list.replaceWith(text);
  else list.after(text);
  placeCaret(doc, text, 0);
  return true;
}

export function paintMarked(root, source, variables, { chips = true } = {}) {
  const doc = root.ownerDocument;
  const value = source || '';
  root.replaceChildren();
  const writeText = (parent, text) => {
    const parts = chips ? parsePrompt(text) : [{ type: 'text', text }];
    for (const part of parts) {
      if (part.type === 'text') appendText(doc, parent, part.text);
      else {
        const variable = (variables || []).find((item) => item.id === part.id);
        if (!variable) continue;
        parent.appendChild(makeChip(doc, variable));
      }
    }
  };
  if (!hasMarks(value)) {
    writeText(root, value);
    return;
  }
  const holder = doc.createElement('template');
  holder.innerHTML = value.replace(/\n/g, '<br>');
  const walk = (from, to) => {
    for (const node of [...from.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) {
        writeText(to, node.textContent);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName === 'BR') {
        to.appendChild(doc.createElement('br'));
        continue;
      }
      const mark = MARKS[node.tagName];
      if (!mark) {
        walk(node, to);
        continue;
      }
      const el = doc.createElement(mark);
      if (mark === 'mark' && /\bis-platform\b/.test(node.getAttribute('class') || '')) {
        el.classList.add('is-platform');
      }
      walk(node, el);
      if (mark === 'h1' && !el.textContent.replace(/\u00a0/g, ' ').trim()) {
        el.dataset.empty = 'true';
        el.appendChild(doc.createTextNode(''));
      }
      to.appendChild(el);
    }
  };
  walk(holder.content, root);
}

function mentionAtCaret(root) {
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  if (!selection || !selection.rangeCount || !root.contains(selection.anchorNode)) return null;
  const node = selection.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent.slice(0, selection.anchorOffset);
  const match = text.match(/@([^\s@]*)$/);
  if (!match) return null;
  return {
    node,
    start: selection.anchorOffset - match[0].length,
    end: selection.anchorOffset,
    query: match[1],
  };
}

function placeCaret(doc, node, offset) {
  if (!node?.isConnected) return;
  const selection = doc.getSelection();
  const range = doc.createRange();
  const max = node.nodeType === Node.TEXT_NODE ? node.textContent.length : node.childNodes.length;
  range.setStart(node, Math.max(0, Math.min(offset, max)));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Paste bold/italic/etc. without bringing the source font-family. */
export function insertSanitizedPaste(event, root, onUrlPaste) {
  event.preventDefault();
  if (!root) return false;
  const html = event.clipboardData.getData('text/html');
  const plain = event.clipboardData.getData('text/plain');
  if (!html && !plain) return false;
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  if (!selection || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = doc.createDocumentFragment();
  if (html && /<(strong|em|u|s|mark|h1|b|i|span)\b/i.test(html)) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    for (const child of parsed.body.childNodes) appendClipboard(doc, fragment, child);
  }
  if (!fragment.childNodes.length && plain) {
    plain.split('\n').forEach((line, index) => {
      if (index) fragment.appendChild(doc.createElement('br'));
      if (line) fragment.appendChild(doc.createTextNode(line));
    });
  }
  if (!fragment.childNodes.length) return false;
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last?.nodeType === Node.TEXT_NODE) placeCaret(doc, last, last.textContent.length);
  else if (last?.isConnected) {
    const next = doc.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
  }
  const href = String(plain || '').match(/https?:\/\/[^\s<>"']+/i);
  if (href) onUrlPaste?.(href[0].replace(/[.,;:!?)]+$/g, ''));
  return true;
}

const TITLE_LINE = /^\s*(?:#|\/title|title)\s+(.+)$/i;

function lineBeforeCaret(root, caretNode, caretOffset) {
  let line = '';
  const nodes = [];
  let passed = false;
  const visit = (node) => {
    if (passed || !node) return;
    if (node === caretNode && node.nodeType === Node.TEXT_NODE) {
      line += node.textContent.slice(0, caretOffset);
      nodes.push(node);
      passed = true;
      return;
    }
    if (node === caretNode && node.nodeType === Node.ELEMENT_NODE) {
      [...node.childNodes].slice(0, caretOffset).forEach(visit);
      passed = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      line += node.textContent;
      nodes.push(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'BR' || node.tagName === 'H1') {
      line = '';
      nodes.length = 0;
      return;
    }
    if (node.dataset?.varId) {
      line += node.textContent;
      nodes.push(node);
      return;
    }
    [...node.childNodes].forEach(visit);
  };
  [...root.childNodes].forEach(visit);
  return { line, nodes: nodes.filter((node) => node.isConnected) };
}

function titleHost(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  if (!root || !selection?.rangeCount) return null;
  const caret = selection.getRangeAt(0);
  if (!root.contains(caret.startContainer)) return null;
  let host = caret.startContainer;
  if (host.nodeType === Node.TEXT_NODE) host = host.parentElement;
  const h1 = host?.closest?.('h1');
  if (!h1 || !root.contains(h1)) return null;
  return h1;
}

export function syncTitleEmpty(root) {
  if (!root) return;
  root.querySelectorAll('h1').forEach((h1) => {
    if (h1.textContent.replace(/\u00a0/g, ' ').trim()) delete h1.dataset.empty;
    else h1.dataset.empty = 'true';
  });
}

export function armHashTitle(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  if (!root || !selection?.isCollapsed || !selection.rangeCount) return false;
  const caret = selection.getRangeAt(0);
  if (!root.contains(caret.startContainer)) return false;
  let host = caret.startContainer;
  if (host.nodeType === Node.TEXT_NODE) host = host.parentElement;
  if (host?.closest?.('h1')) return false;
  const found = lineBeforeCaret(root, caret.startContainer, caret.startOffset);
  const hashNode = caret.startContainer.nodeType === Node.TEXT_NODE
    && caret.startOffset === caret.startContainer.textContent.length
    && /^\s*#\s*$/.test(caret.startContainer.textContent.replace(/\u00a0/g, ' '))
    ? caret.startContainer
    : null;
  const nodes = /^\s*#\s*$/.test(found.line) && found.nodes.length
    ? found.nodes
    : (hashNode ? [hashNode] : []);
  if (!nodes.length) return false;
  const h1 = doc.createElement('h1');
  h1.dataset.empty = 'true';
  const text = doc.createTextNode('');
  h1.appendChild(text);
  const first = nodes[0];
  if (!first.parentNode) return false;
  first.parentNode.insertBefore(h1, first);
  nodes.forEach((node) => node.remove());
  placeCaret(doc, text, 0);
  return true;
}

export function dismissEmptyTitle(root) {
  const doc = root?.ownerDocument;
  const h1 = titleHost(root);
  if (!doc || !h1 || h1.textContent.replace(/\u00a0/g, ' ').trim()) return false;
  const parent = h1.parentNode;
  if (!parent) return false;
  const slot = doc.createTextNode('');
  parent.insertBefore(slot, h1);
  h1.remove();
  placeCaret(doc, slot, 0);
  return true;
}

function caretAtTitleStart(h1, caret) {
  if (!h1.contains(caret.startContainer) && caret.startContainer !== h1) return false;
  if (caret.startContainer === h1) return caret.startOffset === 0;
  if (caret.startContainer.nodeType !== Node.TEXT_NODE || caret.startOffset !== 0) return false;
  let prev = caret.startContainer.previousSibling;
  while (prev) {
    if (prev.textContent?.replace(/\u00a0/g, ' ').trim()) return false;
    prev = prev.previousSibling;
  }
  return true;
}

function titleAfter(node) {
  let next = node?.nextSibling;
  while (next && next.nodeType === Node.TEXT_NODE && !next.textContent) next = next.nextSibling;
  if (next?.tagName === 'H1') return { br: null, h1: next };
  if (next?.tagName !== 'BR') return null;
  let after = next.nextSibling;
  while (after && after.nodeType === Node.TEXT_NODE && !after.textContent) after = after.nextSibling;
  if (after?.tagName === 'H1') return { br: next, h1: after };
  return null;
}

function placeAfterTitle(doc, h1) {
  const parent = h1.parentNode;
  if (!parent) return;
  let next = h1.nextSibling;
  while (next && next.nodeType === Node.TEXT_NODE && !next.textContent) next = next.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE) {
    placeCaret(doc, next, 0);
    return;
  }
  const slot = doc.createTextNode('');
  parent.insertBefore(slot, next?.tagName === 'BR' ? next : h1.nextSibling);
  placeCaret(doc, slot, 0);
}

export function leaveTitle(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  const h1 = titleHost(root);
  if (!doc || !selection?.rangeCount || !h1 || !h1.textContent.replace(/\u00a0/g, ' ').trim()) return false;
  const caret = selection.getRangeAt(0);
  if (caretAtTitleStart(h1, caret)) {
    const slot = doc.createTextNode('');
    const br = doc.createElement('br');
    h1.parentNode.insertBefore(slot, h1);
    h1.parentNode.insertBefore(br, h1);
    placeCaret(doc, slot, 0);
    return true;
  }
  placeAfterTitle(doc, h1);
  return true;
}

export function breakBeforeTitle(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  if (!doc || !selection?.isCollapsed || !selection.rangeCount) return false;
  const caret = selection.getRangeAt(0);
  const node = caret.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || titleHost(root)) return false;
  if (!titleAfter(node)) return false;
  const rest = node.splitText(caret.startOffset);
  const br = doc.createElement('br');
  node.parentNode.insertBefore(br, rest);
  placeCaret(doc, rest, 0);
  return true;
}

export function dropLineBelowTitle(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  if (!doc || !selection?.isCollapsed || !selection.rangeCount) return false;
  const caret = selection.getRangeAt(0);
  const node = caret.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || caret.startOffset !== node.textContent.length) return false;
  const found = titleAfter(node);
  if (!found) return false;
  const text = node.textContent;
  node.remove();
  if (found.br) found.br.remove();
  placeAfterTitle(doc, found.h1);
  const placed = doc.getSelection()?.getRangeAt(0)?.startContainer;
  if (placed?.nodeType === Node.TEXT_NODE) {
    placed.textContent = text + placed.textContent;
    placeCaret(doc, placed, text.length);
  }
  return true;
}

export function stepOutOfTitle(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  const h1 = titleHost(root);
  if (!doc || !selection?.rangeCount || !h1) return false;
  const caret = selection.getRangeAt(0);
  if (!caretAtTitleStart(h1, caret)) return false;
  let prev = h1.previousSibling;
  while (prev && prev.nodeType === Node.TEXT_NODE && !prev.textContent) prev = prev.previousSibling;
  if (prev?.tagName === 'BR') {
    const line = prev.previousSibling;
    if (line?.nodeType === Node.TEXT_NODE) placeCaret(doc, line, line.textContent.length);
    else prev.remove();
    return true;
  }
  if (prev?.nodeType === Node.TEXT_NODE) {
    placeCaret(doc, prev, prev.textContent.length);
    return true;
  }
  return false;
}

export function applyTitleShortcut(root) {
  const doc = root?.ownerDocument;
  const selection = doc?.getSelection();
  if (!root || !selection?.isCollapsed || !selection.rangeCount) return false;
  const caret = selection.getRangeAt(0);
  if (!root.contains(caret.startContainer)) return false;
  let host = caret.startContainer;
  if (host.nodeType === Node.TEXT_NODE) host = host.parentElement;
  if (host?.closest?.('h1')) return false;
  const found = lineBeforeCaret(root, caret.startContainer, caret.startOffset);
  const match = found.line.match(TITLE_LINE);
  const title = match?.[1]?.replace(/\s+/g, ' ').trim();
  if (!title || !found.nodes.length) return false;
  const h1 = doc.createElement('h1');
  h1.textContent = title;
  const br = doc.createElement('br');
  const first = found.nodes[0];
  if (!first.parentNode) return false;
  first.parentNode.insertBefore(h1, first);
  first.parentNode.insertBefore(br, first);
  found.nodes.forEach((node) => node.remove());
  const slot = doc.createTextNode('');
  if (br.nextSibling) br.parentNode.insertBefore(slot, br.nextSibling);
  else br.parentNode.appendChild(slot);
  placeCaret(doc, slot, 0);
  return true;
}

export function PromptBody({
  prompt,
  variables,
  documentId = '',
  onCommit,
  className,
  spellCheck = true,
  readOnly = false,
  placeholder = '',
  onEditFocus,
  onUrlPaste,
  children,
}) {
  const editorRef = useRef(null);
  const lockedRef = useRef(null);
  const localRef = useRef(null);
  const mentionRef = useRef(null);
  const nameRef = useRef(null);
  const caretChipRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const list = useMemo(
    () => documentVariables({ id: documentId, variables }),
    [documentId, variables],
  );

  function paintChips() {
    const root = editorRef.current;
    if (!root) return;
    for (const chip of root.querySelectorAll('[data-var-id]')) {
      const variable = list.find((item) => item.id === chip.dataset.varId);
      chip.textContent = fieldText(variable);
      chip.className = variableIsEmpty(variable) ? 'prompt-var' : 'prompt-var prompt-var--filled';
    }
  }

  function paintAll(source) {
    const root = editorRef.current;
    if (!root) return;
    const plain = String(source || '').replace(/<\/?(?:strong|em|u|s|mark|h1)>/gi, '');
    const parts = parsePrompt(plain);
    const empty = !plain.trim() && !/<h1\b/i.test(String(source || ''))
      || (parts.length === 1 && parts[0].type === 'text' && !parts[0].text.trim() && !/<h1\b/i.test(String(source || '')));
    if (empty) {
      root.replaceChildren();
      root.dataset.empty = 'true';
      return;
    }
    delete root.dataset.empty;
    paintMarked(root, source, list);
    syncTitleEmpty(root);
  }

  useLayoutEffect(() => {
    if (!readOnly) return;
    const root = lockedRef.current;
    if (!root) return;
    const source = dropUnknownTokens(prompt, list);
    const plain = source.replace(/<\/?(?:strong|em|u|s|mark|h1)>/gi, '').trim();
    if (!plain) {
      root.replaceChildren();
      root.dataset.empty = 'true';
      return;
    }
    delete root.dataset.empty;
    paintMarked(root, source, list);
  }, [readOnly, prompt, variables]);

  useEffect(() => {
    const cleaned = dropUnknownTokens(prompt, list);
    if (cleaned === String(prompt || '')) return;
    onCommit({ prompt: cleaned, keepSaved: true });
  }, [prompt, list, readOnly]);

  useEffect(() => {
    if (readOnly) {
      localRef.current = null;
      caretChipRef.current = null;
      return;
    }
    const root = editorRef.current;
    if (!root) return;
    if (localRef.current === prompt) paintChips();
    else {
      localRef.current = prompt;
      paintAll(prompt);
    }
    const chip = caretChipRef.current;
    if (!chip?.isConnected) return;
    caretChipRef.current = null;
    const next = chip.nextSibling;
    if (!next || next.nodeType !== Node.TEXT_NODE) return;
    root.focus();
    placeCaret(root.ownerDocument, next, 0);
  }, [prompt, list, readOnly]);

  function syncMenu() {
    const root = editorRef.current;
    if (!root) return;
    const mention = mentionAtCaret(root);
    if (!mention) {
      setMenu(null);
      setNaming(false);
      return;
    }
    mentionRef.current = mention;
    const query = mention.query;
    const filtered = list.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
    const exact = filtered.findIndex((item) => item.name.toLowerCase() === query.toLowerCase());
    setMenu({ query, active: exact >= 0 ? exact : 0 });
    setNaming(false);
  }

  function commitDom(nextVariables) {
    const root = editorRef.current;
    if (!root) return;
    const template = readTemplate(root);
    const hasTitle = Boolean(root.querySelector('h1'));
    const blank = !template.replace(/<\/?(?:strong|em|u|s|mark|h1)>/gi, '').trim() && !hasTitle;
    const leftFirstLine = Boolean(root.querySelector('br, h1, div, p')) || (root.textContent || '').includes('\n');
    localRef.current = blank ? '' : template;
    if (blank && !leftFirstLine) root.dataset.empty = 'true';
    else delete root.dataset.empty;
    const prompt = blank ? '' : template;
    onCommit(nextVariables ? { prompt, variables: nextVariables } : { prompt });
  }

  function insertVariable(id, mention, nextVariables) {
    const root = editorRef.current;
    const spot = mention || mentionRef.current;
    if (!root || !spot?.node?.parentNode) return;
    const doc = root.ownerDocument;
    const node = spot.node;
    const afterNode = node.splitText(spot.end);
    const queryNode = spot.start > 0 ? node.splitText(spot.start) : node;
    const source = nextVariables || list;
    const variable = source.find((item) => item.id === id) || { id, name: '?', value: '' };
    const chip = makeChip(doc, variable);
    queryNode.replaceWith(chip);
    caretChipRef.current = chip;
    setMenu(null);
    setNaming(false);
    setDraftName('');
    commitDom(nextVariables);
    if (afterNode.isConnected) placeCaret(doc, afterNode, 0);
  }

  function confirmName() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const existing = list.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      insertVariable(existing.id, mentionRef.current);
      return;
    }
    const id = crypto.randomUUID();
    const created = { id, name: trimmed, value: '' };
    if (documentId) created.documentId = documentId;
    insertVariable(id, mentionRef.current, [created, ...list]);
  }

  function options() {
    if (!menu) return [];
    const filtered = list.filter((item) => item.name.toLowerCase().includes(menu.query.toLowerCase()));
    return [
      ...filtered.map((variable) => ({ type: 'var', variable })),
      { type: 'create' },
    ];
  }

  function choose(option) {
    if (!option) return;
    if (option.type === 'create') {
      mentionRef.current = mentionAtCaret(editorRef.current) || mentionRef.current;
      setNaming(true);
      setDraftName('');
      return;
    }
    insertVariable(option.variable.id, mentionRef.current);
  }

  function onKeyDown(event) {
    if (!menu && (event.key === 'Backspace' || event.key === 'Delete')) {
      const root = editorRef.current;
      const doc = root?.ownerDocument;
      const selection = doc?.getSelection();
      if (root && selection?.isCollapsed && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const chip = event.key === 'Backspace'
          ? (node.nodeType === Node.TEXT_NODE && range.startOffset === 0
            ? node.previousSibling
            : node.nodeType === Node.ELEMENT_NODE
              ? node.childNodes[range.startOffset - 1]
              : null)
          : (node.nodeType === Node.TEXT_NODE && range.startOffset === node.textContent.length
            ? node.nextSibling
            : node.nodeType === Node.ELEMENT_NODE
              ? node.childNodes[range.startOffset]
              : null);
        if (chip?.dataset?.varId) {
          event.preventDefault();
          chip.remove();
          commitDom();
          return;
        }
        if (event.key === 'Backspace' && stepOutOfTitle(root)) {
          event.preventDefault();
          commitDom();
          return;
        }
        if (event.key === 'Delete' && dropLineBelowTitle(root)) {
          event.preventDefault();
          commitDom();
          return;
        }
      }
    }
    if (!menu && event.key === ' ' && armHashTitle(editorRef.current)) {
      event.preventDefault();
      commitDom();
      return;
    }
    if (!menu && event.key === 'Enter' && !event.shiftKey) {
      const root = editorRef.current;
      if (continueBullet(root) || dismissEmptyTitle(root) || breakBeforeTitle(root) || leaveTitle(root)) {
        event.preventDefault();
        commitDom();
        return;
      }
    }
    if (!menu) return;
    const items = options();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setMenu((current) => {
        if (!current) return current;
        const next = (current.active + delta + items.length) % items.length;
        return { ...current, active: next };
      });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(null);
      setNaming(false);
      return;
    }
    if (event.key === 'Enter' && !naming) {
      event.preventDefault();
      choose(items[menu.active] || items[items.length - 1]);
    }
  }

  function onPaste(event) {
    if (!insertSanitizedPaste(event, editorRef.current, onUrlPaste)) return;
    commitDom();
    syncMenu();
  }

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  const items = options();
  const menuStyle = menuPosition(editorRef.current, menu);
  const editorClass = className ? `prompt-body__editor ${className}` : 'prompt-body__editor';

  if (readOnly) {
    return (
      <div className="prompt-body">
        <div className="prompt-body__frame">
          <div
            ref={lockedRef}
            className={`${editorClass} prompt-body__editor--locked`}
            role="textbox"
            aria-readonly="true"
            aria-label="Prompt"
            data-placeholder={placeholder}
          />
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-body">
      <div className="prompt-body__frame">
        <div
          ref={editorRef}
          className={className ? `prompt-body__editor ${className}` : 'prompt-body__editor'}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Prompt"
          data-placeholder={placeholder}
          spellCheck={spellCheck}
          onInput={() => {
            syncTitleEmpty(editorRef.current);
            commitDom();
            syncMenu();
          }}
          onFocus={() => onEditFocus?.(editorRef.current)}
          onKeyDown={onKeyDown}
          onKeyUp={() => onEditFocus?.(editorRef.current)}
          onPaste={onPaste}
          onMouseUp={() => {
            syncMenu();
            onEditFocus?.(editorRef.current);
          }}
          suppressContentEditableWarning
        />
        {children}
        {menu && !naming ? createPortal(
          <div className="prompt-mention-layer">
            <div className="prompt-mention" style={menuStyle} role="listbox" aria-label="Variables">
              {items.map((option, index) => (
                <button
                  key={option.type === 'create' ? 'create' : option.variable.id}
                  type="button"
                  role="option"
                  aria-selected={index === menu.active}
                  className={index === menu.active ? 'is-active' : undefined}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                >
                  {option.type === 'create' ? 'Crear variable' : option.variable.name}
                </button>
              ))}
            </div>
          </div>,
          editorRef.current?.closest('.prompt-panel')
            || editorRef.current?.closest('.prompt-float')
            || editorRef.current?.ownerDocument.body,
        ) : null}
        {naming ? (
          <div
            className="prompt-namepop-layer"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              setNaming(false);
              editorRef.current?.focus();
            }}
          >
            <form
              className="prompt-namepop"
              onSubmit={(event) => {
                event.preventDefault();
                confirmName();
              }}
            >
              <img src="/favicon.svg" alt="" />
              <p>¿Cómo quieres nombrar tu variable?</p>
              <input
                ref={nameRef}
                value={draftName}
                placeholder="Nombre"
                aria-label="¿Cómo quieres nombrar tu variable?"
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setNaming(false);
                    editorRef.current?.focus();
                  }
                }}
              />
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function menuPosition(root, menu) {
  if (!root || !menu) return undefined;
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  const host = fixedHost(root).getBoundingClientRect();
  if (!selection || !selection.rangeCount) return { top: 28, left: 16 };
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const left = rect.left - host.left;
  return {
    top: Math.max(8, rect.bottom - host.top + 6),
    left: Math.max(8, Math.min(left, host.width - 196)),
  };
}

function fixedHost(root) {
  const doc = root.ownerDocument;
  let node = root.parentElement;
  while (node && node !== doc.body) {
    const transform = doc.defaultView.getComputedStyle(node).transform;
    if (transform && transform !== 'none') return node;
    node = node.parentElement;
  }
  return doc.documentElement;
}

export function VariableDeck({
  open,
  title,
  variables,
  documentId = '',
  onChange,
  onResetPlaceholders,
  onClose,
  inline = false,
}) {
  const list = useMemo(
    () => documentVariables({ id: documentId, variables }),
    [documentId, variables],
  );
  const [drafts, setDrafts] = useState([]);
  const [renamingId, setRenamingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');
  const editRef = useRef(null);
  const editNameRef = useRef('');
  const editValueRef = useRef('');
  const draftInputRefs = useRef(new Map());
  const pendingFocusId = useRef(null);

  useEffect(() => {
    if (renamingId) editRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (!open) {
      setDrafts([]);
      setRenamingId(null);
      setEditName('');
      setEditValue('');
      editNameRef.current = '';
      editValueRef.current = '';
      return;
    }
    /* On open: one placeholder draft even if the queue is empty. */
    setDrafts((prev) => {
      if (prev.length) return prev;
      const id = crypto.randomUUID();
      pendingFocusId.current = id;
      return [{ id, name: '', value: '' }];
    });
  }, [open]);

  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    pendingFocusId.current = null;
    draftInputRefs.current.get(id)?.focus();
  }, [drafts]);

  function startDraft() {
    if (drafts.length) {
      const last = drafts[drafts.length - 1];
      draftInputRefs.current.get(last.id)?.focus();
      return;
    }
    const id = crypto.randomUUID();
    pendingFocusId.current = id;
    setDrafts([{ id, name: '', value: '' }]);
  }

  function patchDraft(id, patch) {
    setDrafts((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function pushDraft(draftId) {
    const draft = drafts.find((item) => item.id === draftId);
    const name = draft?.name.trim();
    if (!name) {
      draftInputRefs.current.get(draftId)?.focus();
      return;
    }
    const existing = list.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id || crypto.randomUUID();
    const created = { id, name, value: draft.value };
    if (documentId) created.documentId = documentId;
    const next = existing
      ? list.map((item) => (item.id === id ? { ...item, ...created, id } : item))
      : [...list, created];
    onChange(next);
    setDrafts((prev) => prev.filter((item) => item.id !== draftId));
  }

  function removeName(id) {
    onChange(list.filter((item) => item.id !== id));
    if (renamingId === id) {
      setRenamingId(null);
      setEditName('');
      setEditValue('');
    }
  }

  function startRename(variable) {
    editNameRef.current = variable.name;
    editValueRef.current = variable.value;
    setRenamingId(variable.id);
    setEditName(variable.name);
    setEditValue(variable.value);
  }

  function commitRename(id) {
    const current = list.find((item) => item.id === id);
    if (!current) return;
    const typed = editNameRef.current.trim();
    const name = typed || current.name;
    const taken = list.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase());
    const nextName = taken ? current.name : name;
    onChange(list.map((item) => (
      item.id === id
        ? { ...item, name: nextName, value: editValueRef.current }
        : item
    )));
    setRenamingId(null);
    setEditName('');
    setEditValue('');
    editNameRef.current = '';
    editValueRef.current = '';
  }

  if (!open) return null;

  const library = (
    <>
      <header className={inline ? 'prompt-vars__head' : 'prompt-library__head'}>
        <div>
          <p>Variables</p>
          <h2>{title || 'This file'}</h2>
        </div>
        <button type="button" className="prompt-library__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="prompt-library__fields">
        {list.map((variable) => {
          const editing = renamingId === variable.id;
          return (
            <div
              key={variable.id}
              className="prompt-library__field"
            >
              <div className="prompt-library__label-row">
                <input
                  ref={editing ? editRef : null}
                  className="prompt-library__name-input"
                  value={editing ? editName : variable.name}
                  readOnly={!editing}
                  size={Math.max(((editing ? editName : variable.name) || 'Variable name').length, 1)}
                  placeholder="Variable name"
                  aria-label="Variable name"
                  onChange={(event) => {
                    editNameRef.current = event.target.value;
                    setEditName(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (!editing) return;
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitRename(variable.id);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setRenamingId(null);
                      setEditName('');
                      setEditValue('');
                    }
                  }}
                />
                <button
                  type="button"
                  className={editing ? 'prompt-library__queue' : 'prompt-library__rename'}
                  aria-label={editing ? 'Guardar' : `Edit ${variable.name}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => (editing ? commitRename(variable.id) : startRename(variable))}
                >
                  {editing ? 'Guardar' : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                      <path d="M13 7l4 4" />
                    </svg>
                  )}
                </button>
                {list.length ? (
                  <button type="button" className="prompt-library__remove" aria-label={`Remove ${variable.name}`} onClick={() => removeName(variable.id)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M9 7V5h6v2" />
                      <path d="M7 7l1 13h8l1-13" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <textarea
                rows={2}
                readOnly={!editing}
                value={editing ? editValue : variable.value}
                placeholder={`[ ${variable.name} ]`}
                aria-label={variable.name}
                onChange={(event) => {
                  editValueRef.current = event.target.value;
                  setEditValue(event.target.value);
                }}
              />
            </div>
          );
        })}
        {drafts.map((draft) => (
          <div key={draft.id} className="prompt-library__field">
            <div className="prompt-library__label-row">
              <input
                ref={(node) => {
                  if (node) draftInputRefs.current.set(draft.id, node);
                  else draftInputRefs.current.delete(draft.id);
                }}
                className="prompt-library__name-input"
                value={draft.name}
                size={Math.max((draft.name || 'Variable name').length, 1)}
                placeholder="Variable name"
                aria-label="Variable name"
                onChange={(event) => patchDraft(draft.id, { name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    pushDraft(draft.id);
                  }
                }}
              />
              <button
                type="button"
                className="prompt-library__rename"
                aria-label="Edit variable name"
                onClick={() => draftInputRefs.current.get(draft.id)?.focus()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                  <path d="M13 7l4 4" />
                </svg>
              </button>
              <button type="button" className="prompt-library__queue" onClick={() => pushDraft(draft.id)}>
                Add Variable
              </button>
              <button
                type="button"
                className="prompt-library__remove"
                aria-label="Quitar cajón"
                onClick={() => setDrafts((prev) => prev.filter((item) => item.id !== draft.id))}
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
              value={draft.value}
              placeholder={draft.name.trim() ? `[ ${draft.name.trim()} ]` : ''}
              aria-label="Product"
              onChange={(event) => patchDraft(draft.id, { value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  pushDraft(draft.id);
                }
              }}
            />
          </div>
        ))}
      </div>
      <footer className="prompt-library__footer">
        <p className="prompt-library__info">This queue belongs only to this document. Type @ in the prompt to place it.</p>
        <div className="prompt-library__footer-actions">
          {list.length && onResetPlaceholders ? (
            <button
              type="button"
              className="prompt-library__reset"
              aria-label="Reset"
              onClick={() => {
                onResetPlaceholders();
                setDrafts([{ id: crypto.randomUUID(), name: '', value: '' }]);
                setRenamingId(null);
                setEditName('');
                setEditValue('');
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" />
                <path d="M17 3v4h-4M7 21v-4h4" />
              </svg>
              <span>Reset</span>
            </button>
          ) : null}
          {drafts.length ? null : (
            <button type="button" className="prompt-library__create" onClick={startDraft}>
              Add Variable
            </button>
          )}
        </div>
      </footer>
    </>
  );

  if (inline) {
    return (
      <section className="prompt-vars" aria-label="Variable library">
        {library}
      </section>
    );
  }

  return (
    <div
      className="prompt-library"
      role="dialog"
      aria-modal="true"
      aria-label="Variable library"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="prompt-library__page">
        {library}
      </div>
    </div>
  );
}
