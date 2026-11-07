import { beforeEach, describe, expect, it } from 'vitest';
import {
  TELEPROMPTER_CREATED_STORE,
  TELEPROMPTER_LIBRARY_STORE,
  applyTelepromptFreeUsageEpoch,
  blankTeleprompt,
  clearTelepromptFreeMeters,
  formatTelepromptUploaded,
  normalizeTelepromptLibrary,
  normalizeTelepromptStatus,
  readTelepromptCreatedCount,
  writeTelepromptCreatedCount,
  writeTelepromptLibrary,
} from './teleprompterLibrary.js';
import { DESK_FREE_PREVIEW_EMAIL } from './promptPlanLimits.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe('teleprompterLibrary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults status to pending', () => {
    expect(normalizeTelepromptStatus('nope')).toBe('pending');
    expect(normalizeTelepromptStatus('completed')).toBe('completed');
  });

  it('normalizes and sorts by updatedAt desc', () => {
    const list = normalizeTelepromptLibrary([
      blankTeleprompt({ id: 'a', name: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' }),
      blankTeleprompt({ id: 'b', name: 'New', updatedAt: '2026-11-05T00:00:00.000Z' }),
    ]);
    expect(list[0].id).toBe('b');
    expect(list[1].id).toBe('a');
  });

  it('formats uploaded dates', () => {
    expect(formatTelepromptUploaded('invalid')).toBe('—');
    expect(formatTelepromptUploaded('2026-11-05T15:16:00.000Z').length).toBeGreaterThan(4);
  });

  it('clears Free create counter and refreshes edit windows', () => {
    writeTelepromptLibrary([
      blankTeleprompt({
        id: 'old',
        name: 'Old',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      }),
    ]);
    writeTelepromptCreatedCount(6);
    const wiped = clearTelepromptFreeMeters();
    expect(wiped.createdCount).toBe(0);
    expect(readTelepromptCreatedCount()).toBe(0);
    expect(wiped.library[0].createdAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(localStorage.getItem(TELEPROMPTER_CREATED_STORE)).toBe('0');
    expect(localStorage.getItem(TELEPROMPTER_LIBRARY_STORE)).toBeTruthy();
  });

  it('applies teleprompt Free epoch only for the preview email once', () => {
    writeTelepromptCreatedCount(6);
    expect(applyTelepromptFreeUsageEpoch(DESK_FREE_PREVIEW_EMAIL)).toBe(true);
    expect(readTelepromptCreatedCount()).toBe(0);
    expect(applyTelepromptFreeUsageEpoch(DESK_FREE_PREVIEW_EMAIL)).toBe(false);
    expect(applyTelepromptFreeUsageEpoch('other@example.com')).toBe(false);
  });
});
