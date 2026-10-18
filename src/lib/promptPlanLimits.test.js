import { describe, expect, it } from 'vitest';
import {
  FREE_PROMPT_LIMITS,
  PROMPT_LIMITS_ENFORCED,
  PROMPT_STORAGE_BYTES,
  canAddPromptFile,
  canAddPromptFolder,
  canAddPromptPage,
  localDayKey,
  promptLimits,
  promptToolCallsLeft,
} from './promptPlanLimits.js';
import { promptFileBytes, storageTreeFromDesk, treeBytes } from './promptStorageTree.js';

describe('promptPlanLimits', () => {
  it('keeps the free caps written down and leaves them off during development', () => {
    expect(PROMPT_LIMITS_ENFORCED).toBe(false);
    expect(FREE_PROMPT_LIMITS.maxFolders).toBe(1);
    expect(FREE_PROMPT_LIMITS.maxFiles).toBe(2);
    expect(FREE_PROMPT_LIMITS.maxPagesPerFile).toBe(6);
    expect(FREE_PROMPT_LIMITS.maxToolCalls).toBe(3);
    expect(promptLimits('free').storageBytes).toBe(PROMPT_STORAGE_BYTES);
    expect(promptLimits('pro').storageBytes).toBe(PROMPT_STORAGE_BYTES);
    expect(promptLimits('free').maxFolders).toBe(Infinity);
    expect(promptLimits('pro').maxFiles).toBe(Infinity);
    expect(PROMPT_STORAGE_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });

  it('lets every plan add folders, files, and pages while caps are off', () => {
    const folders = [{ prompts: [{}, {}] }];
    expect(canAddPromptFolder(folders, 'free')).toBe(true);
    expect(canAddPromptFile(folders, 'free')).toBe(true);
    expect(canAddPromptPage(40, 'free')).toBe(true);
    expect(canAddPromptPage(40, 'pro')).toBe(true);
  });

  it('does not count tool calls while caps are off', () => {
    expect(promptToolCallsLeft(3, 'free')).toBe(Infinity);
    expect(promptToolCallsLeft(3, 'pro')).toBe(Infinity);
  });

  it('formats the local day', () => {
    expect(localDayKey(new Date(2026, 9, 18))).toBe('2026-10-18');
  });
});

describe('promptStorageTree', () => {
  it('sums saved text and the bucket objects that belong to each file', () => {
    const prompt = {
      id: 'file-1',
      name: 'Brief',
      steps: [{ description: 'Hola', prompt: 'Prompt', imagePath: 'user/step.webp' }],
      pdf: { path: 'user/file-1.pdf' },
    };
    const sizes = { 'user/file-1.pdf': 1000, 'user/step.webp': 50, 'user/other.pdf': 9 };
    const text = promptFileBytes({ ...prompt, pdf: null, steps: [{ description: 'Hola', prompt: 'Prompt' }] });
    expect(promptFileBytes(prompt, sizes)).toBe(text + 1050);

    const root = storageTreeFromDesk([{
      id: 'folder-1',
      label: 'Prompts',
      prompts: [prompt],
    }], sizes);
    expect(root.children[0].name).toBe('Prompts');
    expect(root.children[0].children[0].kind).toBe('file');
    expect(treeBytes(root)).toBe(promptFileBytes(prompt, sizes));
    expect(treeBytes(root)).not.toBe(1059);
  });
});
