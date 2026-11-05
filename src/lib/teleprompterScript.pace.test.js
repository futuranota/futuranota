import { describe, expect, it } from 'vitest';
import { charPaceWeight, pacedUnitsInText } from './teleprompterScript.js';

describe('charPaceWeight', () => {
  it('keeps letters at unit cost', () => {
    expect(charPaceWeight('a')).toBe(1);
    expect(charPaceWeight(' ')).toBe(1);
  });

  it('slows on sentence and clause marks', () => {
    expect(charPaceWeight('.')).toBe(4);
    expect(charPaceWeight('?')).toBe(4);
    expect(charPaceWeight(',')).toBe(2.2);
    expect(charPaceWeight('"')).toBe(1.6);
    expect(charPaceWeight('\n')).toBe(2);
  });
});

describe('pacedUnitsInText', () => {
  it('sums weights up to the cursor', () => {
    expect(pacedUnitsInText('Hi.', 3)).toBe(1 + 1 + 4);
    expect(pacedUnitsInText('Hi.', 2)).toBe(2);
    expect(pacedUnitsInText('Hi.')).toBe(6);
  });
});
