import { describe, expect, it } from 'vitest';
import {
  buildPromptDocumentMarkdown,
  promptStepHeading,
} from './exportPromptDocumentMarkdown.js';

describe('promptStepHeading', () => {
  it('prefers the step title', () => {
    expect(promptStepHeading({ title: 'Deep focus' }, 0, 'File')).toBe('Deep focus');
  });

  it('falls back to Prompt 01 style', () => {
    expect(promptStepHeading({ title: '' }, 0, '')).toBe('Prompt 01');
    expect(promptStepHeading({ title: '' }, 1, '')).toBe('Prompt 02');
  });
});

describe('buildPromptDocumentMarkdown', () => {
  it('exports every step with title and body', () => {
    const markdown = buildPromptDocumentMarkdown({
      name: 'Retros videos',
      steps: [
        { id: 'a', title: 'Intro', prompt: 'Hello [Name]', description: 'Lead' },
        { id: 'b', title: '', prompt: 'Second body', description: '' },
      ],
    }, [{ id: 'v1', name: 'Name', value: 'Ada' }]);

    // Unresolved [Name] stays until lifted; resolvePrompt only fills {{id}}
    expect(markdown).toContain('# Retros videos');
    expect(markdown).toContain('## Intro');
    expect(markdown).toContain('Lead');
    expect(markdown).toContain('Hello [Name]');
    expect(markdown).toContain('## Retros videos — 2');
    expect(markdown).toContain('Second body');
  });

  it('resolves {{id}} tokens with variable values', () => {
    const markdown = buildPromptDocumentMarkdown({
      name: 'Doc',
      steps: [
        { id: 'a', title: 'One', prompt: 'Hi {{v1}}', description: '' },
      ],
    }, [{ id: 'v1', name: 'Name', value: 'Ada' }]);
    expect(markdown).toContain('Hi Ada');
  });
});
