import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCertifications } from '../../../src/parsers/certifications.parser';
import { parseFlightResponse } from '../../../src/flight/flight-parser';

const SYNTHETIC_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/education-certifications-response.synthetic.txt', import.meta.url),
  'utf-8',
);

describe('parseCertifications', () => {
  it('extracts a single certification entry (positional order not yet byte-verified — see docs/RESEARCH.md)', () => {
    const tree = parseFlightResponse(SYNTHETIC_FIXTURE);

    expect(parseCertifications(tree)).toEqual([
      {
        name: 'Cloud Practitioner',
        authority: 'Amazon Web Services',
        issuedText: 'Issued Jan 2023',
        credentialIdText: 'Credential ID XYZ123',
      },
    ]);
  });

  it('returns an empty array when there is no Certifications section', () => {
    expect(parseCertifications(['$', 'div', null, { children: [] }])).toEqual([]);
  });
});
