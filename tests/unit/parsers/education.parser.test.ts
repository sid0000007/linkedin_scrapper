import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEducation } from '../../../src/parsers/education.parser';
import { parseFlightResponse } from '../../../src/flight/flight-parser';

const SYNTHETIC_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/education-certifications-response.synthetic.txt', import.meta.url),
  'utf-8',
);
const REAL_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/education-certifications-response.real.txt', import.meta.url),
  'utf-8',
);

describe('parseEducation', () => {
  it('falls back to the whole section as a single entry when there is no entity-collection-item wrapper', () => {
    const tree = parseFlightResponse(SYNTHETIC_FIXTURE);

    expect(parseEducation(tree)).toEqual([{ schoolName: 'State University', degreeName: 'B.S. Computer Science' }]);
  });

  it('returns an empty array (not a throw) against the real capture, whose section content is unreachable due to a corrupted chunk', () => {
    const tree = parseFlightResponse(REAL_FIXTURE);

    expect(parseEducation(tree)).toEqual([]);
  });

  it('returns an empty array when there is no Education section at all', () => {
    expect(parseEducation(['$', 'div', null, { children: [] }])).toEqual([]);
  });
});
