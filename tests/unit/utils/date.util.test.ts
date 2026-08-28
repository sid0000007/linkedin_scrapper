import { describe, expect, it } from 'vitest';
import { parseDateRangeText, parseIssuedText } from '../../../src/utils/date.util';

describe('parseDateRangeText', () => {
  it('splits a range with a duration suffix into start/end display text', () => {
    const result = parseDateRangeText('Feb 2025 - Jun 2026 · 1 yr 5 mos');

    expect(result).toEqual({ startDate: 'Feb 2025', endDate: 'Jun 2026' });
  });

  it('treats "Present" as an undefined end date (still current)', () => {
    const result = parseDateRangeText('Jan 2023 - Present · 2 yrs');

    expect(result).toEqual({ startDate: 'Jan 2023', endDate: undefined });
  });

  it('handles a range with no duration suffix', () => {
    expect(parseDateRangeText('2015 - 2019')).toEqual({ startDate: '2015', endDate: '2019' });
  });

  it('returns an empty object for undefined input', () => {
    expect(parseDateRangeText(undefined)).toEqual({});
  });
});

describe('parseIssuedText', () => {
  it('strips the "Issued " prefix', () => {
    expect(parseIssuedText('Issued Jan 2023')).toBe('Jan 2023');
  });

  it('returns undefined for undefined input', () => {
    expect(parseIssuedText(undefined)).toBeUndefined();
  });
});
