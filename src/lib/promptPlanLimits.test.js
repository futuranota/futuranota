import { describe, expect, it } from 'vitest';
import {
  DESK_FREE_PREVIEW_EMAIL,
  FREE_PROMPT_LIMITS,
  PROMPT_LIMITS_ENFORCED,
  PROMPT_STORAGE_BYTES,
  PRO_PROMPT_CREDITS,
  canAddPromptFile,
  canAddPromptFolder,
  canAddPromptPage,
  creditBalance,
  deskPlan,
  localDayKey,
  promptLimits,
  promptToolCallsLeft,
} from './promptPlanLimits.js';
import { promptFileBytes, storageTreeFromDesk, treeBytes } from './promptStorageTree.js';
import { clearPreviewDeskUsage, embedCountForDay, readPreviewEmbeds, spendPreviewEmbed } from './promptDeskUsage.js';

describe('promptPlanLimits', () => {
  it('enforces the free shelf and leaves Pro open', () => {
    expect(PROMPT_LIMITS_ENFORCED).toBe(true);
    expect(FREE_PROMPT_LIMITS.maxFolders).toBe(1);
    expect(FREE_PROMPT_LIMITS.maxFiles).toBe(2);
    expect(FREE_PROMPT_LIMITS.maxPagesPerFile).toBe(6);
    expect(FREE_PROMPT_LIMITS.maxToolCalls).toBe(3);
    expect(promptLimits('free').maxFolders).toBe(1);
    expect(promptLimits('free').maxFiles).toBe(2);
    expect(promptLimits('free').maxPagesPerFile).toBe(6);
    expect(promptLimits('pro').maxFiles).toBe(Infinity);
    expect(promptLimits('pro').maxToolCalls).toBe(200);
    expect(promptLimits('free').storageBytes).toBe(PROMPT_STORAGE_BYTES);
    expect(PROMPT_STORAGE_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });

  it('stops the free shelf at 1 folder, 2 files, and 6 pages', () => {
    const folders = [{ id: 'folder-1', prompts: [{}, {}] }];
    expect(canAddPromptFolder(folders, 'free')).toBe(false);
    expect(canAddPromptFile(folders, 'free', 'folder-1')).toBe(false);
    expect(canAddPromptFile([{ id: 'folder-1', prompts: [{}] }], 'free', 'folder-1')).toBe(true);
    expect(canAddPromptPage(6, 'free')).toBe(false);
    expect(canAddPromptPage(5, 'free')).toBe(true);
    expect(canAddPromptPage(40, 'pro')).toBe(true);
  });

  it('turns 3 free clicks into 21 credits and locks the fourth', () => {
    expect(promptToolCallsLeft(0, 'free')).toBe(3);
    expect(promptToolCallsLeft(3, 'free')).toBe(0);
    expect(creditBalance(3, 'free')).toBe(21);
    expect(creditBalance(0, 'free')).toBe(0);
    expect(creditBalance(200, 'pro')).toBe(PRO_PROMPT_CREDITS);
    expect(PRO_PROMPT_CREDITS).toBe(1400);
  });

  it('keeps the preview login on the free plan', () => {
    expect(deskPlan(DESK_FREE_PREVIEW_EMAIL, 'pro')).toBe('free');
    expect(deskPlan('someone@example.com', 'pro')).toBe('pro');
    expect(deskPlan('someone@example.com', 'free')).toBe('free');
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
      coverPath: 'user/cover.webp',
      pdf: { path: 'user/file-1.pdf' },
    };
    const sizes = { 'user/file-1.pdf': 1000, 'user/step.webp': 50, 'user/cover.webp': 80, 'user/other.pdf': 9 };
    const text = promptFileBytes({ ...prompt, pdf: null, steps: [{ description: 'Hola', prompt: 'Prompt' }] });
    expect(promptFileBytes(prompt, sizes)).toBe(text + 1130);

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

describe('embedCountForDay', () => {
  it('counts copies from today and resets on the next local day', () => {
    expect(embedCountForDay({ embed_day: '2026-10-20', embed_count: 2 }, '2026-10-20')).toBe(2);
    expect(embedCountForDay({ embed_day: '2026-10-20', embed_count: 2 }, '2026-10-21')).toBe(0);
    expect(embedCountForDay(null, '2026-10-20')).toBe(0);
  });

  it('counts Copy embed on the preview login and opens a new day at 0', () => {
    const email = 'embed-counter-test@example.com';
    expect(spendPreviewEmbed(email, '2026-10-20').embedCount).toBe(1);
    expect(spendPreviewEmbed(email, '2026-10-20').embedCount).toBe(2);
    expect(spendPreviewEmbed(email, '2026-10-20').embedCount).toBe(3);
    expect(spendPreviewEmbed(email, '2026-10-20').ok).toBe(false);
    expect(readPreviewEmbeds(email, '2026-10-21')).toBe(0);
    expect(spendPreviewEmbed(email, '2026-10-21').embedCount).toBe(1);
  });

  it('clears preview clicks and embed keys for a reset', () => {
    const email = 'reset-desk-test@example.com';
    spendPreviewEmbed(email, '2026-10-20');
    expect(readPreviewEmbeds(email, '2026-10-20')).toBe(1);
    expect(clearPreviewDeskUsage(email)).toBe(email);
    expect(readPreviewEmbeds(email, '2026-10-20')).toBe(0);
  });
});
