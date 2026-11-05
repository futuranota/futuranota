import { describe, expect, it } from 'vitest';
import { VAD_THRESHOLD, VOICE_CPS, vadLevel } from './teleprompterVad.js';

describe('teleprompterVad', () => {
  it('exports usable defaults', () => {
    expect(VAD_THRESHOLD).toBeGreaterThan(0);
    expect(VOICE_CPS).toBeGreaterThan(0);
  });

  it('returns 0 without a session', () => {
    expect(vadLevel(null)).toBe(0);
    expect(vadLevel(undefined)).toBe(0);
  });
});
