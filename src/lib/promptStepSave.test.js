import { describe, expect, it } from 'vitest';
import { savedPromptCount, stepsMarkedAfterSave } from './promptStepSave.js';

function hasWork(item) {
  return Boolean(String(item?.prompt || '').trim());
}

describe('stepsMarkedAfterSave', () => {
  it('does not mark an empty placeholder as saved', () => {
    const next = stepsMarkedAfterSave(
      [{ id: 'a', prompt: '', promptSaved: false }],
      hasWork,
    );
    expect(next[0].promptSaved).toBe(false);
  });

  it('clears a saved empty prompt so Empty files stay at 0', () => {
    const next = stepsMarkedAfterSave(
      [{ id: 'a', prompt: '', promptSaved: true }],
      hasWork,
    );
    expect(next[0].promptSaved).toBe(false);
  });

  it('marks a step with text as saved', () => {
    const next = stepsMarkedAfterSave(
      [{ id: 'a', prompt: 'Write a hook', promptSaved: false }],
      hasWork,
    );
    expect(next[0].promptSaved).toBe(true);
  });
});

describe('savedPromptCount', () => {
  it('ignores empty saved placeholders', () => {
    expect(savedPromptCount(
      [{ promptSaved: true, prompt: '' }, { promptSaved: true, prompt: 'Keep' }],
      hasWork,
    )).toBe(1);
  });
});
