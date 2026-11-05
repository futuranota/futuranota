/** Shared prompt-desk model logos / labels (Home sheet + teleprompter). */

export const PROMPT_MODELS = [
  { id: 'openai', label: 'ChatGPT', src: '/uploads/source/OpenAiLogo.svg' },
  { id: 'claude', label: 'Claude', src: '/uploads/claude-color.svg' },
  { id: 'grok', label: 'Grok', src: '/uploads/grok.svg' },
  { id: 'gemini', label: 'Gemini', src: '/uploads/gemini-color.svg' },
];

/**
 * @param {string} modelId
 * @returns {{ id: string, label: string, src: string } | null}
 */
export function findPromptModel(modelId) {
  const id = String(modelId || '').trim();
  if (!id) return null;
  return PROMPT_MODELS.find((model) => model.id === id) || null;
}

/**
 * Meta for a prompt step card (teleprompter insert / browser).
 * @param {object} file
 * @param {object} step
 */
export function stepModelCardMeta(file, step) {
  const modelId = String((step?.modelIds || [])[0] || file?.modelId || '').trim();
  const known = findPromptModel(modelId);
  const platformLabel = known?.label || modelId || '';
  const recommended = String(step?.recommendedModel || '').trim();
  return {
    modelId,
    modelLabel: platformLabel,
    modelSrc: known?.src || '',
    recommendedModel: recommended,
  };
}
