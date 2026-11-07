import { resolvePrompt } from './promptVariables.js';
import { downloadMarkdownText, sanitizeMarkdownFileName } from './exportDocToMarkdown.js';

function stripMarkup(text) {
  return String(text || '')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?ul>/gi, '')
    .replace(/<\/?(?:strong|em|u|s|mark|h1)>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function plainField(template, variables) {
  return stripMarkup(resolvePrompt(template, variables));
}

function hasText(value) {
  return Boolean(stripMarkup(value));
}

export function promptStepHeading(step, index, fileName = '') {
  const title = String(step?.title || '').trim();
  if (title) return title;
  const file = String(fileName || '').trim();
  if (file && file !== 'Untitled' && file !== 'Title Description') {
    return `${file} — ${index + 1}`;
  }
  return `Prompt ${String(index + 1).padStart(2, '0')}`;
}

/**
 * Build a markdown dump of every step in a prompt document (titles + bodies).
 * Local only — no Groq.
 */
export function buildPromptDocumentMarkdown(prompt, variables = []) {
  const docTitle = String(prompt?.name || '').trim() || 'Prompt Library';
  const steps = Array.isArray(prompt?.steps) ? prompt.steps : [];
  const parts = [`# ${docTitle}`, ''];

  steps.forEach((step, index) => {
    const heading = promptStepHeading(step, index, docTitle);
    const body = plainField(step?.prompt, variables);
    const description = plainField(step?.description, variables);
    if (!body && !description && !String(step?.title || '').trim()) return;
    parts.push(`## ${heading}`, '');
    if (description) {
      parts.push(description, '');
    }
    if (body) {
      parts.push(body, '');
    }
  });

  const markdown = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return `${markdown}\n`;
}

export function exportPromptDocumentMarkdown(prompt, variables = []) {
  const markdown = buildPromptDocumentMarkdown(prompt, variables);
  if (!hasText(markdown.replace(/^#\s+.*/m, ''))) {
    return { ok: false, empty: true };
  }
  const fileName = sanitizeMarkdownFileName(prompt?.name || 'prompt-library');
  downloadMarkdownText(markdown, fileName);
  return { ok: true, fileName, markdown };
}
