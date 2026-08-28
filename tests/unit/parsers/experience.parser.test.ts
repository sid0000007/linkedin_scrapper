import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExperience } from '../../../src/parsers/experience.parser';
import { parseFlightResponse } from '../../../src/flight/flight-parser';

const SYNTHETIC_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/experience-response.synthetic.txt', import.meta.url),
  'utf-8',
);
const REAL_FIXTURE = readFileSync(new URL('../../fixtures/flight/experience-response.real.txt', import.meta.url), 'utf-8');

describe('parseExperience', () => {
  it('extracts every entity-collection-item entry, in document order, from a synthetic multi-entry tree', () => {
    const tree = parseFlightResponse(SYNTHETIC_FIXTURE);

    expect(parseExperience(tree)).toEqual([
      {
        title: 'Staff Engineer',
        companyName: 'Acme Corp · Full-time',
        dateRangeText: 'Jan 2023 - Present · 2 yrs',
        location: 'Remote',
        description: 'Shipped the widget platform.',
      },
      {
        title: 'Software Engineer',
        companyName: 'Initech · Contract',
        dateRangeText: 'Jun 2020 - Dec 2022 · 2 yrs 7 mos',
        location: 'Austin, Texas · Hybrid',
        description: undefined,
      },
    ]);
  });

  it('extracts the real, byte-verified Cybership entry and omits entries whose text was not captured', () => {
    const tree = parseFlightResponse(REAL_FIXTURE);

    const result = parseExperience(tree);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: 'Full Stack Engineer ( contract )',
      companyName: 'Cybership · Full-time',
      dateRangeText: 'Feb 2025 - Jun 2026 · 1 yr 5 mos',
      location: 'Kansas, United States · Remote',
      description: undefined,
    });
  });

  it('returns an empty array when there are no experience entries, without throwing', () => {
    expect(parseExperience(['$', 'div', null, { children: [] }])).toEqual([]);
  });
});
