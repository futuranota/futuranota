import { describe, expect, it } from 'vitest';
import {
  DESK_FREE_PREVIEW_EMAIL,
  EMBED_BRAND_MAX_BYTES,
  FREE_PROMPT_LIMITS,
  FREE_TELEPROMPT_EDIT_MS,
  FREE_TELEPROMPT_MAX,
  PROMPT_LIMITS_ENFORCED,
  PROMPT_STORAGE_BYTES,
  PRO_PROMPT_CREDITS,
  canAddPromptFile,
  canAddPromptFolder,
  canAddPromptPage,
  canAddTeleprompt,
  canEditTeleprompt,
  creditBalance,
  deskPlan,
  formatTelepromptEditCountdown,
  localDayKey,
  promptLimits,
  promptToolCallsLeft,
  telepromptEditRemainingMs,
} from './promptPlanLimits.js';
import { brandStorageBytes, promptFileBytes, storageTreeFromDesk, treeBytes } from './promptStorageTree.js';
import { clearPreviewDeskUsage, embedCountForDay, readPreviewEmbeds, spendPreviewEmbed } from './promptDeskUsage.js';

describe('promptPlanLimits', () => {
  it('enforces the free shelf and leaves Pro open', () => {
    expect(PROMPT_LIMITS_ENFORCED).toBe(true);
    expect(EMBED_BRAND_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(FREE_PROMPT_LIMITS.maxFolders).toBe(Infinity);
    expect(FREE_PROMPT_LIMITS.maxFiles).toBe(6);
    expect(FREE_PROMPT_LIMITS.maxPagesPerFile).toBe(10);
    expect(FREE_PROMPT_LIMITS.maxToolCalls).toBe(3);
    expect(promptLimits('free').maxFolders).toBe(Infinity);
    expect(promptLimits('free').maxFiles).toBe(6);
    expect(promptLimits('free').maxPagesPerFile).toBe(10);
    expect(promptLimits('pro').maxFiles).toBe(Infinity);
    expect(promptLimits('pro').maxToolCalls).toBe(200);
    expect(promptLimits('free').storageBytes).toBe(PROMPT_STORAGE_BYTES);
    expect(PROMPT_STORAGE_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });

  it('caps free files at 6 total across folders and 10 pages per file', () => {
    const folders = [
      { id: 'folder-1', prompts: [{}, {}, {}] },
      { id: 'folder-2', prompts: [{}, {}, {}] },
    ];
    expect(canAddPromptFolder(folders, 'free')).toBe(true);
    expect(canAddPromptFile(folders, 'free', 'folder-1')).toBe(false);
    expect(canAddPromptFile([{ id: 'folder-1', prompts: [{}] }], 'free', 'folder-1')).toBe(true);
    expect(canAddPromptPage(10, 'free')).toBe(false);
    expect(canAddPromptPage(9, 'free')).toBe(true);
    expect(canAddPromptPage(40, 'pro')).toBe(true);
  });

  it('caps free teleprompts at 6 and edit within 2 hours', () => {
    expect(FREE_TELEPROMPT_MAX).toBe(6);
    expect(FREE_TELEPROMPT_EDIT_MS).toBe(2 * 60 * 60 * 1000);
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}` }));
    expect(canAddTeleprompt(six, 'free')).toBe(false);
    expect(canAddTeleprompt(six.slice(0, 5), 'free')).toBe(true);
    expect(canAddTeleprompt(six, 'pro')).toBe(true);

    const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(canEditTeleprompt({ createdAt }, 'free')).toBe(true);
    expect(canEditTeleprompt({ createdAt: old }, 'free')).toBe(false);
    expect(canEditTeleprompt({ createdAt: old }, 'pro')).toBe(true);

    const now = Date.now();
    const halfHourAgo = new Date(now - 30 * 60 * 1000).toISOString();
    expect(telepromptEditRemainingMs({ createdAt: halfHourAgo }, now)).toBe(90 * 60 * 1000);
    expect(telepromptEditRemainingMs({ createdAt: old }, now)).toBe(0);
    expect(formatTelepromptEditCountdown(90 * 60 * 1000)).toBe('1:30');
    expect(formatTelepromptEditCountdown(45 * 1000)).toBe('0:01');
    expect(formatTelepromptEditCountdown(0)).toBe('0:00');
  });

  it('turns 3 free clicks into 21 credits and locks the fourth', () => {
    expect(promptToolCallsLeft(0, 'free')).toBe(3);
    expect(promptToolCallsLeft(3, 'free')).toBe(0);
    expect(creditBalance(3, 'free')).toBe(21);
    expect(creditBalance(0, 'free')).toBe(0);
    expect(creditBalance(200, 'pro')).toBe(PRO_PROMPT_CREDITS);
    expect(PRO_PROMPT_CREDITS).toBe(1400);
  });

  it('keeps the founder login unlimited even on a free profile row', () => {
    expect(deskPlan(DESK_FREE_PREVIEW_EMAIL, 'free')).toBe('pro');
    expect(deskPlan(DESK_FREE_PREVIEW_EMAIL, 'pro')).toBe('pro');
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

  it('counts embed branding toward the desk quota', () => {
    const sizes = {
      'user/file-1.pdf': 100,
      'user/embed-brand/logo.jpg': 800,
      'user/embed-brand/meta.json': 40,
    };
    expect(brandStorageBytes(sizes)).toBe(840);
    const root = storageTreeFromDesk([], sizes);
    const brand = root.children.find((child) => child.id === 'embed-brand');
    expect(brand?.name).toBe('Branding');
    expect(brand?.bytes).toBe(840);
    expect(treeBytes(root)).toBe(840);
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
