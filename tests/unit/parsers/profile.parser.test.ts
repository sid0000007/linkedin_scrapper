import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHtmlTopCard, parseProfileTopCard } from '../../../src/parsers/profile.parser';
import fullFixture from '../../fixtures/me-response.sample.json';
import minimalFixture from '../../fixtures/me-response.minimal.json';

const REAL_TOPCARD_HTML = readFileSync(new URL('../../fixtures/topcard-page.real.html', import.meta.url), 'utf-8');

describe('parseProfileTopCard', () => {
  it('extracts top-card fields from a full /me response', () => {
    const result = parseProfileTopCard(fullFixture);

    expect(result.firstName).toBe('Jordan');
    expect(result.lastName).toBe('Rivera');
    expect(result.headline).toBe('Senior Software Engineer at Example Corp');
    expect(result.publicIdentifier).toBe('jordan-rivera-example');
    expect(result.image?.url).toContain('scale_400_400');
    expect(result.backgroundImage?.url).toContain('350_1400');
  });

  it('degrades gracefully when optional fields are missing', () => {
    const result = parseProfileTopCard(minimalFixture);

    expect(result.firstName).toBe('Alex');
    expect(result.headline).toBe('Product Manager');
    expect(result.image).toBeUndefined();
    expect(result.backgroundImage).toBeUndefined();
  });

  it('returns an empty object (not a throw) when the miniProfile pointer cannot be resolved', () => {
    expect(parseProfileTopCard({ data: { '*miniProfile': 'urn:li:fs_miniProfile:missing' }, included: [] })).toEqual({});
    expect(parseProfileTopCard(undefined)).toEqual({});
    expect(parseProfileTopCard(null)).toEqual({});
  });
});

describe('parseHtmlTopCard', () => {
  it('extracts fullName/headline/location from a real captured profile page (works for any profile, unlike /me)', () => {
    const result = parseHtmlTopCard(REAL_TOPCARD_HTML);

    expect(result).toEqual({
      fullName: 'Siddharth Gupta',
      headline: 'AI Fullstack Engineer | React • Next.js • Python • TypeScript • LLMs • Agents • AWS | Ex Fullstack Engineeri -Cybership | Co-founder @ Daccotta',
      location: 'Gurugram, Haryana, India',
    });
  });

  it('returns an empty object (not a throw) when the Topcard marker is missing', () => {
    expect(parseHtmlTopCard('<html><body>no topcard here</body></html>')).toEqual({});
  });
});
