const TOKEN = /\{\{([^{}]+)\}\}/g;

export function parsePrompt(template) {
  const source = template || '';
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ type: 'text', text: source.slice(last, match.index) });
    parts.push({ type: 'var', id: match[1] });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ type: 'text', text: source.slice(last) });
  if (!parts.length) parts.push({ type: 'text', text: '' });
  return parts;
}

export function variableLabel(variable) {
  if (!variable) return '[?]';
  return variable.value && variable.value.trim() ? variable.value : `[${variable.name}]`;
}

export function variableIsEmpty(variable) {
  return !variable?.value || !variable.value.trim();
}

export function resolvePrompt(template, variables) {
  const byId = new Map((variables || []).map((item) => [item.id, item]));
  return (template || '').replace(TOKEN, (_, id) => variableLabel(byId.get(id)));
}

export function dropUnknownTokens(template, variables) {
  const ids = new Set((variables || []).map((item) => item.id));
  const next = String(template || '').replace(/\{\{([^{}]+)\}\}/g, (token, id) => (
    ids.has(id) ? token : ''
  ));
  if (!next.replace(/<\/?(?:strong|em|u|s|mark)>/gi, '').trim()) return '';
  return next;
}

const PLACEHOLDER = /\{\{([^{}\n]*?)\}\}|\[\[([^\[\]\n]*?)\]\]|\{([^{}\n]+)\}|\[([^\[\]\n]+)\]/g;

export function liftPromptPlaceholders(template, variables) {
  const list = [...(variables || [])];
  const knownIds = new Set(list.map((item) => item.id));
  const prompt = String(template || '').replace(PLACEHOLDER, (match, doubleCurly, doubleBracket, curly, bracket) => {
    const raw = doubleCurly ?? doubleBracket ?? curly ?? bracket;
    const name = String(raw || '').replace(/<\/?(?:strong|em|u|s|mark)>/gi, '').trim();
    if (!name) return match;
    if (doubleCurly != null && knownIds.has(name)) return match;
    const existing = list.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing) return `{{${existing.id}}}`;
    const id = crypto.randomUUID();
    list.push({ id, name, value: '' });
    knownIds.add(id);
    return `{{${id}}}`;
  });
  return { prompt, variables: list };
}

function variableRecord(item) {
  const record = {
    id: String(item.id),
    name: String(item.name),
    value: item.value == null ? '' : String(item.value),
  };
  if (item.documentId) record.documentId = String(item.documentId);
  return record;
}

export function normalizeVariables(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && item.id && item.name)
    .map((item) => variableRecord(item));
}

/** Variables stored on this document. Another document's list never qualifies. */
export function documentVariables(prompt) {
  const documentId = prompt?.id ? String(prompt.id) : '';
  return normalizeVariables(prompt?.variables).filter((item) => (
    !item.documentId || !documentId || item.documentId === documentId
  ));
}

export function stampVariables(variables, documentId) {
  const owner = documentId ? String(documentId) : '';
  return normalizeVariables(variables).map((item) => (
    owner ? { ...item, documentId: item.documentId || owner } : item
  ));
}

function promptText(prompt) {
  return (prompt?.steps || [])
    .map((step) => `${step?.prompt || ''}\n${step?.description || ''}`)
    .join('\n');
}

/**
 * Each variable belongs to one document.
 * A copy of the same id on another file is dropped unless that file's text uses it.
 * An unused id copied onto several files stays on the first file only.
 */
export function claimDocumentVariables(folders) {
  const prompts = (folders || []).flatMap((folder) => folder.prompts || []);
  const referencedBy = new Map();
  for (const prompt of prompts) {
    for (const match of promptText(prompt).matchAll(/\{\{([^{}]+)\}\}/g)) {
      const id = match[1];
      let owners = referencedBy.get(id);
      if (!owners) {
        owners = new Set();
        referencedBy.set(id, owners);
      }
      owners.add(prompt.id);
    }
  }
  const parked = new Set();
  return (folders || []).map((folder) => ({
    ...folder,
    prompts: (folder.prompts || []).map((prompt) => {
      const seen = new Set();
      const variables = normalizeVariables(prompt.variables).filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        const owners = referencedBy.get(item.id);
        if (owners?.size) return owners.has(prompt.id);
        if (parked.has(item.id)) return false;
        parked.add(item.id);
        return true;
      }).map((item) => ({ ...item, documentId: prompt.id }));
      return { ...prompt, variables };
    }),
  }));
}
