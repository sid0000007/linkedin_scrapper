import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLanguages } from '../../../src/parsers/languages.parser';
import { parseFlightResponse } from '../../../src/flight/flight-parser';

const SYNTHETIC_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/languages-organizations-response.synthetic.txt', import.meta.url),
  'utf-8',
);
const REAL_FIXTURE = readFileSync(new URL('../../fixtures/flight/languages-organizations-response.real.txt', import.meta.url), 'utf-8');

describe('parseLanguages', () => {
  it('extracts multiple language entries (positional order not yet byte-verified — see docs/RESEARCH.md)', () => {
    const tree = parseFlightResponse(SYNTHETIC_FIXTURE);

    expect(parseLanguages(tree)).toEqual([
      { name: 'English', proficiency: 'Native or bilingual proficiency' },
      { name: 'Spanish', proficiency: 'Professional working proficiency' },
    ]);
  });

  it('returns an empty array against the real capture, which confirms the componentId/section but has no languages listed', () => {
    const tree = parseFlightResponse(REAL_FIXTURE);

    expect(parseLanguages(tree)).toEqual([]);
  });

  it('returns an empty array when there is no Language section at all', () => {
    expect(parseLanguages(['$', 'div', null, { children: [] }])).toEqual([]);
  });
});
