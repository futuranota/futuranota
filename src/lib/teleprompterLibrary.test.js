import { describe, expect, it } from 'vitest';
import {
  blankTeleprompt,
  formatTelepromptUploaded,
  normalizeTelepromptLibrary,
  normalizeTelepromptStatus,
} from './teleprompterLibrary.js';

describe('teleprompterLibrary', () => {
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
});
