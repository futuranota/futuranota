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

export function normalizeVariables(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      value: item.value == null ? '' : String(item.value),
    }));
}
