import { describe, expect, it } from 'vitest';
import {
  liftDocumentPlaceholders,
  liftPromptPlaceholders,
  resetDocumentPlaceholders,
} from './promptVariables.js';

describe('liftPromptPlaceholders', () => {
  it('reuses an existing variable by name', () => {
    const first = liftPromptPlaceholders('Hola [Nombre]', []);
    const second = liftPromptPlaceholders('Otro [Nombre]', first.variables);
    expect(second.variables).toHaveLength(1);
    expect(second.prompt).toBe(`Otro {{${first.variables[0].id}}}`);
  });

  it('collapses whitespace and newlines inside brackets', () => {
    const lifted = liftPromptPlaceholders('Usa [Nombre\nde   cliente]', []);
    expect(lifted.variables).toHaveLength(1);
    expect(lifted.variables[0].name).toBe('Nombre de cliente');
  });
});

describe('liftDocumentPlaceholders', () => {
  it('scans every step once and dedupes the same bracket name', () => {
    const steps = [
      { id: 's1', prompt: 'Step one [Nombre de variable]', description: '' },
      { id: 's2', prompt: 'Step two [Nombre de variable]', description: 'Meta [Nombre de variable]' },
    ];
    const lifted = liftDocumentPlaceholders(steps, []);
    expect(lifted.variables).toHaveLength(1);
    const id = lifted.variables[0].id;
    expect(lifted.steps[0].prompt).toBe(`Step one {{${id}}}`);
    expect(lifted.steps[1].prompt).toBe(`Step two {{${id}}}`);
    expect(lifted.steps[1].description).toBe(`Meta {{${id}}}`);
  });

  it('keeps prior document variables and does not recreate them', () => {
    const existing = [{ id: 'keep-me', name: 'Nombre', value: 'Ada' }];
    const steps = [
      { id: 's1', prompt: 'A [Nombre]', description: '' },
      { id: 's2', prompt: 'B [Nombre]', description: '' },
    ];
    const lifted = liftDocumentPlaceholders(steps, existing);
    expect(lifted.variables).toHaveLength(1);
    expect(lifted.variables[0].id).toBe('keep-me');
    expect(lifted.variables[0].value).toBe('Ada');
  });
});

describe('resetDocumentPlaceholders', () => {
  it('turns tokens back into [name] and clears the variable list', () => {
    const variables = [{ id: 'v1', name: 'Nombre de variable', value: 'Ada' }];
    const steps = [
      { id: 's1', prompt: 'Step one {{v1}}', description: '' },
      { id: 's2', prompt: 'Step two {{v1}}', description: 'Meta {{v1}}' },
    ];
    const reset = resetDocumentPlaceholders(steps, variables);
    expect(reset.variables).toEqual([]);
    expect(reset.steps[0].prompt).toBe('Step one [Nombre de variable]');
    expect(reset.steps[1].prompt).toBe('Step two [Nombre de variable]');
    expect(reset.steps[1].description).toBe('Meta [Nombre de variable]');
  });
});
