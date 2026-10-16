import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parsePrompt, resolvePrompt, variableIsEmpty } from '../../lib/promptVariables.js';

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
};

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function styleMark(node) {
  const style = node.getAttribute('style') || '';
  if (/background/i.test(style)) return 'mark';
  if (/font-weight:\s*(bold|[6-9]00)/i.test(style)) return 'strong';
  if (/font-style:\s*italic/i.test(style)) return 'em';
  if (/line-through/i.test(style)) return 's';
  if (/underline/i.test(style)) return 'u';
  return '';
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
};

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
  const mark = PASTE_MARKS[node.tagName];
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
      out += `<${mark}>`;
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
  return /<\/?(?:strong|em|u|s|mark)\b/i.test(source || '');
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
        parent.appendChild(makeChip(
          doc,
          (variables || []).find((item) => item.id === part.id) || { id: part.id, name: '?', value: '' },
        ));
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
      walk(node, el);
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

export function PromptBody({
  prompt,
  variables,
  onCommit,
  className,
  spellCheck = true,
  readOnly = false,
  placeholder = '',
  onEditFocus,
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
  const list = variables || [];

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
    const plain = String(source || '').replace(/<\/?(?:strong|em|u|s|mark)>/gi, '');
    const parts = parsePrompt(plain);
    const empty = !plain.trim() || (parts.length === 1 && parts[0].type === 'text' && !parts[0].text.trim());
    if (empty) {
      root.replaceChildren();
      root.dataset.empty = 'true';
      return;
    }
    delete root.dataset.empty;
    paintMarked(root, source, list);
  }

  useLayoutEffect(() => {
    if (!readOnly) return;
    const root = lockedRef.current;
    if (!root) return;
    const plain = resolvePrompt(prompt, list).replace(/<\/?(?:strong|em|u|s|mark)>/gi, '').trim();
    if (!plain) {
      root.replaceChildren();
      root.dataset.empty = 'true';
      return;
    }
    delete root.dataset.empty;
    if (!hasMarks(prompt)) {
      root.textContent = resolvePrompt(prompt, list);
      return;
    }
    const shown = String(prompt || '').replace(/\{\{([^{}]+)\}\}/g, (_, id) => (
      escapeHtml(fieldText(list.find((item) => item.id === id)))
    ));
    paintMarked(root, shown, [], { chips: false });
  }, [readOnly, prompt, variables]);

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
    const blank = !template.replace(/<\/?(?:strong|em|u|s|mark)>/gi, '').trim();
    localRef.current = blank ? '' : template;
    if (blank) root.dataset.empty = 'true';
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
    insertVariable(id, mentionRef.current, [{ id, name: trimmed, value: '' }, ...list]);
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
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    if (!html && !plain) return;
    const root = editorRef.current;
    const doc = root.ownerDocument;
    const selection = doc.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = doc.createDocumentFragment();
    if (html && /<(strong|em|u|s|mark|b|i)\b/i.test(html)) {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      for (const child of parsed.body.childNodes) appendClipboard(doc, fragment, child);
    }
    if (!fragment.childNodes.length && plain) {
      plain.split('\n').forEach((line, index) => {
        if (index) fragment.appendChild(doc.createElement('br'));
        if (line) fragment.appendChild(doc.createTextNode(line));
      });
    }
    if (!fragment.childNodes.length) return;
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

export function VariableDeck({ open, title, variables, onChange, onClose, inline = false }) {
  const list = variables || [];
  const [expanded, setExpanded] = useState({});
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const addRef = useRef(null);
  const skipAddBlur = useRef(false);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  if (!open) return null;

  function confirmAdd() {
    if (skipAddBlur.current) {
      skipAddBlur.current = false;
      return;
    }
    const trimmed = draftName.trim();
    setAdding(false);
    setDraftName('');
    if (!trimmed) return;
    const existing = list.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setExpanded((current) => ({ ...current, [existing.id]: true }));
      return;
    }
    onChange([{ id: crypto.randomUUID(), name: trimmed, value: '' }, ...list]);
  }

  function rename(id, name) {
    const taken = list.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase());
    if (taken) return;
    onChange(list.map((item) => (item.id === id ? { ...item, name } : item)));
  }

  const library = (
    <>
        <header className={inline ? 'prompt-vars__head' : 'prompt-library__head'}>
          <div>
            <p>Variables</p>
            <h2>{title || 'This file'}</h2>
          </div>
          <div className="prompt-library__actions">
            <button
              type="button"
              className="prompt-library__add"
              aria-label="Add variable"
              onClick={() => {
                setDraftName('');
                setAdding(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </button>
            <button type="button" className="prompt-library__close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>
        <p className="prompt-library__info">Type “@” in the text area to call or create a variable.</p>
        <div className="prompt-library__list">
          {adding ? (
            <input
              ref={addRef}
              className="prompt-library__name"
              value={draftName}
              placeholder="Name"
              aria-label="Variable name"
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  skipAddBlur.current = true;
                  setAdding(false);
                  setDraftName('');
                }
              }}
              onBlur={confirmAdd}
            />
          ) : null}
          {list.length ? list.map((variable) => (
            <VariableRow
              key={variable.id}
              variable={variable}
              expanded={Boolean(expanded[variable.id])}
              onToggle={() => setExpanded((current) => ({
                ...current,
                [variable.id]: !current[variable.id],
              }))}
              onValue={(value) => onChange(list.map((item) => (
                item.id === variable.id ? { ...item, value } : item
              )))}
              onRename={(name) => rename(variable.id, name)}
            />
          )) : !adding ? (
            <p className="prompt-library__empty">No variables yet.</p>
          ) : null}
        </div>
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

function VariableRow({ variable, expanded, onToggle, onValue, onRename }) {
  const fieldRef = useRef(null);
  const nameRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(variable.name);
  const skipBlur = useRef(false);
  useEffect(() => {
    const node = fieldRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [expanded, variable.value]);
  useEffect(() => {
    if (editing) nameRef.current?.select();
  }, [editing]);
  function commitName() {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next || next === variable.name) return;
    onRename(next);
  }
  return (
    <div className="prompt-library__item">
      {editing ? (
        <input
          ref={nameRef}
          className="prompt-library__name"
          value={draft}
          aria-label="Variable name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              skipBlur.current = true;
              setDraft(variable.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div className="prompt-library__row">
          <button type="button" aria-expanded={expanded} onClick={onToggle}>
            {variable.name}
          </button>
          <button
            type="button"
            className="prompt-library__rename"
            aria-label={`Rename ${variable.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setDraft(variable.name);
              setEditing(true);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L18 10l-4-4L4 16v4z" />
              <path d="M13 7l4 4" />
            </svg>
          </button>
        </div>
      )}
      {expanded ? (
        <textarea
          ref={fieldRef}
          rows={1}
          value={variable.value}
          placeholder={variable.name}
          aria-label={variable.name}
          onChange={(event) => onValue(event.target.value)}
        />
      ) : null}
    </div>
  );
}
